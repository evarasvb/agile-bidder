// Sync de la Tasa Máxima Convencional (TMC) desde la API oficial de la CMF hacia
// interes_mora_cmf, que alimenta el cálculo de interés por mora de la cobranza.
// Fuente: https://api.cmfchile.cl/api-sbifv3/recursos_api/tmc/{año}/{mes}
//
// Carga la MÁXIMA CONVENCIONAL de "operaciones no reajustables en moneda nacional
// 90 días o más", por tramo de UF (convertido a pesos con la UF del día 15, fecha
// de vigencia de la TMC). Un mes = 4 tramos.
//
// SEGURIDAD DE DATOS (van en documentos legales):
//   - Lee la API key de CMF_API_KEY (env) o de app_config (service_role).
//   - DRY-RUN por defecto: no escribe. Escribe solo con commit=true.
//   - commit requiere el secreto TMC_SYNC_SECRET (body.secret) para no quedar
//     como endpoint de escritura abierto.
//   - Antes de escribir SIEMPRE revalida un ANCLA conocida (sept 2026); si el
//     parseo no reproduce los valores oficiales, aborta sin escribir.
//   - Reemplaza (delete+insert) los meses que carga, para no dejar tramos viejos
//     con umbrales de UF distintos.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } }); }

const API = 'https://api.cmfchile.cl/api-sbifv3/recursos_api';

// Tipos CMF de "no reajustable ≥90 días" por tramo de UF.
const TRAMOS = [
  { tipo: '45', ufDesde: 0, ufHasta: 50 },
  { tipo: '44', ufDesde: 50, ufHasta: 200 },
  { tipo: '35', ufDesde: 200, ufHasta: 5000 },
  { tipo: '34', ufDesde: 5000, ufHasta: null as number | null },
];
// Ancla de integridad del parseo: valores oficiales conocidos (sept 2026).
const ANCLA_Y = 2026, ANCLA_M = 9;
const ANCLA_VALORES: Record<string, number> = { '45': 41.06, '44': 34.06, '35': 30.09, '34': 9.96 };

