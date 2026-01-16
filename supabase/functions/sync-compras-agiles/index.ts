import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CompraAgilData {
  codigo: string;
  nombre?: string;
  institucion_nombre?: string;
  organismo?: string;
  presupuesto_estimado?: number | null;
  monto?: number | null;
  fecha_cierre?: string | null;
  estado?: string;
  region?: string;
  descripcion?: string;
  link_oficial?: string;
  tipo?: string;
  datos_json?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key requerida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API key
    const { data: keyData, error: keyError } = await supabase
      .from('extension_api_keys')
      .select('id, cliente_id, activa')
      .eq('key', apiKey)
      .eq('activa', true)
      .single();

    if (keyError || !keyData) {
      return new Response(
        JSON.stringify({ error: 'API key inválida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { licitaciones } = body;

    if (!licitaciones || !Array.isArray(licitaciones)) {
      return new Response(
        JSON.stringify({ error: 'Se requiere un array de licitaciones' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      success: true,
      synced: 0,
      errors: [] as string[],
      details: {} as any
    };

    // Process each compra ágil
    for (const lic of licitaciones) {
      try {
        // Skip if not a compra ágil
        if (lic.tipo !== 'compra_agil' && !lic.codigo) {
          continue;
        }

        // Map scraper data to database schema
        const monto = lic.monto || lic.presupuesto_estimado || null;
        
        // Clasificar proceso según monto (regla 100 UTM)
        // UTM Enero 2026: $69.751 CLP
        // Umbral: 100 UTM = $6.975.100 CLP
        const UTM_2026_ENE = 69751;
        const UMBRAL_COMPRA_AGIL_CLP = 100 * UTM_2026_ENE; // $6.975.100 CLP
        
        let tipo_proceso = 'compra_agil'; // Por defecto
        let categoria = 'L1';
        
        if (monto && monto > 0) {
          const montoUTM = monto / UTM_2026_ENE;
          if (montoUTM >= 100) {
            tipo_proceso = 'licitacion';
            if (montoUTM < 1000) {
              categoria = 'LE'; // Intermedia
            } else if (montoUTM < 5000) {
              categoria = 'LP'; // Mayor
            } else {
              categoria = 'LR'; // Gran Compra
            }
          } else {
            categoria = 'L1'; // Compra Ágil
          }
        }
        
        const compraData: any = {
          codigo: lic.codigo,
          nombre: lic.nombre || `Compra Ágil ${lic.codigo}`,
          nombre_organismo: lic.organismo || lic.institucion_nombre || 'Organismo no especificado',
          organismo: lic.organismo || lic.institucion_nombre || 'Organismo no especificado', // Mantener por compatibilidad
          monto_estimado: monto,
          monto: monto, // Mantener por compatibilidad
          fecha_cierre: lic.fecha_cierre || null,
          estado: lic.estado || 'activa',
          region: lic.region || null,
          descripcion: lic.descripcion || null,
          link_oficial: lic.link_oficial || null,
          datos_json: lic.datos_json || lic, // Store full scraped data
          tipo_proceso: tipo_proceso, // 'compra_agil' o 'licitacion'
          categoria: categoria, // 'L1', 'LE', 'LP', 'LR'
        };

        // Upsert compra ágil
        const { data: insertedCompra, error: compraError } = await supabase
          .from('compras_agiles')
          .upsert(compraData, { onConflict: 'codigo' })
          .select('id')
          .single();

        if (compraError) {
          console.error(`Error upserting compra ágil ${lic.codigo}:`, compraError);
          results.errors.push(`Compra Ágil ${lic.codigo}: ${compraError.message}`);
          continue;
        }

        // Si hay items en el body o en la licitación, guardarlos
        const itemsToSave = items || lic.items || [];
        if (itemsToSave.length > 0) {
          // Eliminar items existentes para esta compra ágil
          await supabase
            .from('licitacion_items')
            .delete()
            .eq('licitacion_codigo', lic.codigo);

          // Insertar nuevos items
          const itemsData = itemsToSave.map((item: any, index: number) => ({
            licitacion_codigo: lic.codigo,
            licitacion_id: lic.codigo, // Mantener compatibilidad con tabla licitaciones
            item_index: item.correlativo || item.item_index || (index + 1),
            nombre_producto: item.nombre_producto || item.nombre || 'Producto sin nombre',
            descripcion: item.descripcion || null,
            cantidad: item.cantidad || 1,
            unidad: item.unidad || item.unidadMedida || 'UN'
          }));

          const { error: itemsError } = await supabase
            .from('licitacion_items')
            .insert(itemsData);

          if (itemsError) {
            console.error(`Error inserting items for compra ágil ${lic.codigo}:`, itemsError);
            results.errors.push(`Error guardando items de ${lic.codigo}: ${itemsError.message}`);
          } else {
            console.log(`Inserted ${itemsData.length} items for compra ágil ${lic.codigo}`);
          }
        }

        results.synced++;
      } catch (itemError) {
        console.error(`Error processing compra ágil:`, itemError);
        results.errors.push(`Error procesando compra ágil: ${itemError}`);
      }
    }

    results.success = results.errors.length === 0;
    results.details = {
      total: licitaciones.length,
      synced: results.synced,
      errors: results.errors.length
    };

    console.log(`Sync compras ágiles completed: ${results.synced} items synced, ${results.errors.length} errors`);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-compras-agiles:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
