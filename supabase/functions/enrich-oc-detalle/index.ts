// Enriquecimiento de ÓRDENES DE COMPRA: baja el detalle (proveedor, comprador,
// montos y LÍNEAS DE PRODUCTO) desde la API pública de MercadoPúblico y lo guarda
// en ordenes_compra + ordenes_compra_items. Corre por cron cada 5 minutos con un
// presupuesto de tiempo (gentil con la API, con reintento ante 429). Idempotente.
//
// Cola: TODAS las cabeceras sin organismo (no solo las `relevante`): sin el detalle
// no se sabe quién compra, a quién ni qué. Se atienden primero las relevantes y,
// dentro de cada grupo, las más recientes, para que las OC del día queden completas
// el mismo día. Las que la API no conoce se marcan `stale` y salen de la cola.
// body: { limit?: 1..120 (60), tipo?: 'todos' | 'convenio_marco', presupuesto_ms?: n, cupo_diario?: n (6000), probe?: bool }
// Cuota: el ticket de MP tiene cuota diaria compartida; este robot se limita a `cupo_diario`
// llamadas por día (día Chile) y se pausa 30 min si la API responde "superó la cuota".
// Ticket: primero el dedicado en la bóveda ('mercadopublico_ticket_oc', vía public.secreto_vault);
// si no existe, el general MERCADOPUBLICO_API_KEY que comparten los demás robots.

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

