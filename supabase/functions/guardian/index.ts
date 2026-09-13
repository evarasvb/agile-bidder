// =============================================================================
// GUARDIÁN FIRMAVB — monitorea, repara y reporta www.firmavb.cl
//
// Coste: un cron cada 15 min. En una corrida sana gasta 1 consulta SQL + 1 HEAD
// al sitio. Las reparaciones solo se pagan cuando algo está mal.
//
// Cada corrida está ACOTADA: máximo 2 reparaciones y 100 segundos. Lo que no
// alcanza espera al ciclo siguiente. Los turnos se reparten con justicia: a
// igual gravedad, primero el chequeo que lleva más tiempo sin ser atendido.
//
// Dos clases de chequeo, tratadas distinto:
//   episodico  — algo se rompió y se arregla de una vez. Escala por intentos.
//   progresivo — trabajo continuo que avanza por lotes (colas de emparejado).
//                Nunca "termina", así que escala solo si deja de AVANZAR.
//
// Qué chequear y dónde leerlo vive en guardian_config, no aquí: la columna
// `ruta` apunta a un camino dentro del snapshot. Un chequeo nuevo es un INSERT.
//
// Correo: solo en cambios de estado. Nunca manda "todo bien".
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITIO = 'https://www.firmavb.cl';
const FROM = 'FirmaVB <notificaciones@notifications.firmavb.cl>';
const ALERT_TO = 'evaras@firmavb.cl';

const LIMITE_CORRIDA_MS = 100_000;
const MAX_REPARACIONES = 2;
const TIMEOUT_INVOCACION_MS = 20_000;

type Sev = 'ok' | 'warn' | 'error' | 'critical';
const PESO: Record<Sev, number> = { critical: 0, error: 1, warn: 2, ok: 3 };

interface Config {
  check_key: string;
  activo: boolean;
  umbral: number | null;
  comparador: string;
  severidad: Sev;
  auto_reparar: boolean;
  accion: string | null;
  cooldown_min: number;
  max_intentos: number;
  descripcion: string | null;
  tipo: 'episodico' | 'progresivo';
  ruta: string | null;
}

interface Evaluado {
  key: string;
  valor: number | null;
  umbral: number | null;
  sev: Sev;
  mensaje: string;
  cfg: Config;
}

const url = Deno.env.get('SUPABASE_URL')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Ninguna llamada saliente puede colgar al guardián.
async function fetchConTimeout(destino: string, opciones: RequestInit, ms: number): Promise<Response> {
  return await fetch(destino, { ...opciones, signal: AbortSignal.timeout(ms) });
}

// Resuelve "ca.items_sin_evaluar" contra el snapshot.
function porRuta(snap: any, ruta: string): unknown {
  return ruta.split('.').reduce<any>((o, k) => (o === null || o === undefined ? o : o[k]), snap);
}

function extraer(snap: any, cfg: Config, httpSitio: number | null): number | null {
  if (cfg.check_key === 'sitio_http') return httpSitio;
  if (!cfg.ruta) return null;
  const v = porRuta(snap, cfg.ruta);
  return v === null || v === undefined ? null : Number(v);
}

function cumple(valor: number, umbral: number, comparador: string): boolean {
  if (comparador === '>=') return valor >= umbral;
  if (comparador === '<=') return valor <= umbral;
  return valor === umbral;
}

