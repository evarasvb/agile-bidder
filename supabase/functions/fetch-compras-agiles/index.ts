// =============================================================================
// FETCH COMPRAS ÁGILES - API Buscador MercadoPúblico
// Edge Function que extrae compras ágiles desde la API del buscador
// Diseñada para ejecutarse cada 4 horas via cron (GitHub Actions)
//
// Flujo de autenticación:
//   1. Obtiene JWT público desde servicios-prd.mercadopublico.cl/v1/auth/publico
//   2. Usa ese Bearer token + x-api-key para llamar a api.buscador.mercadopublico.cl
//   3. Hace upsert de los resultados en Supabase (compras_agiles + compras_agiles_items)
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Endpoints de MercadoPúblico
const AUTH_URL = 'https://servicios-prd.mercadopublico.cl/v1/auth/publico';
const API_BASE = 'https://api.buscador.mercadopublico.cl';
const API_KEY = 'e93089e4-437c-4723-b343-4fa20045e3bc';

// Headers comunes para simular navegador (requerido por CloudFront)
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Origin': 'https://buscador.mercadopublico.cl',
  'Referer': 'https://buscador.mercadopublico.cl/',
  'Accept': 'application/json',
  'Accept-Language': 'es-CL,es;q=0.9',
};

// =====================================================
// Interfaces
// =====================================================

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
  monto_disponible_CLP: number;
  cantidad_proveedores_cotizando: number;
  estado_convocatoria: number;
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
  motivo_cancelacion: string | null;
  fecha_cancelacion: string | null;
  multa_sancion: number;
  cantidad_proveedores_invitados: number;
  productos_solicitados: ProductoSolicitado[];
  informacion_institucion?: {
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

interface AuthResponse {
  success: string;
  payload: {
    access_token: string;
    expires_in: number;
    token_type: string;
  };
  errores: string | null;
}

interface ListResponse {
  success: string;
  payload: {
    resultCount: number;
    pageCount: number;
    resultados: CompraAgilListItem[];
  };
  errores: string | null;
}

interface FichaResponse {
  success: string;
  payload: CompraAgilDetalle;
  errores: string | null;
}

// =====================================================
// Funciones auxiliares
// =====================================================

/**
 * Obtiene un Bearer Token JWT público desde el endpoint de autenticación
 * de MercadoPúblico. Este token es anónimo y expira en ~8 horas.
 */
async function obtenerTokenPublico(): Promise<string> {
  console.log('[AUTH] Solicitando token público...');

  const response = await fetch(AUTH_URL, {
    method: 'GET',
    headers: BROWSER_HEADERS,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Error obteniendo token: HTTP ${response.status} - ${text}`);
  }

  const data: AuthResponse = await response.json();

  if (!data.payload?.access_token) {
    throw new Error(`Respuesta de auth inválida: ${JSON.stringify(data)}`);
  }

  console.log(`[AUTH] Token obtenido (expira en ${data.payload.expires_in}s)`);
  return data.payload.access_token;
}

/**
 * Hace un GET autenticado a la API del buscador
 */
async function fetchAPI<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...BROWSER_HEADERS,
      'Authorization': `Bearer ${token}`,
      'x-api-key': API_KEY,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return response.json();
}

/**
 * Pausa para rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =====================================================
// Handler principal
// =====================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parsear parámetros opcionales del body
    let hoursBack = 10; // Por defecto últimas 10 horas (cubre cron cada 4h con margen)
    let maxPages = 50;  // Máximo de páginas a procesar
    let fetchDetails = true; // Si obtener la ficha detallada de cada compra
    let statusFilter = ''; // Filtro de estado (vacío = todos, 2 = publicada)

    try {
      if (req.method === 'POST') {
        const body = await req.json();
        hoursBack = body.hours_back || hoursBack;
        maxPages = body.max_pages || maxPages;
        fetchDetails = body.fetch_details !== false;
        statusFilter = body.status || statusFilter;
      }
    } catch {
      // Sin body o body inválido, usar defaults
    }

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calcular rango de fechas
    const now = new Date();
    const dateFrom = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
    const dateFromStr = dateFrom.toISOString().split('T')[0];
    const dateToStr = now.toISOString().split('T')[0];

    console.log(`[SYNC] Iniciando sincronización de compras ágiles`);
    console.log(`[SYNC] Rango: ${dateFromStr} a ${dateToStr} (últimas ${hoursBack}h)`);

    // Paso 1: Obtener token JWT público
    const token = await obtenerTokenPublico();

    // Paso 2: Iterar páginas del listado
    let page = 1;
    let pageCount = 1;
    let totalSynced = 0;
    let totalItems = 0;
    let totalNew = 0;
    let totalUpdated = 0;
    const errors: string[] = [];

    while (page <= pageCount && page <= maxPages) {
      let listUrl = `${API_BASE}/compra-agil?date_from=${dateFromStr}&date_to=${dateToStr}&order_by=recent&page_number=${page}`;
      if (statusFilter) {
        listUrl += `&status=${statusFilter}`;
      }

      console.log(`[LIST] Página ${page}/${pageCount}: ${listUrl}`);

      try {
        const listData = await fetchAPI<ListResponse>(listUrl, token);

        if (page === 1) {
          pageCount = Math.min(listData.payload?.pageCount || 1, maxPages);
          console.log(`[LIST] Total: ${listData.payload?.resultCount} resultados en ${pageCount} páginas`);
        }

        const resultados: CompraAgilListItem[] = listData.payload?.resultados || [];

        for (const item of resultados) {
          try {
            let detalle: CompraAgilDetalle | null = null;

            // Obtener ficha detallada (opcional, agrega descripción y productos)
            if (fetchDetails) {
              try {
                const fichaUrl = `${API_BASE}/compra-agil?action=ficha&code=${item.codigo}`;
                const fichaData = await fetchAPI<FichaResponse>(fichaUrl, token);
                detalle = fichaData.payload;
                await sleep(100); // Rate limiting entre fichas
              } catch (fichaErr) {
                console.warn(`[FICHA] Error obteniendo ficha ${item.codigo}: ${fichaErr}`);
                // Continuar sin detalle, usar datos del listado
              }
            }

            // Verificar si ya existe
            const { data: existing } = await supabase
              .from('compras_agiles')
              .select('id, updated_at')
              .eq('codigo', item.codigo)
              .maybeSingle();

            // Preparar datos para upsert
            const compraData: Record<string, unknown> = {
              codigo: item.codigo,
              nombre: detalle?.nombre || item.nombre,
              descripcion: detalle?.descripcion || item.nombre,
              estado: item.estado,
              fecha_publicacion: item.fecha_publicacion,
              fecha_cierre: item.fecha_cierre,
              monto_estimado: detalle?.presupuesto_estimado || item.monto_disponible,
              moneda: item.moneda || 'CLP',
              nombre_organismo: detalle?.informacion_institucion?.organismo_comprador || item.organismo,
              datos_json: {
                id_mp: item.id,
                codigo: item.codigo,
                unidad: item.unidad,
                id_estado: item.id_estado,
                estado_convocatoria: item.estado_convocatoria,
                monto_disponible: item.monto_disponible,
                monto_disponible_CLP: item.monto_disponible_CLP,
                cantidad_proveedores: item.cantidad_proveedores_cotizando,
                // Datos del detalle
                direccion_entrega: detalle?.direccion_entrega || null,
                plazo_entrega: detalle?.plazo_entrega || null,
                rut_organismo: detalle?.informacion_institucion?.rut_organismo_comprador || null,
                division: detalle?.informacion_institucion?.division || null,
                multa_sancion: detalle?.multa_sancion || null,
                cantidad_proveedores_invitados: detalle?.cantidad_proveedores_invitados || null,
                motivo_cancelacion: detalle?.motivo_cancelacion || null,
                fecha_cancelacion: detalle?.fecha_cancelacion || null,
                sync_source: 'fetch-compras-agiles',
                sync_timestamp: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            };

            // Upsert en compras_agiles
            const { data: compraResult, error: compraError } = await supabase
              .from('compras_agiles')
              .upsert(compraData, { onConflict: 'codigo' })
              .select('id')
              .single();

            if (compraError) {
              errors.push(`Upsert ${item.codigo}: ${compraError.message}`);
              continue;
            }

            const compraId = compraResult?.id;

            if (existing) {
              totalUpdated++;
            } else {
              totalNew++;
            }

            // Paso 3: Procesar items/productos si hay detalle
            if (detalle?.productos_solicitados && detalle.productos_solicitados.length > 0 && compraId) {
              // Eliminar items anteriores de esta compra
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
                errors.push(`Items ${item.codigo}: ${itemsError.message}`);
              } else {
                totalItems += itemsData.length;
              }
            }

            totalSynced++;
          } catch (itemErr) {
            const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
            errors.push(`Processing ${item.codigo}: ${msg}`);
          }
        }
      } catch (pageErr) {
        const msg = pageErr instanceof Error ? pageErr.message : String(pageErr);
        errors.push(`Página ${page}: ${msg}`);
        // Si falla una página, intentar la siguiente
      }

      page++;
      await sleep(300); // Pausa entre páginas
    }

    // Resultado final
    const result = {
      success: true,
      message: `Sync completado: ${totalSynced} compras (${totalNew} nuevas, ${totalUpdated} actualizadas), ${totalItems} items`,
      stats: {
        date_range: `${dateFromStr} a ${dateToStr}`,
        hours_back: hoursBack,
        pages_processed: page - 1,
        total_pages: pageCount,
        compras_synced: totalSynced,
        compras_new: totalNew,
        compras_updated: totalUpdated,
        items_synced: totalItems,
        errors_count: errors.length,
      },
      errors: errors.slice(0, 20), // Primeros 20 errores
      timestamp: new Date().toISOString(),
    };

    console.log(`[SYNC] Resultado: ${JSON.stringify(result.stats)}`);
    if (errors.length > 0) {
      console.warn(`[SYNC] Errores (${errors.length}):`, errors.slice(0, 5));
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[SYNC] Error fatal:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
