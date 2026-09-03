// sync-reclamos-mp
// Lee el buscador público de reclamos de Mercado Público (BusquedaReclamos.aspx, ASP.NET WebForms)
// por día y tipo (1 = pago no oportuno, 2 = irregularidad en el proceso), usa "Descargar resultados"
// para traer todas las filas de una vez y guarda cada reclamo: id, proceso, fecha, reclamante, organismo, estado. Corre por pg_cron; body opcional:
// { dias: 3 } (días pendientes por pasada) o { desde:"2026-09-01", hasta:"2026-09-01" }.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_B = "https://www.mercadopublico.cl/Portal/Modules/Site/Reclamos/BusquedaReclamos.aspx";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function rolJwt(auth: string | null): string | null {
  try { return JSON.parse(atob((auth ?? "").replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? null; } catch { return null; }
}
// Frasco de cookies: Mercado Público corre tras un balanceador (cookie GCLB); sin afinidad, la
// sesión cae en otro nodo y la grilla vuelve vacía.
class Jar {
  c: Record<string, string> = {};
  absorber(r: Response) {
    const h: string[] = (r.headers as any).getSetCookie ? (r.headers as any).getSetCookie() : [(r.headers.get("set-cookie") ?? "")];
    for (const raw of h) for (const parte of raw.split(/,(?=[^ ;]+=)/)) {
      const kv = parte.split(";")[0].trim(); const i = kv.indexOf("=");
      if (i > 0) this.c[kv.slice(0, i)] = kv.slice(i + 1);
    }
  }
  get header() { return Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join("; "); }
}
// El sitio declara charsets que no siempre cumple: se intenta UTF-8 estricto y se cae a Latin-1.
async function texto(r: Response): Promise<string> {
  const buf = await r.arrayBuffer();
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { return new TextDecoder("iso-8859-1").decode(buf); }
}
function ocultos(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<input[^>]*type="hidden"[^>]*>/gi; let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const n = m[0].match(/name="([^"]+)"/i)?.[1]; const v = m[0].match(/value="([^"]*)"/i)?.[1] ?? "";
    if (n) out[n] = v;
  }
  return out;
}
const limpiar = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c))).replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
// Filas del "Descargar resultados" (tabla HTML servida como .xls): id, proceso, fecha+hora, reclamante, organismo, estado.
function filasExcel(html: string) {
  const out: any[] = [];
  const re = /<tr[^>]*>([\s\S]*?)<\/tr>/g; let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tds = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((t) => limpiar(t[1]));
    if (tds.length < 6) continue;
    const f = tds[2].match(/(\d{2})-(\d{2})-(\d{4})/);
    if (!f || !/-REC\d{2}$/i.test(tds[0])) continue;
    out.push({ id_reclamo: tds[0], proceso_codigo: tds[1], fecha: `${f[3]}-${f[2]}-${f[1]}`, reclamante: tds[3].slice(0, 200), organismo_nombre: tds[4].slice(0, 200), estado: tds[5].slice(0, 80) });
  }
  return out;
}
function total(html: string): number | null {
  const m = html.match(/Se encontraron (\d+) elementos/) ?? html.match(/de <strong>(\d+)<\/strong>\. <\/div>/);
  return m ? +m[1] : (/<div id="rgBusqueda"/.test(html) ? 0 : null);
}
const fechaMP = (iso: string) => { const [y, mo, d] = iso.split("-"); return `${d}-${mo}-${y}`; };

async function post(form: Record<string, string>, jar: Jar): Promise<{ html: string; tipo: string }> {
  const r = await fetch(URL_B, { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", "Cookie": jar.header, "Referer": URL_B }, body: new URLSearchParams(form).toString() });
  jar.absorber(r);
  return { html: await texto(r), tipo: r.headers.get("content-type") ?? "" };
}

async function leerDia(iso: string, tipo: 1 | 2) {
  const jar = new Jar();
  const g = await fetch(URL_B, { headers: { "User-Agent": UA } });
  jar.absorber(g);
  const inicio = await texto(g);
  const filtro: Record<string, string> = {
    ddlTipoReclamo: String(tipo), ddlEstadoReclamo: "Seleccione...",
    txtIDReclamo: "", txtRut: "", txtValidador: "", txtRutProv: "", txtValProv: "", txtIDLicOc: "",
    radComboOrgs: "Ingrese nombre del organismo", hdfVal: "false", hdfVal2: "false", hdfEntCode: "",
    calFrom: `${fechaMP(iso)} 00:00:00`, calTo: `${fechaMP(iso)} 23:59:59`,
  };
  if (tipo === 1) filtro.ddlMotivoReclamo = "1";
  const pasos: string[] = [];
  const b = await post({ ...ocultos(inicio), ...filtro, btnBuscar: "Buscar" }, jar);
  const n = total(b.html);
  pasos.push(`busqueda:${n ?? "?"}`);
  if (n === 0) return { filas: [], total: 0, completo: true, pasos };
  if (n == null) return { filas: [], total: null, completo: false, pasos };
  // Exportación completa en una sola respuesta (tabla HTML servida como .xls)
  const x = await post({ ...ocultos(b.html), ...filtro, __EVENTTARGET: "lnkExcel", __EVENTARGUMENT: "" }, jar);
  const filas = filasExcel(x.html);
  pasos.push(`excel:${filas.length} (${x.tipo.split(";")[0]})`);
  const vistos = new Set<string>();
  const unicas = filas.filter((r) => !vistos.has(r.id_reclamo) && vistos.add(r.id_reclamo));
  return { filas: unicas, total: n, completo: unicas.length >= n, pasos };
}

Deno.serve(async (req: Request) => {
  if (rolJwt(req.headers.get("authorization")) !== "service_role") {
    return new Response(JSON.stringify({ error: "no autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  let body: any = {}; try { body = await req.json(); } catch { /* vacío */ }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const t0 = Date.now();
  let tareas: { fecha: string; tipo: 1 | 2 }[] = [];
  if (body.desde) {
    const hasta = body.hasta ?? body.desde;
    for (let d = new Date(body.desde + "T00:00:00Z"); d.toISOString().slice(0, 10) <= hasta; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10); tareas.push({ fecha: iso, tipo: 1 }, { fecha: iso, tipo: 2 });
    }
  } else {
    const { data, error } = await sb.rpc("reclamos_mp_dias_pendientes", { p_max: Math.min(Number(body.dias ?? 3), 20) * 2 });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    tareas = (data ?? []).map((r: any) => ({ fecha: r.fecha, tipo: r.tipo }));
  }
  const res: any = { tareas: tareas.length, hechas: [], errores: [] };
  for (const t of tareas) {
    if (Date.now() - t0 > 120_000) break;
    try {
      const d = await leerDia(t.fecha, t.tipo);
      let guardadas = 0;
      if (d.filas.length) {
        const { data: n, error } = await sb.rpc("reclamos_mp_upsert", { p_filas: d.filas.map((f) => ({ ...f, tipo: t.tipo })) });
        if (error) throw new Error(error.message);
        guardadas = n ?? 0;
      }
      await sb.rpc("reclamos_mp_marcar_dia", { p_fecha: t.fecha, p_tipo: t.tipo, p_cargados: d.filas.length, p_total: d.total, p_completo: d.completo });
      res.hechas.push({ ...t, total: d.total, leidas: d.filas.length, guardadas, completo: d.completo, pasos: d.pasos });
    } catch (e) { res.errores.push({ ...t, error: String(e).slice(0, 200) }); }
  }
  res.ms = Date.now() - t0;
  return new Response(JSON.stringify(res), { headers: { "Content-Type": "application/json" } });
});
