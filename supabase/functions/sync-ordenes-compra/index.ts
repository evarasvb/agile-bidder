import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface OrdenCompraData {
  codigo: string;
  nombre?: string;
  descripcion?: string;
  institucion_nombre?: string;
  institucion_rut?: string;
  proveedor_nombre?: string;
  proveedor_rut?: string;
  total_neto?: number | null;
  total?: number | null;
  fecha_creacion?: string | null;
  fecha_envio?: string | null;
  fecha_aceptacion?: string | null;
  estado?: string;
  link_oficial?: string;
  datos_json?: Record<string, unknown>;
}

interface OrdenCompraItemData {
  producto_id?: string | null;
  nombre_producto?: string;
  descripcion?: string | null;
  cantidad?: number | null;
  unidad?: string | null;
  precio_unitario?: number | null;
  subtotal?: number | null;
  item_index?: number;
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
    const { ordenes_compra } = body;

    if (!ordenes_compra || !Array.isArray(ordenes_compra)) {
      return new Response(
        JSON.stringify({ error: 'Se requiere un array de órdenes de compra' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      success: true,
      synced: 0,
      errors: [] as string[],
      details: {} as any
    };

    // Process each orden de compra
    for (const oc of ordenes_compra) {
      try {
        if (!oc.codigo) {
          results.errors.push('Orden de compra sin código');
          continue;
        }

        const ordenData: any = {
          codigo: oc.codigo,
          nombre: oc.nombre || null,
          descripcion: oc.descripcion || null,
          institucion_nombre: oc.institucion_nombre || null,
          institucion_rut: oc.institucion_rut || null,
          proveedor_nombre: oc.proveedor_nombre || null,
          proveedor_rut: oc.proveedor_rut || null,
          total_neto: oc.total_neto || null,
          total: oc.total || null,
          fecha_creacion: oc.fecha_creacion || null,
          fecha_envio: oc.fecha_envio || null,
          fecha_aceptacion: oc.fecha_aceptacion || null,
          estado: oc.estado || 'pendiente',
          link_oficial: oc.link_oficial || null,
          datos_json: oc.datos_json || oc, // Store full scraped data
        };

        // Upsert orden de compra
        const { data: insertedOrden, error: ordenError } = await supabase
          .from('ordenes_compra')
          .upsert(ordenData, { onConflict: 'codigo' })
          .select('codigo')
          .single();

        if (ordenError) {
          console.error(`Error upserting orden de compra ${oc.codigo}:`, ordenError);
          results.errors.push(`Orden de compra ${oc.codigo}: ${ordenError.message}`);
          continue;
        }

        // Si hay items, guardarlos
        const itemsToSave = oc.items || [];
        if (itemsToSave.length > 0 && insertedOrden) {
          // Eliminar items existentes para esta orden
          await supabase
            .from('orden_compra_items')
            .delete()
            .eq('orden_compra_codigo', insertedOrden.codigo);

          // Insertar nuevos items
          const itemsData = itemsToSave.map((item: OrdenCompraItemData, index: number) => ({
            orden_compra_codigo: insertedOrden.codigo,
            item_index: item.item_index || index + 1,
            producto_id: item.producto_id || null,
            nombre_producto: item.nombre_producto || 'Producto sin nombre',
            descripcion: item.descripcion || null,
            cantidad: item.cantidad || null,
            unidad: item.unidad || 'UN',
            precio_unitario: item.precio_unitario || null,
            subtotal: item.subtotal || null,
          }));

          const { error: itemsError } = await supabase
            .from('orden_compra_items')
            .insert(itemsData);

          if (itemsError) {
            console.error(`Error inserting items for orden de compra ${oc.codigo}:`, itemsError);
            results.errors.push(`Error guardando items de ${oc.codigo}: ${itemsError.message}`);
          } else {
            console.log(`Inserted ${itemsData.length} items for orden de compra ${oc.codigo}`);
          }
        }

        results.synced++;
      } catch (itemError) {
        console.error(`Error processing orden de compra:`, itemError);
        results.errors.push(`Error procesando orden de compra: ${itemError}`);
      }
    }

    results.success = results.errors.length === 0;
    results.details = {
      total: ordenes_compra.length,
      synced: results.synced,
      errors: results.errors.length
    };

    console.log(`Sync ordenes de compra completed: ${results.synced} items synced, ${results.errors.length} errors`);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-ordenes-compra:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