// --- Acciones de reparación --------------------------------------------------
// El escalado a IA quedó fuera a propósito: `matching-ai` espera un lote de
// licitaciones completas más el inventario entero y exige un JWT de usuario;
// llamarla con la clave de servicio y una lista de ítems solo devolvía 401.
async function reparar(db: any, accion: string): Promise<Record<string, unknown>> {
  const invocar = async (fn: string, body: unknown) => {
    try {
      const r = await fetchConTimeout(`${url}/functions/v1/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${service}` },
        body: JSON.stringify(body ?? {}),
      }, TIMEOUT_INVOCACION_MS);
      return { fn, ok: r.ok, status: r.status };
    } catch (err) {
      // Un scraper que tarda más que el timeout igual quedó disparado y sigue
      // trabajando del lado del servidor. No es un fallo de la reparación.
      return { fn, ok: true, disparado_sin_esperar: true, detalle: err instanceof Error ? err.name : String(err) };
    }
  };

  switch (accion) {
    case 'fix_match_flag': {
      const { data, error } = await db.rpc('guardian_fix_match_flag');
      return { accion, filas_corregidas: data ?? 0, error: error?.message ?? null };
    }
    case 'fix_detalle_flag': {
      const { data, error } = await db.rpc('guardian_fix_detalle_flag');
      return { accion, filas_corregidas: data ?? 0, error: error?.message ?? null };
    }
    case 'match_items': {
      const { data, error } = await db.rpc('guardian_match_items', { p_limite: 1000 });
      const { data: subidas } = await db.rpc('guardian_fix_match_flag');
      return { accion, trgm: data ?? null, compras_publicadas: subidas ?? 0, error: error?.message ?? null };
    }
    case 'match_lic_items': {
      const { data, error } = await db.rpc('guardian_match_lic_items', { p_limite: 1500 });
      // El match por ítem solo sirve si sube a la licitación: se encadena.
      const { data: subidas } = await db.rpc('guardian_fix_lic_match_flag');
      return { accion, trgm: data ?? null, licitaciones_publicadas: subidas ?? 0, error: error?.message ?? null };
    }
    case 'fix_lic_match_flag': {
      const { data, error } = await db.rpc('guardian_fix_lic_match_flag');
      return { accion, filas_corregidas: data ?? 0, error: error?.message ?? null };
    }
    case 'enrich_ca_items':
      return { accion, ...(await invocar('enrich-ca-items', { limite: 120, solo_abiertas: true })) };
    // La ingesta vigente es v3 (cron cada 5 min). v2 quedó obsoleto.
    case 'reingesta_ca':
      return { accion, ...(await invocar('fetch-compras-agiles-v3', { max_paginas: 10 })) };
    case 'reingesta_lic_bi':
      return { accion, ...(await invocar('sync-licitaciones-bi', { limite: 200 })) };
    case 'reingesta_oc':
      return { accion, ...(await invocar('sync-ordenes-compra-api', { modo: 'lista' })) };
    default:
      return { accion, error: 'accion desconocida' };
  }
}

