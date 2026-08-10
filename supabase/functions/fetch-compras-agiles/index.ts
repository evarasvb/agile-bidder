// =============================================================================
// FETCH COMPRAS AGILES - API MercadoPublico con fallback a CSV
// Edge Function que extrae compras ágiles desde la API del buscador
// Diseñada para ejecutarse cada 4 horas via cron
// Incluye headers browser-like para evitar 403 de CloudFront
// Si la API falla (403/timeout), cae a datos CSV de datos-abiertos
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const API_BASE = 'https://api.buscador.mercadopublico.cl';
const CSV_BASE = 'https://datos-abiertos.chilecompra.cl/descargas/compra-agil';

// Headers que imitan un navegador Chrome real para evitar bloqueo de CloudFront
const browserHeaders: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
  'Referer': 'https://www.mercadopublico.cl/',
  'Origin': 'https://www.mercadopublico.cl',
  'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
};

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

/** Fetch con timeout configurable */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/** Intenta obtener datos desde la API hidden con headers browser-like */
async function fetchFromApi(dateFromStr: string, dateToStr: string): Promise<{
  success: boolean;
  items: CompraAgilListItem[];
  pageCount: number;
  error?: string;
}> {
  const listUrl = `${API_BASE}/compra-agil?date_from=${dateFromStr}&date_to=${dateToStr}&order_by=recent&page_number=1&status=2`;
  console.log(`[API] Intentando fetch: ${listUrl}`);

  try {
    const listRes = await fetchWithTimeout(listUrl, { headers: browserHeaders }, 15000);

    if (listRes.status === 403) {
      console.warn('[API] 403 Forbidden - CloudFront bloqueó la request');
      return { success: false, items: [], pageCount: 0, error: `API returned 403` };
    }

    if (!listRes.ok) {
      return { success: false, items: [], pageCount: 0, error: `API returned ${listRes.status}` };
    }

    const listData = await listRes.json();
    const pageCount = Math.min(listData.payload?.pageCount || 1, 30);
    const resultados: CompraAgilListItem[] = listData.payload?.resultados || [];

    return { success: true, items: resultados, pageCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('abort')) {
      console.warn('[API] Timeout alcanzado');
      return { success: false, items: [], pageCount: 0, error: 'API timeout' };
    }
    return { success: false, items: [], pageCount: 0, error: message };
  }
}

