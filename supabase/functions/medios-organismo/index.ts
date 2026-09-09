// Medios cruzados con organismos: qué dicen diarios, radios, TV, portales y prensa oficial sobre
// el organismo que licita. Fuente: Google Noticias (RSS, agrega prensa regional y radios chilenas).
// Cada nota queda en medios_menciones (por organismo) y en experto.fragmentos para que el Experto
// la cite como [n].
//   POST {auto:true, limit:8}        -> service_role (cron): organismos con licitaciones abiertas sin revisar hace 7 días
//   POST {codigo} | {organismo}      -> sesión: refresca si el organismo lleva más de 24 h sin revisar y devuelve las menciones
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UA = "Mozilla/5.0 (compatible; FirmaVB/1.0; +https://www.firmavb.cl)";
const PRESUPUESTO_MS = 100_000;
const DIAS = 365;

function rol(auth: string): string {
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (token && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return "service_role";
  try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? ""; } catch { return ""; }
}
const limpiar = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const tag = (xml: string, t: string) => { const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i")); return m ? limpiar(m[1]) : ""; };

// Nombre tal como viene de Mercado Público ("I MUNICIPALIDAD DE TALCA", "HOSPITAL ... DE CO") a una
// consulta que Google entienda: sin prefijos ni palabras cortadas, máximo 6 palabras.
function consultaDe(organismo: string): string {
  let s = organismo.replace(/^\s*(I\.?|IL\.?|ILUSTRE)\s+/i, "").replace(/\s+/g, " ").trim();
  const palabras = s.split(" ").filter((p, i, a) => !(i === a.length - 1 && p.length <= 2 && a.length > 2));
  return palabras.slice(0, 6).join(" ");
}

const RADIOS = /biobiochile|cooperativa\.cl|adnradio|radioagricultura|radio\.uchile|futuro\.cl|radiopolar|radiosago|radioarmonia|radiomaray|radiousach|radiopudahuel|radioimagina|radiofmplus|radionuevomundo|radio[a-z]*\.cl/i;
const TV = /24horas|chilevision|chv\.cl|mega\.cl|meganoticias|t13\.cl|tvn\.cl|cnnchile|canal13/i;
const DIARIOS = /emol|latercera|lasegunda|elmercurio|elmostrador|soychile|soy[a-z]+\.cl|diario[a-z]*\.cl|eldesconcierto|ciperchile|lanacion|austral[a-z]*\.cl|elsur\.cl|elcentro|elobservador|laestrella|elpinguino|cronica[a-z]*\.cl|eldia\.cl|elllanquihue|elranco|latribuna|eltipografo|elrancaguino|elmauleinforma|maulee|araucanianoticias|elheraldo|lidera[a-z]*\.cl|publimetro|lahora\.cl|df\.cl|diariofinanciero|elperiodista|theclinic|interferencia|lavozdemaipu|puranoticia|elvacanudo|infogate/i;
const OFICIAL = /\.gob\.cl|\.gov\.cl|minsal|munitel|\.muni[a-z]*\.cl|municipalidad|senado\.cl|camara\.cl|contraloria|chilecompra|mercadopublico|\.cl\/prensa/i;
const GREMIO = /fenpruss|fenats|colegiomedico|colmed|anef\.cl|cut\.cl|sofofa|cpc\.cl|camara[a-z]*\.cl|asociacion|federacion|sindicato|confusam|fenpruss/i;
const REDES = /twitter\.com|x\.com|facebook\.com|instagram\.com|tiktok\.com|youtube\.com|linkedin\.com/i;
function tipoMedio(url: string, medio: string): string {
  const s = `${url} ${medio}`;
  if (REDES.test(s)) return "redes";
  if (RADIOS.test(s) || /radio/i.test(medio)) return "radio";
  if (TV.test(s)) return "tv";
  if (OFICIAL.test(s)) return "oficial";
  if (GREMIO.test(s)) return "gremio";
  if (DIARIOS.test(s) || /diario|mercurio|tercera|prensa|el d[ií]a|la estrella|el sur|austral|cr[óo]nica/i.test(medio)) return "diario";
  return /\.cl/.test(url) ? "portal" : "otro";
}

type Nota = { titulo: string; url: string; medio: string; medio_url: string; fecha: string | null; resumen: string };
async function googleNoticias(consulta: string, ms: number): Promise<Nota[]> {
  const q = `${consulta} when:${DIAS}d`;
  const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es-419&gl=CL&ceid=CL:es-419`, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(ms),
  });
  if (!r.ok) throw new Error(`Google Noticias HTTP ${r.status}`);
  const xml = await r.text();
  const notas: Nota[] = [];
  for (const it of xml.match(/<item[\s\S]*?<\/item>/gi) ?? []) {
    const titulo = tag(it, "title"); const url = tag(it, "link") || (it.match(/<link>([^<]+)/) ?? [])[1] || "";
    const medio = tag(it, "source"); const medio_url = (it.match(/<source[^>]*url="([^"]+)"/i) ?? [])[1] ?? "";
    const ts = Date.parse(tag(it, "pubDate"));
    if (!titulo || !url) continue;
    // Google pone " - Medio" al final del título: se quita para no repetirlo.
    const t = medio && titulo.endsWith(` - ${medio}`) ? titulo.slice(0, -(medio.length + 3)) : titulo;
    notas.push({ titulo: t.slice(0, 300), url: url.trim().slice(0, 500), medio: medio.slice(0, 120), medio_url, fecha: ts ? new Date(ts).toISOString() : null, resumen: tag(it, "description").slice(0, 600) });
  }
  return notas;
}

async function revisar(sb: SupabaseClient, organismo: string, deadline: number, codigo?: string): Promise<{ organismo: string; notas: number; nuevas: number; error?: string }> {
  const { data: norm } = await sb.rpc("medios_norm", { p: organismo });
  const organismo_norm = String(norm ?? "").trim();
  if (!organismo_norm) return { organismo, notas: 0, nuevas: 0, error: "nombre vacío" };
  const consulta = consultaDe(organismo);
  try {
    const notas = await googleNoticias(consulta, Math.max(5000, Math.min(20000, deadline - Date.now())));
    const filas = notas.map((n) => ({
      organismo, organismo_norm, licitacion_codigo: codigo ?? null, titulo: n.titulo, url: n.url, medio: n.medio || null,
      tipo_medio: tipoMedio(n.medio_url || n.url, n.medio), fecha: n.fecha, resumen: n.resumen || null, consulta,
    }));
    let nuevas = 0;
    if (filas.length) {
      const { count: antes } = await sb.from("medios_menciones").select("id", { count: "exact", head: true }).eq("organismo_norm", organismo_norm);
      const { error } = await sb.from("medios_menciones").upsert(filas, { onConflict: "organismo_norm,url", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      const { count: despues } = await sb.from("medios_menciones").select("id", { count: "exact", head: true }).eq("organismo_norm", organismo_norm);
      nuevas = Math.max(0, (despues ?? 0) - (antes ?? 0));
      // Las mismas notas, como fuentes del Experto (texto con el organismo para que el buscador las encuentre).
      await sb.rpc("noticias_insertar", { p_filas: notas.map((n) => ({
        fuente: `Noticia: ${n.medio || "prensa"} (${(n.fecha ?? new Date().toISOString()).slice(0, 10)})`, seccion: n.titulo.slice(0, 200), url: n.url,
        texto: `${organismo}. ${n.titulo}. ${n.resumen}`.slice(0, 1500), fecha: n.fecha,
      })) });
    }
    const { count: total } = await sb.from("medios_menciones").select("id", { count: "exact", head: true }).eq("organismo_norm", organismo_norm);
    await sb.from("medios_organismos_estado").upsert({ organismo_norm, organismo, revisado_en: new Date().toISOString(), menciones: total ?? 0, error: null });
    return { organismo, notas: notas.length, nuevas };
  } catch (e) {
    const error = String((e as Error)?.message ?? e).slice(0, 300);
    await sb.from("medios_organismos_estado").upsert({ organismo_norm, organismo, revisado_en: new Date().toISOString(), error });
    return { organismo, notas: 0, nuevas: 0, error };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const t0 = Date.now(); const deadline = t0 + PRESUPUESTO_MS;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const r = rol(req.headers.get("Authorization") ?? "");
  try {
    const body = await req.json().catch(() => ({}));
    if (body.auto) {
      if (r !== "service_role") return json({ error: "solo_servicio" }, 403);
      const { data: orgs, error } = await sb.rpc("medios_organismos_pendientes", { p_limite: Number(body.limit ?? 8) });
      if (error) return json({ error: error.message }, 500);
      const revisados = [];
      for (const o of (orgs ?? []) as { organismo: string }[]) {
        if (Date.now() > deadline - 20000) break;
        revisados.push(await revisar(sb, o.organismo, deadline));
        await new Promise((ok) => setTimeout(ok, 1500)); // pausa entre consultas a Google
      }
      return json({ candidatos: (orgs ?? []).length, revisados, ms: Date.now() - t0 });
    }
    if (r !== "authenticated" && r !== "service_role") return json({ error: "login", mensaje: "Inicia sesión en FirmaVB para ver qué dicen los medios." }, 401);
    const codigo = String(body.codigo ?? "").trim().toUpperCase() || undefined;
    let organismo = String(body.organismo ?? "").trim();
    if (codigo) { const { data } = await sb.rpc("medios_organismo_de", { p_codigo: codigo }); if (data) organismo = String(data); }
    if (!organismo) return json({ error: "organismo", mensaje: "No encontré el organismo de ese proceso." }, 400);
    const { data: norm } = await sb.rpc("medios_norm", { p: organismo });
    const { data: estado } = await sb.from("medios_organismos_estado").select("revisado_en").eq("organismo_norm", String(norm ?? "")).maybeSingle();
    const vencido = !estado || Date.parse(estado.revisado_en) < Date.now() - 24 * 3600 * 1000;
    const resultado = vencido || body.forzar ? await revisar(sb, organismo, deadline, codigo) : null;
    const { data: menciones } = await sb.rpc("medios_organismo", { p_codigo: codigo ?? null, p_organismo: organismo, p_cantidad: 30 });
    return json({ organismo, refrescado: !!resultado, resultado, menciones: menciones ?? [], ms: Date.now() - t0 });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
