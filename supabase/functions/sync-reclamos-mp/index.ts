// sync-reclamos-mp
// Lee el buscador público de reclamos de Mercado Público (BusquedaReclamos.aspx, ASP.NET WebForms)
// por día y tipo (1 = pago no oportuno, 2 = irregularidad en el proceso) y guarda cada reclamo:
// id, proceso, fecha, reclamante, organismo, estado. Corre por pg_cron; body opcional:
// { dias: 3 } (días pendientes por pasada) o { desde:"2026-09-01", hasta:"2026-09-01" }.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_B = "https://www.mercadopublico.cl/Portal/Modules/Site/Reclamos/BusquedaReclamos.aspx";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const PAGER = "rgBusqueda$ctl00$ctl03$ctl01$";

function rolJwt(auth: string | null): string | null {
  try { return JSON.parse(atob((auth ?? "").replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? null; } catch { return null; }
}
// Todos los campos del formulario tal como los enviaría el navegador: hidden + text + selects.
function formulario(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<input[^>]*>/gi; let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tipo = (m[0].match(/type="([^"]+)"/i)?.[1] ?? "text").toLowerCase();
    if (!["hidden", "text"].includes(tipo)) continue;
    const n = m[0].match(/name="([^"]+)"/i)?.[1]; const v = m[0].match(/value="([^"]*)"/i)?.[1] ?? "";
    if (n) out[n] = v;
  }
  const rs = /<select[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi;
  while ((m = rs.exec(html))) {
    const sel = m[2].match(/<option[^>]*selected[^>]*value="([^"]*)"/i)?.[1] ?? m[2].match(/<option[^>]*value="([^"]*)"[^>]*selected/i)?.[1] ?? m[2].match(/<option[^>]*value="([^"]*)"/i)?.[1] ?? "";
    out[m[1]] = sel;
  }
  return out;
}
const limpiar = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c))).replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
function filas(html: string) {
  const out: any[] = [];
  const re = /<tr class="rg(?:Alt)?Row"[^>]*>([\s\S]*?)<\/tr>/g; let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tds = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((t) => t[1]);
    if (tds.length < 6) continue;
    const fecha = limpiar(tds[2]).match(/(\d{2})-(\d{2})-(\d{4})/);
    out.push({
      id_reclamo: limpiar(tds[0]), proceso_codigo: limpiar(tds[1]),
      fecha: fecha ? `${fecha[3]}-${fecha[2]}-${fecha[1]}` : null,
      reclamante: limpiar(tds[3]).slice(0, 200), organismo_nombre: limpiar(tds[4]).slice(0, 200),
      estado: tds[5].match(/EstadoPAF-([A-Za-z]+)\.png/)?.[1] ?? null,
    });
  }
  return out.filter((r) => r.id_reclamo && r.fecha);
}
function info(html: string) {
  const m = html.match(/P[^ ]{0,3}gina <strong>(\d+)<\/strong> de <strong>(\d+)<\/strong>, registros del <strong>\d+<\/strong> al <strong>\d+<\/strong> de <strong>(\d+)<\/strong>/);
  return m ? { pagina: +m[1], paginas: +m[2], total: +m[3] } : { pagina: 1, paginas: html.includes("rgBusqueda_ctl00") ? 1 : 0, total: 0 };
}
const fechaMP = (iso: string) => { const [y, mo, d] = iso.split("-"); return `${d}-${mo}-${y}`; };

async function post(form: Record<string, string>, cookie: string): Promise<string> {
  const r = await fetch(URL_B, { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", "Cookie": cookie, "Referer": URL_B }, body: new URLSearchParams(form).toString() });
  return await r.text();
}

async function leerDia(iso: string, tipo: 1 | 2, limiteMs: number) {
  const t0 = Date.now();
  const g = await fetch(URL_B, { headers: { "User-Agent": UA } });
  const cookie = (g.headers.get("set-cookie") ?? "").split(/,(?=[^ ]+=)/).map((c) => c.split(";")[0]).join("; ");
  let html = await g.text();
  const filtro: Record<string, string> = {
    ddlTipoReclamo: String(tipo), ddlEstadoReclamo: "Seleccione...",
    txtIDReclamo: "", txtRut: "", txtValidador: "", txtRutProv: "", txtValProv: "", txtIDLicOc: "",
    radComboOrgs: "Ingrese nombre del organismo", hdfVal: "false", hdfVal2: "false", hdfEntCode: "",
    calFrom: `${fechaMP(iso)} 00:00:00`, calTo: `${fechaMP(iso)} 23:59:59`,
  };
  if (tipo === 1) filtro.ddlMotivoReclamo = "1";
  const pasos: string[] = [];
  html = await post({ ...formulario(html), ...filtro, btnBuscar: "Buscar" }, cookie);
  let filasTodas = filas(html);
  let inf = info(html);
  pasos.push(`busqueda:${filasTodas.length}/${inf.total}`);
  if (inf.total === 0) return { filas: [], total: 0, paginas: 0, completo: true, pasos };
  const tam50: Record<string, string> = {
    [PAGER + "PageSizeComboBox"]: "50",
    "rgBusqueda_ctl00_ctl03_ctl01_PageSizeComboBox_ClientState": JSON.stringify({ logEntries: [], value: "50", text: "50", enabled: true, checkedIndices: [], checkedItemsTextOverflows: false }),
  };
  if (inf.paginas > 1) {
    const h50 = await post({ ...formulario(html), ...filtro, ...tam50, __EVENTTARGET: PAGER + "PageSizeComboBox", __EVENTARGUMENT: "" }, cookie);
    const f50 = filas(h50);
    pasos.push(`tam50:${f50.length}`);
    if (f50.length > filasTodas.length) { html = h50; filasTodas = f50; inf = info(h50); }
  }
  let completo = true;
  while (inf.pagina < inf.paginas) {
    if (Date.now() - t0 > limiteMs) { completo = false; pasos.push("tiempo"); break; }
    html = await post({ ...formulario(html), ...filtro, ...tam50, [PAGER + "ctl18"]: " " }, cookie);
    const f = filas(html); const i2 = info(html);
    pasos.push(`p${i2.pagina}:${f.length}`);
    if (!f.length || i2.pagina <= inf.pagina) { completo = false; break; }
    filasTodas.push(...f); inf = i2;
    await new Promise((r) => setTimeout(r, 250));
  }
  const vistos = new Set<string>();
  filasTodas = filasTodas.filter((r) => !vistos.has(r.id_reclamo) && vistos.add(r.id_reclamo));
  return { filas: filasTodas, total: inf.total, paginas: inf.paginas, completo: completo && filasTodas.length >= inf.total, pasos };
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
      const d = await leerDia(t.fecha, t.tipo, 40_000);
      let guardadas = 0;
      if (d.filas.length) {
        const { data: n, error } = await sb.rpc("reclamos_mp_upsert", { p_filas: d.filas.map((f) => ({ ...f, tipo: t.tipo })) });
        if (error) throw new Error(error.message);
        guardadas = n ?? 0;
      }
      await sb.rpc("reclamos_mp_marcar_dia", { p_fecha: t.fecha, p_tipo: t.tipo, p_cargados: d.filas.length, p_total: d.total, p_completo: d.completo });
      res.hechas.push({ ...t, total: d.total, paginas: d.paginas, leidas: d.filas.length, guardadas, completo: d.completo, pasos: d.pasos });
    } catch (e) { res.errores.push({ ...t, error: String(e).slice(0, 200) }); }
  }
  res.ms = Date.now() - t0;
  return new Response(JSON.stringify(res), { headers: { "Content-Type": "application/json" } });
});
