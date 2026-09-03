// sync-conducta-pago
// Lee la ficha pública de una licitación reciente de cada institución en Mercado Público y
// extrae "Reclamos recibidos por incumplir plazo de pago" (últimos 12 meses) y el plazo de pago
// declarado. Guarda una foto diaria en institucion_pago_snapshot y actualiza instituciones.
// Se ejecuta por pg_cron en lotes; body opcional: { lote: 30, dias: 7 }.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const FICHA = "https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=";

const rutNorm = (s: string) => s.replace(/\./g, "").replace(/\s/g, "").toUpperCase();
const campo = (html: string, id: string) => {
  const m = html.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)</`, "i"));
  return m ? m[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim() : null;
};

function rolJwt(auth: string | null): string | null {
  try {
    const tok = (auth ?? "").replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role ?? null;
  } catch { return null; }
}

async function leerFicha(codigo: string): Promise<{ rut: string | null; reclamos: number | null; plazo: string | null; status: number }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(FICHA + encodeURIComponent(codigo), { headers: { "User-Agent": UA, "Accept": "text/html" }, redirect: "follow", signal: ctl.signal });
    const html = await r.text();
    const rut = campo(html, "lblFicha2RUT");
    const recl = campo(html, "lblFicha2Reclamo");
    const plazo = campo(html, "lblFicha7Plazos");
    const n = recl != null && /^\d[\d.]*$/.test(recl) ? parseInt(recl.replace(/\./g, ""), 10) : null;
    return { rut, reclamos: n, plazo, status: r.status };
  } finally { clearTimeout(timer); }
}

Deno.serve(async (req: Request) => {
  // verify_jwt ya validó la firma; aquí solo se exige que el rol sea service_role (pg_cron usa esa llave).
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (rolJwt(req.headers.get("authorization")) !== "service_role") {
    return new Response(JSON.stringify({ error: "no autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* vacío */ }
  const lote = Math.min(Number(body.lote ?? 30), 100);
  const dias = Number(body.dias ?? 7);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, service);

  const { data: pend, error } = await sb.rpc("instituciones_pendientes_pago", { p_limit: lote, p_dias: dias });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });

  const t0 = Date.now();
  const res = { pendientes: pend?.length ?? 0, actualizadas: 0, sin_dato: 0, rut_distinto: 0, errores: [] as string[], muestra: [] as any[] };
  for (const inst of pend ?? []) {
    if (Date.now() - t0 > 110_000) break; // dejar margen al límite de la función
    let ok = false;
    for (const codigo of (inst.codigos ?? []).slice(0, 2)) {
      try {
        const f = await leerFicha(codigo);
        if (f.rut && rutNorm(f.rut) !== rutNorm(inst.rut)) { res.rut_distinto++; continue; }
        if (f.reclamos == null) continue;
        const { error: e2 } = await sb.rpc("registrar_conducta_pago", { p_rut: inst.rut, p_reclamos: f.reclamos, p_plazo: f.plazo, p_codigo: codigo });
        if (e2) { res.errores.push(`${inst.rut}: ${e2.message}`); break; }
        res.actualizadas++; ok = true;
        if (res.muestra.length < 5) res.muestra.push({ rut: inst.rut, nombre: inst.nombre, reclamos: f.reclamos, plazo: f.plazo, codigo });
        break;
      } catch (e) { res.errores.push(`${inst.rut}/${codigo}: ${String(e).slice(0, 120)}`); }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!ok) { res.sin_dato++; await sb.rpc("marcar_intento_pago", { p_rut: inst.rut }); }
    await new Promise((r) => setTimeout(r, 400));
  }
  return new Response(JSON.stringify({ ...res, ms: Date.now() - t0 }), { headers: { "Content-Type": "application/json" } });
});
