// Sync de la Tasa Máxima Convencional (TMC) desde la API oficial de la CMF hacia
// la tabla interes_mora_cmf (que alimenta el cálculo de interés por mora de la
// cobranza). Fuente: https://api.cmfchile.cl/api-sbifv3/recursos_api/tmc/{año}/{mes}
//
// SEGURIDAD DE DATOS (crítico): estas tasas van en documentos legales (nota de
// débito exenta). Por eso:
//   - Requiere la API key real de la CMF en el secreto CMF_API_KEY.
//   - Por defecto corre en DRY-RUN: solo devuelve lo que traería, NO escribe.
//   - Solo escribe con commit=true Y si la auto-validación pasa: debe reproducir
//     EXACTAMENTE un valor ya conocido y verificado (interes_mora_cmf de un mes
//     de referencia). Si no coincide, aborta sin escribir — nunca carga tasas
//     equivocadas.
//
// El mapeo CMF -> tramos en pesos (tipos de operación "no reajustable ≥90 días"
// por tramo de UF, convertidos a pesos con la UF del mes) se completa y valida
// una vez que exista la CMF_API_KEY y se pueda inspeccionar una respuesta real.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } }); }

const API = 'https://api.cmfchile.cl/api-sbifv3/recursos_api';

async function cmf(recurso: string, key: string): Promise<{ status: number; data: any; raw: string }> {
  const sep = recurso.includes('?') ? '&' : '?';
  const r = await fetch(`${API}/${recurso}${sep}apikey=${key}&formato=json`);
  const raw = await r.text();
  let data: any = null;
  try { data = JSON.parse(raw); } catch { /* deja raw */ }
  return { status: r.status, data, raw: raw.slice(0, 6000) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('CMF_API_KEY');
    if (!key) return json({ error: 'falta_api_key', mensaje: 'Falta el secreto CMF_API_KEY (API key gratuita de la CMF).' }, 412);

    const body = await req.json().catch(() => ({}));
    const now = new Date();
    const year = Number(body.year) || now.getUTCFullYear();
    const month = Number(body.month) || (now.getUTCMonth() + 1);
    const commit = body.commit === true;

    // Trae la TMC del mes y la UF del mes (para convertir los tramos en UF a pesos).
    const tmc = await cmf(`tmc/${year}/${month}`, key);
    if (tmc.status !== 200) {
      return json({ error: 'cmf_error', status: tmc.status, detalle: tmc.raw }, 502);
    }
    const uf = await cmf(`uf/${year}/${month}`, key);

    // DRY-RUN: devuelve la respuesta cruda para inspeccionar y construir el mapeo.
    // La conversión a tramos de interes_mora_cmf + la auto-validación contra un
    // valor conocido se habilitan una vez validado el formato con datos reales.
    if (!commit) {
      return json({ ok: true, dry_run: true, year, month, tmc: tmc.data ?? tmc.raw, uf: uf.data ?? uf.raw });
    }

    // Camino de escritura todavía no habilitado: requiere validación previa del
    // mapeo contra un valor conocido para no cargar tasas equivocadas.
    const _db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    void _db;
    return json({
      ok: false,
      pendiente: 'validacion',
      mensaje: 'La escritura en interes_mora_cmf requiere validar el mapeo contra un valor conocido. Ejecuta primero en dry-run e inspecciona la respuesta de la CMF.',
      year, month,
    }, 409);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
