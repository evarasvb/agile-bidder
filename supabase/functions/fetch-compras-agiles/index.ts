// =============================================================================
// FETCH COMPRAS AGILES - API MercadoPublico
// Edge Function que extrae compras ágiles desde la API del buscador
// Diseñada para ejecutarse cada 4 horas via cron
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const API_BASE = 'https://api.buscador.mercadopublico.cl';

interface CompraAgilListItem {
  id: number;
  codigo: string;
  nombre: string;
  fecha_publicacion: string;
  fecha_cierre: string;
  organismo: string;
  unidad: string;
  id_estado: number;
  estado: string;
  monto_disponible: number;
  moneda: string;
  cantidad_proveedores_cotizando: number;
}

interface CompraAgilDetalle {
  detalle_id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  fecha_publicacion: string;
  fecha_cierre: string;
  id_estado: number;
  estado: string;
  direccion_entrega: string;
  plazo_entrega: number;
  presupuesto_estimado: number;
  moneda: string;
  productos_solicitados: ProductoSolicitado[];
  informacion_institucion: {
    organismo_comprador: string;
    rut_organismo_comprador: string;
    division: string;
  };
}

interface ProductoSolicitado {
  codigo_producto: number;
  nombre: string;
  descripcion: string;
  cantidad: number;
  unidad_medida: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Configuración: últimas 8 horas para asegurar cobertura
    const now = new Date();
    const hoursBack = 168
    const dateFrom = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
    
    const dateFromStr = dateFrom.toISOString().split('T')[0];
    const dateToStr = now.toISOString().split('T')[0];

    console.log(`Fetching compras ágiles desde ${dateFromStr} hasta ${dateToStr}`);

    let page = 1;
    let pageCount = 1;
    let totalSynced = 0;
    let totalItems = 0;
    const errors: string[] = [];

    // Iterar páginas (máx 30 para evitar timeout de 30s)
    while (page <= pageCount && page <= 30) {
      const listUrl = `${API_BASE}/compra-agil?date_from=${dateFromStr}&date_to=${dateToStr}&order_by=recent&page_number=${page}&status=2`;
      
      console.log(`Fetching page ${page}: ${listUrl}`);
      
      const listRes = await fetch(listUrl);
      if (!listRes.ok) {
        errors.push(`Error fetching page ${page}: ${listRes.status}`);
        break;
      }

      const listData = await listRes.json();
      
      if (page === 1) {
        pageCount = Math.min(listData.payload?.pageCount || 1, 30);
        console.log(`Total pages: ${pageCount}, Total results: ${listData.payload?.resultCount}`);
      }

      const resultados: CompraAgilListItem[] = listData.payload?.resultados || [];

      for (const item of resultados) {
        try {
          // Fetch detalle para obtener productos_solicitados
          const fichaUrl = `${API_BASE}/compra-agil/ficha?code=${item.codigo}`;
          const fichaRes = await fetch(fichaUrl);
          
          let detalle: CompraAgilDetalle | null = null;
          if (fichaRes.ok) {
            const fichaData = await fichaRes.json();
            detalle = fichaData.payload;
          }

          // Upsert en compras_agiles
          const compraData = {
            codigo: item.codigo,
            nombre: detalle?.nombre || item.nombre,
            descripcion: detalle?.descripcion || item.nombre,
            estado: item.estado,
            fecha_publicacion: item.fecha_publicacion,
            fecha_cierre: item.fecha_cierre,
            monto_estimado: detalle?.presupuesto_estimado || item.monto_disponible,
            moneda: item.moneda,
            nombre_organismo: detalle?.informacion_institucion?.organismo_comprador || item.organismo,
            datos_json: {
              ...item,
              detalle: detalle,
              direccion_entrega: detalle?.direccion_entrega,
              plazo_entrega: detalle?.plazo_entrega,
              rut_organismo: detalle?.informacion_institucion?.rut_organismo_comprador,
              division: detalle?.informacion_institucion?.division,
              cantidad_proveedores: item.cantidad_proveedores_cotizando,
            },
            updated_at: new Date().toISOString(),
          };

          const { data: compraResult, error: compraError } = await supabase
            .from('compras_agiles')
            .upsert(compraData, { onConflict: 'codigo' })
            .select('id')
            .single();

          if (compraError) {
            errors.push(`Error upsert ${item.codigo}: ${compraError.message}`);
            continue;
          }

          const compraId = compraResult?.id;

          // Procesar items si hay detalle
          if (detalle?.productos_solicitados && detalle.productos_solicitados.length > 0 && compraId) {
            // Eliminar items anteriores
            await supabase
              .from('compras_agiles_items')
              .delete()
              .eq('compra_agil_id', compraId);

            // Insertar nuevos items
            const itemsData = detalle.productos_solicitados.map((p) => ({
              compra_agil_id: compraId,
              codigo_producto: String(p.codigo_producto),
              nombre_producto: p.nombre,
              descripcion_producto: p.descripcion,
              cantidad: p.cantidad,
              unidad: p.unidad_medida,
            }));

            const { error: itemsError } = await supabase
              .from('compras_agiles_items')
              .insert(itemsData);

            if (itemsError) {
              errors.push(`Error items ${item.codigo}: ${itemsError.message}`);
            } else {
              totalItems += itemsData.length;
            }
          }

          totalSynced++;
        } catch (itemErr) {
          errors.push(`Error processing ${item.codigo}: ${itemErr}`);
        }
      }

      page++;
      
      // Pequeña pausa para no saturar la API
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const result = {
      success: errors.length === 0,
      message: `Sync completado: ${totalSynced} compras, ${totalItems} items`,
      stats: {
        pages_processed: page - 1,
        compras_synced: totalSynced,
        items_synced: totalItems,
        errors_count: errors.length,
      },
      errors: errors.slice(0, 10), // Solo primeros 10 errores
      timestamp: new Date().toISOString(),
    };

    console.log('Sync result:', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-compras-agiles:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
