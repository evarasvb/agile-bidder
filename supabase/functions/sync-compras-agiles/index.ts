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
  institucion_rut?: string;
  contacto_email?: string;
  contacto_telefono?: string;
  organismo_direccion?: string;
  condiciones_pago?: string;
  plazo_entrega?: string;
  forma_pago?: string;
  lugar_entrega?: string;
  unidad_compra?: string;
  responsable?: string;
  moneda?: string;
  tipo_proceso?: string;
  modalidad?: string;
  comuna?: string;
  fecha_publicacion?: string;
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
    // La extensión envía los items del detalle a nivel raíz del payload
    // (`{ compras_agiles: [compra], items: [...] }`), no dentro de cada compra.
    const topLevelItems = Array.isArray(body.items) ? body.items : [];

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
    for (const lic of comprasToProcess as CompraAgilData[]) {
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
        
        // Guardar TODOS los datos adicionales en datos_json
        const datosCompletos = {
          ...(lic.datos_json || {}),
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
          categoria: categoria,
          raw_data: lic
        };
        
        const compraData = {
          codigo: lic.codigo,
          nombre: lic.nombre || `Compra Ágil ${lic.codigo}`,
          organismo: lic.organismo || lic.institucion_nombre || 'Organismo no especificado',
          monto: monto,
          fecha_cierre: lic.fecha_cierre || null,
          estado: lic.estado || 'activa',
          region: lic.region || null,
          descripcion: lic.descripcion || null,
          link_oficial: lic.link_oficial || null,
          datos_json: datosCompletos,
        };

        // Upsert compra ágil (capturamos el id para asociar los items)
        const { data: compraRow, error: compraError } = await supabase
          .from('compras_agiles')
          .upsert(compraData, { onConflict: 'codigo' })
          .select('id')
          .single();

        if (compraError) {
          console.error(`Error upserting compra ágil ${lic.codigo}:`, compraError);
          results.errors.push(`Compra Ágil ${lic.codigo}: ${compraError.message}`);
          continue;
        }

        // Items del detalle. Pueden venir dentro de la compra (`lic.items`) o,
        // como hace la extensión, a nivel raíz del payload (`topLevelItems`);
        // en ese caso corresponden a la compra cuando se envía de a una.
        const nestedItems = Array.isArray(lic.items) ? lic.items : [];
        const itemsToSave = nestedItems.length > 0
          ? nestedItems
          : (comprasToProcess.length === 1 ? topLevelItems : []);

        // Se guardan en compras_agiles_items (la tabla que consume el matching),
        // asociados por compra_agil_id. Antes se guardaban en licitacion_items,
        // por eso el match nunca los veía.
        if (compraRow?.id && Array.isArray(itemsToSave) && itemsToSave.length > 0) {
          await supabase
            .from('compras_agiles_items')
            .delete()
            .eq('compra_agil_id', compraRow.id);

          const itemsData = (itemsToSave as Record<string, unknown>[]).map((item) => ({
            compra_agil_id: compraRow.id,
            codigo_producto: (item.codigo_producto as string) || (item.codigo as string) || null,
            nombre_producto: (item.nombre_producto as string) || (item.nombre as string) || 'Producto sin nombre',
            descripcion_producto: (item.descripcion as string) || (item.descripcion_producto as string) || null,
            cantidad: (item.cantidad as number) ?? null,
            unidad: (item.unidad as string) || (item.unidadMedida as string) || null,
          }));

          const { error: itemsError } = await supabase
            .from('compras_agiles_items')
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