async function enviarCorreo(asunto: string, html: string): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return false;
  try {
    const r = await fetchConTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [ALERT_TO], subject: asunto, html }),
    }, 10_000);
    return r.ok;
  } catch {
    return false; // el correo nunca puede tumbar al guardián
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const t0 = Date.now();
  const db = createClient(url, service);

  const { data: snap, error: errSnap } = await db.rpc('guardian_snapshot');
  if (errSnap) {
    return new Response(JSON.stringify({ error: errSnap.message }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  let httpSitio: number | null = null;
  try {
    const r = await fetchConTimeout(SITIO, { method: 'HEAD', redirect: 'follow' }, 10_000);
    httpSitio = r.status;
  } catch {
    httpSitio = 0; // 0 = inalcanzable
  }

  const { data: configs } = await db.from('guardian_config').select('*').eq('activo', true);
  const cfgs: Config[] = configs ?? [];

  const evaluados: Evaluado[] = [];
  for (const cfg of cfgs) {
    const valor = extraer(snap, cfg, httpSitio);
    if (valor === null || cfg.umbral === null) continue;
    const sano = cumple(valor, Number(cfg.umbral), cfg.comparador);
    evaluados.push({
      key: cfg.check_key,
      valor,
      umbral: Number(cfg.umbral),
      sev: sano ? 'ok' : cfg.severidad,
      mensaje: sano
        ? `${cfg.descripcion ?? cfg.check_key}: ${valor}`
        : `${cfg.descripcion ?? cfg.check_key}: ${valor} (se espera ${cfg.comparador} ${cfg.umbral})`,
      cfg,
    });
  }

  // Registrar la corrida ANTES de reparar: así queda constancia aunque una
  // reparación se pase de tiempo.
  const resumen = {
    ok: evaluados.filter((e) => e.sev === 'ok').length,
    warn: evaluados.filter((e) => e.sev === 'warn').length,
    error: evaluados.filter((e) => e.sev === 'error' || e.sev === 'critical').length,
  };
  const { data: run } = await db
    .from('guardian_runs')
    .insert({
      snapshot: { ...snap, sitio_http: httpSitio },
      checks_ok: resumen.ok,
      checks_warn: resumen.warn,
      checks_error: resumen.error,
    })
    .select('id')
    .single();
  const runId = run?.id ?? null;

  if (runId) {
    await db.from('guardian_checks').insert(
      evaluados.map((e) => ({
        run_id: runId,
        check_key: e.key,
        severidad: e.sev,
        valor: e.valor,
        umbral: e.umbral,
        mensaje: e.mensaje,
      })),
    );
  }

  const { data: abiertos } = await db.from('guardian_incidents').select('*').neq('estado', 'resuelto');
  const porKey = new Map<string, any>((abiertos ?? []).map((i: any) => [i.check_key, i]));

  const nuevos: string[] = [];
  const recuperados: string[] = [];
  const escalados: string[] = [];
  const candidatos: Evaluado[] = [];

  for (const e of evaluados) {
    const inc = porKey.get(e.key);

    if (e.sev === 'ok') {
      if (inc) {
        await db
          .from('guardian_incidents')
          .update({ estado: 'resuelto', cerrado_en: new Date().toISOString(), valor_actual: e.valor })
          .eq('id', inc.id);
        recuperados.push(`${e.key} (${e.valor})`);
      }
      continue;
    }

    if (!inc) {
      await db.from('guardian_incidents').insert({
        check_key: e.key,
        severidad: e.sev,
        mensaje: e.mensaje,
        valor_inicial: e.valor,
        valor_actual: e.valor,
        detalle: { umbral: e.umbral, comparador: e.cfg.comparador },
      });
      nuevos.push(e.mensaje);
    } else {
      await db
        .from('guardian_incidents')
        .update({ valor_actual: e.valor, mensaje: e.mensaje, severidad: e.sev })
        .eq('id', inc.id);
    }

    if (e.cfg.auto_reparar && e.cfg.accion) candidatos.push(e);
  }

  // Reparto justo de los turnos: primero lo más grave; a igual gravedad, el que
  // lleva más tiempo sin ser atendido. Sin este desempate los mismos dos
  // chequeos ganaban siempre y el resto nunca reparaba.
  const turno = (k: string) => {
    const t = porKey.get(k)?.ultima_reparacion;
    return t ? new Date(t).getTime() : 0;
  };
  candidatos.sort((a, b) => (PESO[a.sev] - PESO[b.sev]) || (turno(a.key) - turno(b.key)));

  const acciones: unknown[] = [];
  let reparaciones = 0;
  let pospuestas = 0;

  for (const e of candidatos) {
    if (reparaciones >= MAX_REPARACIONES || Date.now() - t0 > LIMITE_CORRIDA_MS) {
      pospuestas++;
      continue;
    }

    const inc = porKey.get(e.key);
    const progresivo = e.cfg.tipo === 'progresivo';
    const intentos = inc?.intentos ?? 0;
    const ultima = inc?.ultima_reparacion ? new Date(inc.ultima_reparacion).getTime() : 0;
    const enfriando = Date.now() - ultima < e.cfg.cooldown_min * 60000;

    // ¿Avanzó respecto del mejor valor visto? Para un progresivo es lo único que
    // importa: llegar a la meta puede tomar días, pero el número debe moverse.
    const mejor = inc?.mejor_valor ?? null;
    const avanzo = mejor === null || mejor === undefined
      ? true
      : e.cfg.comparador === '>=' ? Number(e.valor) > Number(mejor) : Number(e.valor) < Number(mejor);
    const sinProgreso = progresivo && !avanzo ? (inc?.sin_progreso ?? 0) + 1 : 0;

    const agotado = progresivo ? sinProgreso >= e.cfg.max_intentos : intentos >= e.cfg.max_intentos;

    if (agotado) {
      if (inc && inc.estado !== 'escalado') {
        await db.from('guardian_incidents')
          .update({ estado: 'escalado', sin_progreso: sinProgreso })
          .eq('id', inc.id);
        escalados.push(e.mensaje);
      }
      // Un episódico agotado se detiene: insistir solo quema cuota.
      // Un progresivo estancado sigue sondeando cada 6 h por si se destrabó
      // solo. Si vuelve a avanzar sale de escalado sin que nadie intervenga.
      if (!progresivo || Date.now() - ultima < 6 * 3600 * 1000) continue;
    } else if (enfriando) {
      continue;
    }

    const resultado = await reparar(db, e.cfg.accion!);
    reparaciones++;
    acciones.push({ check: e.key, ...resultado });

    await db
      .from('guardian_incidents')
      .update({
        estado: agotado && !avanzo ? 'escalado' : 'reparando',
        intentos: intentos + 1,
        sin_progreso: sinProgreso,
        mejor_valor: avanzo ? e.valor : mejor,
        ultima_reparacion: new Date().toISOString(),
        detalle: { umbral: e.umbral, ultima_accion: resultado },
      })
      .eq('check_key', e.key)
      .neq('estado', 'resuelto');
  }

  if (runId) {
    await db.from('guardian_runs').update({ reparaciones, duracion_ms: Date.now() - t0 }).eq('id', runId);
  }

  let correo = false;
  if (nuevos.length || escalados.length || recuperados.length) {
    const bloque = (titulo: string, items: string[], color: string) =>
      items.length
        ? `<h3 style="color:${color};margin:16px 0 6px">${titulo}</h3><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`
        : '';
    const asunto = escalados.length
      ? `FirmaVB: ${escalados.length} incidente(s) requieren revision manual`
      : nuevos.length
        ? `FirmaVB: ${nuevos.length} alerta(s) nueva(s)`
        : `FirmaVB: sistema recuperado`;
    correo = await enviarCorreo(
      asunto,
      `<div style="font-family:system-ui,sans-serif;max-width:620px">
         <h2>Guardian FirmaVB</h2>
         ${bloque('Requieren tu revision', escalados, '#dc2626')}
         ${bloque('Alertas nuevas', nuevos, '#f59e0b')}
         ${bloque('Recuperado automaticamente', recuperados, '#16a34a')}
         <p style="margin-top:18px">Compras agiles abiertas: <b>${snap?.ca?.abiertas ?? '-'}</b> &middot;
            con items: <b>${snap?.ca?.items_cobertura ?? '-'}%</b> &middot;
            items ingresados (1 h): <b>${snap?.ca?.items_insertados_1h ?? '-'}</b></p>
         <p>Licitaciones abiertas: <b>${snap?.licitaciones?.bi_abiertas ?? '-'}</b> &middot;
            con match: <b>${snap?.licitaciones?.bi_abiertas_match ?? '-'}</b> &middot;
            cola de items: <b>${snap?.licitaciones?.items_sin_evaluar ?? '-'}</b></p>
         <p style="color:#94a3b8;font-size:12px">Reparaciones en esta corrida: ${reparaciones} &middot; pospuestas: ${pospuestas} &middot; ${new Date().toISOString()}</p>
       </div>`,
    );
  }

  return new Response(
    JSON.stringify({
      run_id: runId,
      resumen,
      snapshot: snap,
      sitio_http: httpSitio,
      reparaciones,
      pospuestas,
      acciones,
      nuevos,
      recuperados,
      escalados,
      correo_enviado: correo,
      duracion_ms: Date.now() - t0,
    }),
    { headers: { ...cors, 'Content-Type': 'application/json' }, status: 200 },
  );
});