/** Parsea una línea CSV respetando comillas */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ';' || ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Fallback: descarga CSV mensual de datos-abiertos.chilecompra.cl */
async function fetchFromCSV(): Promise<{
  success: boolean;
  records: Array<Record<string, string>>;
  error?: string;
}> {
  // El CSV de datos-abiertos se publica mensualmente
  // Intentar el mes actual, luego el anterior
  const now = new Date();
  const months = [
    { year: now.getFullYear(), month: now.getMonth() + 1 },
    { year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(), month: now.getMonth() === 0 ? 12 : now.getMonth() },
  ];

  for (const { year, month } of months) {
    const monthStr = String(month).padStart(2, '0');
    const csvUrl = `${CSV_BASE}/${year}-${monthStr}.csv`;
    console.log(`[CSV] Intentando descargar: ${csvUrl}`);

    try {
      const res = await fetchWithTimeout(csvUrl, {
        headers: {
          'User-Agent': browserHeaders['User-Agent'],
          'Accept': 'text/csv, application/csv, text/plain, */*',
        },
      }, 30000);

      if (!res.ok) {
        console.warn(`[CSV] ${csvUrl} retornó ${res.status}`);
        continue;
      }

      const text = await res.text();
      const lines = text.split('\n').filter(l => l.trim().length > 0);

      if (lines.length < 2) {
        console.warn(`[CSV] Archivo vacío o sin datos: ${csvUrl}`);
        continue;
      }

      // Primera línea es header
      const headers = parseCSVLine(lines[0]);
      const records: Array<Record<string, string>> = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const record: Record<string, string> = {};
        for (let j = 0; j < headers.length && j < values.length; j++) {
          record[headers[j]] = values[j];
        }
        records.push(record);
      }

      console.log(`[CSV] Parseados ${records.length} registros desde ${csvUrl}`);
      return { success: true, records };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[CSV] Error descargando ${csvUrl}: ${message}`);
      continue;
    }
  }

  return { success: false, records: [], error: 'No se pudo descargar CSV de ningún mes' };
}

/** Mapea un registro CSV al formato de upsert de la tabla compras_agiles */
function mapCSVRecord(record: Record<string, string>) {
  // Los campos del CSV de datos-abiertos varían, mapear los más comunes
  const codigo = record['Codigo'] || record['codigo'] || record['CodigoExterno'] || record['CODIGO'] || '';
  if (!codigo) return null;

  const monto = parseFloat(record['MontoEstimado'] || record['monto_estimado'] || record['Monto'] || '0') || null;
  const nombre = record['Nombre'] || record['nombre'] || record['NombreLicitacion'] || `Compra Ágil ${codigo}`;
  const organismo = record['NombreOrganismo'] || record['Organismo'] || record['organismo'] || 'No especificado';

  return {
    codigo,
    nombre,
    descripcion: record['Descripcion'] || record['descripcion'] || nombre,
    estado: record['Estado'] || record['estado'] || 'activa',
    fecha_cierre: record['FechaCierre'] || record['fecha_cierre'] || null,
    monto,
    organismo,
    datos_json: {
      source: 'csv_datos_abiertos',
      fecha_publicacion: record['FechaPublicacion'] || record['fecha_publicacion'] || null,
      moneda: record['Moneda'] || record['moneda'] || 'CLP',
      raw: record,
    },
    updated_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Configuración: últimas 168 horas (7 días) para asegurar cobertura
    const now = new Date();
    const hoursBack = 168;
    const dateFrom = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    const dateFromStr = dateFrom.toISOString().split('T')[0];
    const dateToStr = now.toISOString().split('T')[0];

    console.log(`Fetching compras ágiles desde ${dateFromStr} hasta ${dateToStr}`);

    let totalSynced = 0;
    let totalItems = 0;
    const errors: string[] = [];
    let dataSource = 'api';

    // =========================================================================
    // PASO 1: Intentar API hidden con headers browser-like
    // =========================================================================
    const apiResult = await fetchFromApi(dateFromStr, dateToStr);

    if (apiResult.success) {
      console.log(`[API] Primera página OK: ${apiResult.items.length} resultados, ${apiResult.pageCount} páginas`);

      // Procesar primera página
      const allItems: CompraAgilListItem[] = [...apiResult.items];

      // Obtener páginas restantes
      for (let page = 2; page <= apiResult.pageCount && page <= 30; page++) {
        const pageUrl = `${API_BASE}/compra-agil?date_from=${dateFromStr}&date_to=${dateToStr}&order_by=recent&page_number=${page}&status=2`;
        try {
          const pageRes = await fetchWithTimeout(pageUrl, { headers: browserHeaders }, 15000);
          if (pageRes.ok) {
            const pageData = await pageRes.json();
            const resultados: CompraAgilListItem[] = pageData.payload?.resultados || [];
            allItems.push(...resultados);
          } else {
            errors.push(`Error fetching page ${page}: ${pageRes.status}`);
            // Si es 403, dejar de intentar más páginas
            if (pageRes.status === 403) break;
          }
        } catch (pageErr) {
          errors.push(`Error page ${page}: ${pageErr}`);
        }
        // Pausa para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Procesar cada compra ágil
      for (const item of allItems) {
        try {
          // Fetch detalle para obtener productos_solicitados
          const fichaUrl = `${API_BASE}/compra-agil/ficha?code=${item.codigo}`;
          let detalle: CompraAgilDetalle | null = null;

          try {
            const fichaRes = await fetchWithTimeout(fichaUrl, { headers: browserHeaders }, 10000);
            if (fichaRes.ok) {
              const fichaData = await fichaRes.json();
              detalle = fichaData.payload;
            }
          } catch {
            // Detalle no es crítico, continuar sin él
          }

          // Upsert en compras_agiles (columnas reales: monto, organismo).
          // Campos sin columna propia (fecha_publicacion, moneda, etc.) van en datos_json.
          const compraData = {
            codigo: item.codigo,
            nombre: detalle?.nombre || item.nombre,
            descripcion: detalle?.descripcion || item.nombre,
            estado: item.estado,
            fecha_cierre: item.fecha_cierre,
            monto: detalle?.presupuesto_estimado || item.monto_disponible,
            organismo: detalle?.informacion_institucion?.organismo_comprador || item.organismo,
            datos_json: {
              ...item,
              source: 'api_buscador',
              detalle: detalle,
              fecha_publicacion: item.fecha_publicacion,
              moneda: item.moneda,
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
            await supabase
              .from('compras_agiles_items')
              .delete()
              .eq('compra_agil_id', compraId);

            const itemsData = detalle.productos_solicitados.map((p) => ({
              compra_agil_id: compraId,
              codigo_producto: String(p.codigo_producto),
              nombre_producto: p.nombre,
              descripcion: p.descripcion,
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
    } else {
      // =====================================================================
      // PASO 2: Fallback a CSV de datos-abiertos.chilecompra.cl
      // =====================================================================
      console.warn(`[API] Falló: ${apiResult.error}. Intentando fallback CSV...`);
      dataSource = 'csv_fallback';

      const csvResult = await fetchFromCSV();

      if (csvResult.success) {
        console.log(`[CSV] Procesando ${csvResult.records.length} registros`);

        for (const record of csvResult.records) {
          try {
            const compraData = mapCSVRecord(record);
            if (!compraData) continue;

            const { error: compraError } = await supabase
              .from('compras_agiles')
              .upsert(compraData, { onConflict: 'codigo' });

            if (compraError) {
              errors.push(`Error upsert CSV ${compraData.codigo}: ${compraError.message}`);
              continue;
            }

            totalSynced++;
          } catch (recErr) {
            errors.push(`Error CSV record: ${recErr}`);
          }
        }
      } else {
        errors.push(`CSV fallback también falló: ${csvResult.error}`);
      }
    }

    const result = {
      success: errors.length === 0,
      message: `Sync completado: ${totalSynced} compras, ${totalItems} items`,
      data_source: dataSource,
      stats: {
        compras_synced: totalSynced,
        items_synced: totalItems,
        errors_count: errors.length,
      },
      errors: errors.slice(0, 10),
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