async function cmfJson(recurso: string, key: string): Promise<{ status: number; data: any }> {
  // La CMF a veces corta la conexión a mitad de respuesta: reintenta.
  let ultimo: unknown = null;
  for (let intento = 0; intento < 4; intento++) {
    try {
      const r = await fetch(`${API}/${recurso}?apikey=${key}&formato=json`);
      const t = await r.text();
      if (r.status >= 500) { ultimo = new Error(`status ${r.status}`); await new Promise((s) => setTimeout(s, 400)); continue; }
      try { return { status: r.status, data: JSON.parse(t) }; } catch { return { status: r.status, data: null }; }
    } catch (e) {
      ultimo = e;
      await new Promise((s) => setTimeout(s, 400));
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error(String(ultimo));
}
const parseUF = (s: string) => Number(String(s).split('.').join('').replace(',', '.')); // "40.934,58" -> 40934.58
const pad = (n: number) => String(n).padStart(2, '0');

async function tasasMes(year: number, month: number, key: string): Promise<{ byTipo: Record<string, number>; uf: number } | { error: string }> {
  const tmc = await cmfJson(`tmc/${year}/${month}`, key);
  if (tmc.status !== 200 || !Array.isArray(tmc.data?.TMCs)) return { error: `tmc ${year}-${month} status ${tmc.status}` };
  const byTipo: Record<string, number> = {};
  for (const e of tmc.data.TMCs) if (e?.Tipo != null) byTipo[String(e.Tipo)] = Number(e.Valor);
  for (const t of TRAMOS) if (byTipo[t.tipo] == null || !isFinite(byTipo[t.tipo])) return { error: `falta tipo ${t.tipo} en ${year}-${month}` };

  const uf = await cmfJson(`uf/${year}/${month}`, key);
  if (!Array.isArray(uf.data?.UFs) || !uf.data.UFs.length) return { error: `uf ${year}-${month} no disponible` };
  const d15 = uf.data.UFs.find((u: any) => u.Fecha === `${year}-${pad(month)}-15`);
  const ufVal = parseUF((d15 ?? uf.data.UFs[uf.data.UFs.length - 1]).Valor);
  if (!isFinite(ufVal) || ufVal <= 0) return { error: `uf ${year}-${month} inválida` };
  return { byTipo, uf: ufVal };
}

function filasMes(year: number, month: number, byTipo: Record<string, number>, uf: number) {
  const mes = `${year}-${pad(month)}-01`;
  const fuente = `${API}/tmc/${year}/${month} (máxima convencional, no reajustable ≥90 días)`;
  return TRAMOS.map((t, i) => ({
    mes,
    monto_desde: i === 0 ? 0 : Math.floor(t.ufDesde * uf) + 1,
    monto_hasta: t.ufHasta == null ? null : Math.floor(t.ufHasta * uf),
    tasa_anual: byTipo[t.tipo],
    fuente_url: fuente,
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));

    const { data: cfg } = await db.from('app_config').select('clave, valor').in('clave', ['CMF_API_KEY', 'TMC_SYNC_SECRET']);
    const map: Record<string, string> = Object.fromEntries((cfg ?? []).map((c: any) => [c.clave, c.valor]));
    const key = Deno.env.get('CMF_API_KEY') || map['CMF_API_KEY'];
    if (!key) return json({ error: 'falta_api_key', mensaje: 'Carga CMF_API_KEY en app_config.' }, 412);

    const commit = body.commit === true;
    const secret = map['TMC_SYNC_SECRET'];
    // Si el secreto no está configurado (o no se pudo leer), NUNCA autorizar un
    // commit: body.secret vacío === map vacío autorizaría un commit anónimo.
    if (commit && (!secret || body.secret !== secret)) return json({ error: 'no_autorizado' }, 403);

    // Rango de meses (YYYY-MM). Default: solo el mes actual.
    const now = new Date();
    const parse = (s: unknown, dy: number, dm: number): [number, number] => {
      if (!s) return [dy, dm];
      const [y, m] = String(s).split('-').map(Number);
      return [y || dy, m || dm];
    };
    const [y0, m0] = parse(body.desde, now.getUTCFullYear(), now.getUTCMonth() + 1);
    const [y1, m1] = parse(body.hasta, now.getUTCFullYear(), now.getUTCMonth() + 1);

    const meses: [number, number][] = [];
    let yy = y0, mm = m0;
    while ((yy < y1 || (yy === y1 && mm <= m1)) && meses.length < 120) { meses.push([yy, mm]); if (++mm > 12) { mm = 1; yy++; } }

    const filas: any[] = [], errores: string[] = [], ok: string[] = [];
    for (const [y, m] of meses) {
      const r = await tasasMes(y, m, key);
      if ('error' in r) { errores.push(r.error); continue; }
      filas.push(...filasMes(y, m, r.byTipo, r.uf));
      ok.push(`${y}-${pad(m)}`);
    }

    // Revalidación de integridad del parseo contra el ancla conocida (siempre en commit).
    let validado = true, validacion = 'no verificado';
    if (commit || body.validar) {
      const a = await tasasMes(ANCLA_Y, ANCLA_M, key);
      if ('error' in a) { validado = false; validacion = `no se pudo leer el ancla: ${a.error}`; }
      else {
        validado = Object.entries(ANCLA_VALORES).every(([t, v]) => Math.abs((a.byTipo[t] ?? -1) - v) < 0.001);
        validacion = validado ? 'ancla sept-2026 OK' : 'ANCLA NO COINCIDE (posible cambio de formato CMF): se aborta';
      }
    }

    if (!commit) return json({ ok: true, dry_run: true, meses: ok.length, validacion, muestra: filas.slice(0, 8), errores });
    if (!validado) return json({ ok: false, error: 'validacion_fallida', validacion, errores }, 409);
    if (!filas.length) return json({ ok: false, error: 'sin_datos', errores }, 502);

    // Reemplaza los meses cargados. El cron mensual reprocesa, y el motor trata
    // los meses faltantes como 'incompleto' (no como dato erróneo), así que una
    // falla transitoria entre el delete y el insert se autocorrige en la próxima
    // corrida sin cargar tasas equivocadas.
    const mesesSet = [...new Set(filas.map((f) => f.mes))];
    const del = await db.from('interes_mora_cmf').delete().in('mes', mesesSet);
    if (del.error) return json({ ok: false, error: del.error.message }, 500);
    const ins = await db.from('interes_mora_cmf').insert(filas);
    if (ins.error) return json({ ok: false, error: ins.error.message }, 500);

    return json({ ok: true, meses: ok.length, filas: filas.length, validacion, errores });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
