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
  items?: unknown[];
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
      .eq('api_key', apiKey)
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
    const comprasToProcess = body.licitaciones || body.compras_agiles || body.compras || [];

    if (!comprasToProcess || !Array.isArray(comprasToProcess) || comprasToProcess.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Se requiere un array de compras ágiles o licitaciones' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      success: true,
      synced: 0,
      errors: [] as string[],
      details: {} as Record<string, unknown>
    };

    // Process each compra ágil
<<<<<<< Updated upstream
    for (const lic of licitaciones as CompraAgilData[]) {
=======
    for (const lic of comprasToProcess) {
>>>>>>> Stashed changes
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
        
        let categoria = 'L1';
        
        if (monto && monto > 0) {
          const montoUTM = monto / UTM_2026_ENE;
          if (montoUTM >= 100) {
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
        
<<<<<<< Updated upstream
        const compraData = {
=======
        // Guardar TODOS los datos adicionales en datos_json
        const datosCompletos = {
          ...(lic.datos_json || {}),
          // Incluir todos los campos adicionales que puedan venir
          institucion_rut: lic.institucion_rut || null,
          contacto_email: lic.contacto_email || null,
          contacto_telefono: lic.contacto_telefono || null,
          organismo_direccion: lic.organismo_direccion || null,
          condiciones_pago: lic.condiciones_pago || null,
          plazo_entrega: lic.plazo_entrega || null,
          forma_pago: lic.forma_pago || null,
          lugar_entrega: lic.lugar_entrega || null,
          unidad_compra: lic.unidad_compra || null,
          responsable: lic.responsable || null,
          moneda: lic.moneda || 'CLP',
          tipo_proceso_detalle: lic.tipo_proceso || null,
          modalidad: lic.modalidad || null,
          comuna: lic.comuna || null,
          fecha_publicacion: lic.fecha_publicacion || null,
          // Incluir el objeto completo como fallback
          raw_data: lic
        };
        
        const compraData: any = {
>>>>>>> Stashed changes
          codigo: lic.codigo,
          nombre: lic.nombre || `Compra Ágil ${lic.codigo}`,
          organismo: lic.organismo || lic.institucion_nombre || 'Organismo no especificado',
          monto: monto,
          fecha_cierre: lic.fecha_cierre || null,
          estado: lic.estado || 'activa',
          region: lic.region || null,
          descripcion: lic.descripcion || null,
          link_oficial: lic.link_oficial || null,
<<<<<<< Updated upstream
          datos_json: lic.datos_json || lic,
=======
          datos_json: datosCompletos, // Store ALL scraped data
          tipo_proceso: tipo_proceso, // 'compra_agil' o 'licitacion'
          categoria: categoria, // 'L1', 'LE', 'LP', 'LR'
>>>>>>> Stashed changes
        };

        // Upsert compra ágil
        const { error: compraError } = await supabase
          .from('compras_agiles')
          .upsert(compraData, { onConflict: 'codigo' })
          .select('id')
          .single();

        if (compraError) {
          console.error(`Error upserting compra ágil ${lic.codigo}:`, compraError);
          results.errors.push(`Compra Ágil ${lic.codigo}: ${compraError.message}`);
          continue;
        }

        // Si hay items en la licitación, guardarlos
        const itemsToSave = lic.items || [];
        if (Array.isArray(itemsToSave) && itemsToSave.length > 0) {
          // Eliminar items existentes para esta compra ágil
          await supabase
            .from('licitacion_items')
            .delete()
            .eq('licitacion_id', lic.codigo);

          // Insertar nuevos items
          const itemsData = (itemsToSave as Record<string, unknown>[]).map((item, index) => ({
            licitacion_id: lic.codigo,
            nombre_producto: (item.nombre_producto as string) || (item.nombre as string) || 'Producto sin nombre',
            descripcion: (item.descripcion as string) || null,
            cantidad: (item.cantidad as number) || 1,
            unidad: (item.unidad as string) || (item.unidadMedida as string) || 'UN'
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
      total: comprasToProcess.length,
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
