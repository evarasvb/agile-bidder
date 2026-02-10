/**
 * SYNC COMPRAS ÁGILES - Script standalone para GitHub Actions
 * 
 * NO depende de Edge Functions. Corre directo en Node.js.
 * 1. Obtiene JWT público de servicios-prd.mercadopublico.cl
 * 2. Llama a api.buscador.mercadopublico.cl/compra-agil
 * 3. Escribe directo a Supabase con @supabase/supabase-js
 * 
 * Env vars requeridas: SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js';

// ====== Config ======
const AUTH_URL = 'https://servicios-prd.mercadopublico.cl/v1/auth/publico';
const API_BASE = 'https://api.buscador.mercadopublico.cl';
const API_KEY = 'e93089e4-437c-4723-b343-4fa20045e3bc';
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Origin': 'https://buscador.mercadopublico.cl',
  'Referer': 'https://buscador.mercadopublico.cl/',
  'Accept': 'application/json',
};

// ====== Supabase ======
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://juiskeeutbaipwbeeezw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ====== Helpers ======
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function obtenerToken(): Promise<string> {
  console.log('[AUTH] Obteniendo token JWT público...');
  const res = await fetch(AUTH_URL, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  const token = data?.payload?.access_token;
  if (!token) throw new Error('Token no encontrado en respuesta');
  console.log(`[AUTH] Token obtenido (expira en ${data.payload.expires_in}s)`);
  return token;
}

async function fetchAPI(url: string, token: string) {
  const res = await fetch(url, {
    headers: { ...BROWSER_HEADERS, 'Authorization': `Bearer ${token}`, 'x-api-key': API_KEY },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// ====== Main ======
async function main() {
  const startTime = Date.now();
  console.log('========================================');
  console.log('SYNC COMPRAS ÁGILES - Standalone');
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log('========================================\n');

  // Config
  const HOURS_BACK = parseInt(process.env.HOURS_BACK || '48');
  const MAX_PAGES = parseInt(process.env.MAX_PAGES || '50');
  const FETCH_DETAILS = process.env.FETCH_DETAILS !== 'false';

  const now = new Date();
  const dateFrom = new Date(now.getTime() - HOURS_BACK * 60 * 60 * 1000);
  const dateFromStr = dateFrom.toISOString().split('T')[0];
  const dateToStr = now.toISOString().split('T')[0];
  
  console.log(`Rango: ${dateFromStr} a ${dateToStr} (${HOURS_BACK}h atrás)`);
  console.log(`Max páginas: ${MAX_PAGES}, Detalles: ${FETCH_DETAILS}\n`);

  // Paso 1: Token
  const token = await obtenerToken();

  // Paso 2: Iterar páginas
  let page = 1;
  let pageCount = 1;
  let totalSynced = 0;
  let totalItems = 0;
  let totalNew = 0;
  let totalUpdated = 0;
  const errors: string[] = [];

  while (page <= pageCount && page <= MAX_PAGES) {
    const listUrl = `${API_BASE}/compra-agil?date_from=${dateFromStr}&date_to=${dateToStr}&order_by=recent&page_number=${page}`;
    console.log(`[LIST] Página ${page}/${pageCount}...`);

    try {
      const listData = await fetchAPI(listUrl, token);
      const payload = listData?.payload;

      if (page === 1) {
        pageCount = Math.min(payload?.pageCount || 1, MAX_PAGES);
        console.log(`[LIST] Total: ${payload?.resultCount} resultados en ${pageCount} páginas`);
      }

      const resultados = payload?.resultados || [];

      for (const item of resultados) {
        try {
          let detalle: any = null;

          if (FETCH_DETAILS) {
            try {
              const fichaUrl = `${API_BASE}/compra-agil?action=ficha&code=${item.codigo}`;
              const fichaData = await fetchAPI(fichaUrl, token);
              detalle = fichaData?.payload;
              await sleep(80);
            } catch (e: any) {
              // Continuar sin detalle
            }
          }

          // Check si existe
          const { data: existing } = await supabase
            .from('compras_agiles')
            .select('id')
            .eq('codigo', item.codigo)
            .maybeSingle();

          // Upsert
          const compraData: Record<string, any> = {
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
              unidad: item.unidad,
              id_estado: item.id_estado,
              monto_disponible: item.monto_disponible,
              monto_disponible_CLP: item.monto_disponible_CLP,
              cantidad_proveedores: item.cantidad_proveedores_cotizando,
              direccion_entrega: detalle?.direccion_entrega || null,
              plazo_entrega: detalle?.plazo_entrega || null,
              rut_organismo: detalle?.informacion_institucion?.rut_organismo_comprador || null,
              division: detalle?.informacion_institucion?.division || null,
              sync_source: 'github-actions',
              sync_timestamp: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          };

          const { data: compraResult, error: compraError } = await supabase
            .from('compras_agiles')
            .upsert(compraData, { onConflict: 'codigo' })
            .select('id')
            .single();

          if (compraError) {
            errors.push(`Upsert ${item.codigo}: ${compraError.message}`);
            continue;
          }

          existing ? totalUpdated++ : totalNew++;
          const compraId = compraResult?.id;

          // Items
          if (detalle?.productos_solicitados?.length > 0 && compraId) {
            await supabase.from('compras_agiles_items').delete().eq('compra_agil_id', compraId);
            const itemsData = detalle.productos_solicitados.map((p: any) => ({
              compra_agil_id: compraId,
              codigo_producto: String(p.codigo_producto),
              nombre_producto: p.nombre,
              descripcion_producto: p.descripcion,
              cantidad: p.cantidad,
              unidad: p.unidad_medida,
            }));
            const { error: itemsError } = await supabase.from('compras_agiles_items').insert(itemsData);
            if (itemsError) {
              errors.push(`Items ${item.codigo}: ${itemsError.message}`);
            } else {
              totalItems += itemsData.length;
            }
          }

          totalSynced++;
        } catch (e: any) {
          errors.push(`${item.codigo}: ${e.message}`);
        }
      }
    } catch (e: any) {
      errors.push(`Página ${page}: ${e.message}`);
    }

    page++;
    await sleep(200);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n========================================');
  console.log('RESULTADO SYNC COMPRAS ÁGILES');
  console.log('========================================');
  console.log(`Compras sincronizadas: ${totalSynced} (${totalNew} nuevas, ${totalUpdated} actualizadas)`);
  console.log(`Items sincronizados: ${totalItems}`);
  console.log(`Páginas procesadas: ${page - 1}/${pageCount}`);
  console.log(`Errores: ${errors.length}`);
  console.log(`Tiempo: ${elapsed}s`);
  
  if (errors.length > 0) {
    console.log('\nPrimeros errores:');
    errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
  }

  console.log('========================================\n');

  if (errors.length > 0 && totalSynced === 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('ERROR FATAL:', err);
  process.exit(1);
});
