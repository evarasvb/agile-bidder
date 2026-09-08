// Enriquecimiento de ÓRDENES DE COMPRA: baja el detalle (proveedor, comprador,
// montos y LÍNEAS DE PRODUCTO) desde la API pública de MercadoPúblico y lo guarda
// en ordenes_compra + ordenes_compra_items. Corre por cron cada 2 minutos con un
// presupuesto de tiempo (gentil con la API, con reintento ante 429). Idempotente.
//
// Cola: TODAS las cabeceras sin organismo (no solo las `relevante`): sin el detalle
// no se sabe quién compra, a quién ni qué. Se atienden primero las relevantes y,
// dentro de cada grupo, las más recientes, para que las OC del día queden completas
// el mismo día. Las que la API no conoce se marcan `stale` y salen de la cola.
// body: { limit?: 1..120 (60), tipo?: 'todos' | 'convenio_marco', presupuesto_ms?: n }
// Requiere el secreto MERCADOPUBLICO_API_KEY (ticket).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MP_BASE = 'https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
function fecha(v: unknown): string | null {
  if (!v || typeof v !== 'string') return null;
  const s = v.trim();
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

// Fetch con reintento ante 429/5xx (el ticket de MP lo comparten varios crons).
async function fetchOC(url: string): Promise<Response | null> {
  let espera = 1000;
  for (let intento = 0; intento < 4; intento++) {
    const resp = await fetch(url);
    if (resp.status !== 429 && resp.status < 500) return resp;
    await sleep(espera);
    espera *= 2;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const ticket = Deno.env.get('MERCADOPUBLICO_API_KEY') || '';
    if (!ticket) return json({ error: 'Falta MERCADOPUBLICO_API_KEY' }, 500);

    const body = await req.json().catch(() => ({} as any));
    const limite = Math.min(Math.max(Number(body.limit) || 60, 1), 120);
    const tipo = (body.tipo || 'todos') as string;
    // El cron dispara cada 2 min: la corrida se corta antes para no pisarse con la siguiente.
    const presupuesto = Math.min(Math.max(Number(body.presupuesto_ms) || 100_000, 10_000), 140_000);
    const t0 = Date.now();

    // Cola: cabeceras sin organismo (detalle no bajado), relevantes primero, más nuevas primero.
    let q = admin.from('ordenes_compra').select('codigo')
      .is('organismo_comprador', null)
      .or('stale.is.null,stale.eq.false');
    if (tipo === 'convenio_marco') q = q.ilike('codigo', '%-CM%');
    const { data: pend, error: perr } = await q
      .order('relevante', { ascending: false, nullsFirst: false })
      .order('fecha_envio_oc', { ascending: false, nullsFirst: false })
      .limit(limite);
    if (perr) return json({ error: perr.message }, 500);
    const codigos = (pend || []).map((r: any) => r.codigo).filter(Boolean);
    if (codigos.length === 0) return json({ ok: true, procesadas: 0, mensaje: 'nada pendiente' });

    let procesadas = 0, items_insertados = 0, errores = 0, rate_limited = 0;
    let ultimo_error: string | null = null;

    for (const codigo of codigos) {
      if (Date.now() - t0 > presupuesto) break;
      try {
        const resp = await fetchOC(`${MP_BASE}?codigo=${encodeURIComponent(codigo)}&ticket=${ticket}`);
        if (!resp) { rate_limited++; ultimo_error = `rate-limit ${codigo}`; await sleep(800); continue; }
        if (!resp.ok) {
          await admin.from('ordenes_compra').update({ last_scraped_at: new Date().toISOString(), stale: true }).eq('codigo', codigo);
          errores++; ultimo_error = `HTTP ${resp.status} ${codigo}`; await sleep(500); continue;
        }
        const data = await resp.json();
        const L = Array.isArray(data?.Listado) ? data.Listado[0] : null;
        if (!L) {
          await admin.from('ordenes_compra').update({ last_scraped_at: new Date().toISOString(), stale: true }).eq('codigo', codigo);
          await sleep(500); continue;
        }

        const comprador = L.Comprador || {};
        const proveedor = L.Proveedor || {};
        const fechas = L.Fechas || {};
        const total = num(L.Total) ?? num(L.MontoBruto);

        const { error: updErr } = await admin.from('ordenes_compra').update({
          numero_oc: L.Codigo || codigo,
          proveedor: proveedor.Nombre ?? null,
          proveedor_nombre: proveedor.Nombre ?? null,
          rut_proveedor: proveedor.RutSucursal || proveedor.CodigoEmpresa || null,
          demandante: comprador.NombreOrganismo ?? null,
          organismo_comprador: comprador.NombreOrganismo ?? null,
          rut_demandante: comprador.RutUnidadCompra || comprador.CodigoOrganismo || null,
          unidad_compra: comprador.NombreUnidad ?? null,
          numero_licitacion: L.CodigoLicitacion ?? null,
          neto: num(L.MontoNeto) ?? num(L.TotalNeto),
          total: total,
          monto_total: total,
          moneda: L.Moneda ?? null,
          fecha_emision: fecha(fechas.FechaEnvio || fechas.FechaCreacion || fechas.FechaAceptacion),
          raw_json: L,
          last_scraped_at: new Date().toISOString(),
          stale: false,
        }).eq('codigo', codigo);
        if (updErr) { ultimo_error = `update ${codigo}: ${updErr.message}`; errores++; await sleep(500); continue; }

        await admin.from('ordenes_compra_items').delete().eq('numero_oc', codigo);
        const lista = L.Items?.Listado || (Array.isArray(L.Items) ? L.Items : []);
        if (Array.isArray(lista) && lista.length) {
          const filas = lista.map((it: any) => ({
            numero_oc: codigo,
            codigo_producto: (it.CodigoProducto ?? it.CodigoCategoria ?? null)?.toString() || null,
            producto: it.Producto || it.EspecificacionComprador || null,
            cantidad: num(it.Cantidad),
            unidad: it.Unidad ?? null,
            precio_unitario: num(it.PrecioNeto) ?? num(it.PrecioUnitario),
            descuento: num(it.TotalDescuentos),
            cargos: num(it.TotalCargos),
            valor_total: num(it.Total) ?? num(it.TotalNeto),
            especificaciones: it.EspecificacionComprador || null,
            raw_json: it,
          }));
          const { error: ierr } = await admin.from('ordenes_compra_items').insert(filas);
          if (ierr) ultimo_error = `items ${codigo}: ${ierr.message}`;
          else items_insertados += filas.length;
        }
        procesadas++;
        await sleep(350);
      } catch (e) {
        errores++; ultimo_error = `catch ${codigo}: ${e instanceof Error ? e.message : String(e)}`;
        await sleep(500);
      }
    }

    return json({ ok: true, procesadas, items_insertados, errores, rate_limited, lote: codigos.length, ms: Date.now() - t0, ultimo_error });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