// Fetch con reintento ante 429/5xx (el ticket de MP lo comparten varios crons) y tope de
// espera por llamada: en hora punta la API se cuelga sin responder y una sola llamada
// colgada se comía el presupuesto entero de la corrida (procesadas 0).
const TIMEOUT_MS = 15_000;
async function fetchOC(url: string): Promise<Response | null | 'timeout'> {
  let espera = 1000;
  for (let intento = 0; intento < 3; intento++) {
    let resp: Response;
    try {
      resp = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (_) {
      return 'timeout';
    }
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
    const body = await req.json().catch(() => ({} as any));
    // Ticket dedicado (bóveda, nombre en body.ticket_vault o 'mercadopublico_ticket_oc'); si no existe,
    // el ticket general de MERCADOPUBLICO_API_KEY, que comparten los demás robots.
    const nombreVault = String(body.ticket_vault || 'mercadopublico_ticket_oc');
    const { data: ticketVault } = await admin.rpc('secreto_vault', { p_nombre: nombreVault });
    const ticketDedicado = typeof ticketVault === 'string' && ticketVault.trim().length >= 20;
    const ticket = ticketDedicado ? ticketVault.trim() : (Deno.env.get('MERCADOPUBLICO_API_KEY') || '');
    if (!ticket) return json({ error: 'Falta MERCADOPUBLICO_API_KEY' }, 500);

    const limite = Math.min(Math.max(Number(body.limit) || 60, 1), 120);
    const tipo = (body.tipo || 'todos') as string;
    // El cron dispara cada 5 min: la corrida se corta antes para no pisarse con la siguiente.
    const presupuesto = Math.min(Math.max(Number(body.presupuesto_ms) || 100_000, 10_000), 140_000);
    const t0 = Date.now();

    // Cuota diaria del ticket de MP (la comparten varios robots). Se lleva el conteo del día en
    // ingesta_ca_estado (clave oc_detalle): pagina_actual = llamadas hechas hoy; ultimo_error =
    // 'cuota' cuando la API respondió "Ticket superó la cuota diaria" (se pausa 30 min).
    const diaChile = (d: string | number | Date) => new Date(new Date(d).getTime() - 4 * 3600 * 1000).toISOString().slice(0, 10); // UTC-4
    const DIA = diaChile(Date.now());
    const cupoDiario = Math.min(Math.max(Number(body.cupo_diario) || 6000, 100), 20000);
    const { data: est } = await admin.from('ingesta_ca_estado').select('pagina_actual, ultimo_error, ultima_corrida, updated_at').eq('clave', 'oc_detalle').maybeSingle();
    const mismoDia = !!est?.updated_at && diaChile(est.updated_at) === DIA;
    let usadasHoy = mismoDia ? Number(est?.pagina_actual || 0) : 0;
    if (!body.probe) {
      if (mismoDia && est?.ultimo_error === 'cuota' && est?.ultima_corrida && Date.now() - new Date(est.ultima_corrida).getTime() < 30 * 60000) {
        return json({ ok: true, procesadas: 0, omitido: true, motivo: 'cuota diaria agotada (pausa 30 min)', usadas_hoy: usadasHoy });
      }
      if (usadasHoy >= cupoDiario) return json({ ok: true, procesadas: 0, omitido: true, motivo: `cupo diario propio alcanzado (${usadasHoy}/${cupoDiario})` });
    }
    const guardarEstado = async (marcaCuota: boolean) => {
      await admin.from('ingesta_ca_estado').upsert({
        clave: 'oc_detalle', pagina_actual: usadasHoy, ultima_corrida: new Date().toISOString(),
        ultimo_error: marcaCuota ? 'cuota' : null, updated_at: new Date().toISOString(),
      }, { onConflict: 'clave' });
    };

    // Cola: cabeceras sin organismo (detalle no bajado), relevantes primero, más nuevas primero.
    let q = admin.from('ordenes_compra').select('codigo')
      .is('organismo_comprador', null)
      .or('stale.is.null,stale.eq.false');
    if (tipo === 'convenio_marco') q = q.ilike('codigo', '%-CM%');
    const { data: pend, error: perr } = await q
      .order('relevante', { ascending: false, nullsFirst: false })
      .order('fecha_envio_oc', { ascending: false, nullsFirst: false })
      .limit(Math.min(limite, Math.max(1, cupoDiario - usadasHoy)));
    if (perr) return json({ error: perr.message }, 500);
    const codigos = (pend || []).map((r: any) => r.codigo).filter(Boolean);
    if (codigos.length === 0) return json({ ok: true, procesadas: 0, mensaje: 'nada pendiente' });

    // Modo sonda: devuelve la respuesta cruda de la API para el primer código (diagnóstico).
    if (body.probe === true) {
      const codigo = body.codigo || codigos[0];
      const t1 = Date.now();
      const resp = await fetchOC(`${MP_BASE}?codigo=${encodeURIComponent(codigo)}&ticket=${ticket}`);
      if (resp === 'timeout' || !resp) return json({ probe: true, codigo, resultado: resp === 'timeout' ? 'timeout' : 'rate-limit', ms: Date.now() - t1 });
      const texto = await resp.text();
      return json({ probe: true, codigo, ticket_dedicado: ticketDedicado, status: resp.status, ms: Date.now() - t1, cuerpo: texto.slice(0, 800) });
    }

    let procesadas = 0, items_insertados = 0, errores = 0, rate_limited = 0, timeouts = 0, sin_detalle = 0, stale = 0;
    let ultimo_error: string | null = null;

    let cuotaAgotada = false;
    for (const codigo of codigos) {
      if (Date.now() - t0 > presupuesto) break;
      try {
        usadasHoy++;
        const resp = await fetchOC(`${MP_BASE}?codigo=${encodeURIComponent(codigo)}&ticket=${ticket}`);
        // La OC no se marca: vuelve a la cola para cuando la API responda.
        if (resp === 'timeout') { timeouts++; ultimo_error = `timeout ${codigo}`; if (timeouts >= 5) break; continue; }
        if (!resp) { rate_limited++; ultimo_error = `rate-limit ${codigo}`; await sleep(800); continue; }
        if (!resp.ok) {
          await admin.from('ordenes_compra').update({ last_scraped_at: new Date().toISOString(), stale: true }).eq('codigo', codigo);
          errores++; ultimo_error = `HTTP ${resp.status} ${codigo}`; await sleep(500); continue;
        }
        const data = await resp.json();
        const L = Array.isArray(data?.Listado) ? data.Listado[0] : null;
        if (!L) {
          // 200 sin Listado: si la API trae un Mensaje (cuota, mantención) NO es que la OC no exista.
          // Se deja en cola y, si se repite, la corrida cede el turno. Solo con Cantidad 0 real se marca stale.
          if (data?.Mensaje || data?.Codigo === 500 || data?.Cantidad === undefined) {
            sin_detalle++; ultimo_error = `sin listado ${codigo}: ${String(data?.Mensaje ?? JSON.stringify(data)).slice(0, 120)}`;
            if (/cuota/i.test(String(data?.Mensaje || ''))) { cuotaAgotada = true; break; }
            if (sin_detalle >= 5) break;
            await sleep(1500); continue;
          }
          await admin.from('ordenes_compra').update({ last_scraped_at: new Date().toISOString(), stale: true, stale_marked_at: new Date().toISOString() }).eq('codigo', codigo);
          stale++;
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

    await guardarEstado(cuotaAgotada);
    return json({ ok: true, procesadas, items_insertados, errores, rate_limited, timeouts, sin_detalle, stale, cuota_agotada: cuotaAgotada, usadas_hoy: usadasHoy, cupo_diario: cupoDiario, ticket_dedicado: ticketDedicado, lote: codigos.length, ms: Date.now() - t0, ultimo_error });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
