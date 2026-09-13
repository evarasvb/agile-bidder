// Sonda temporal: descarga URLs y devuelve estado + fragmento + coincidencias de una regex.
// body: { urls:[], buscar?, crudo?, max?, contexto?, max_hits?,
//         cadena?: { url, regex, plantilla }   -> GET url, extrae $1 con regex, GET plantilla (misma sesión)
//         postback?: { url, campos, evento? },
//         secuencia?: { url, pasos:[{ campos, evento?, modo?:'ocultos'|'formulario' }] } }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function ocultos(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<input[^>]*type="hidden"[^>]*>/gi; let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const n = m[0].match(/name="([^"]+)"/i)?.[1]; const v = m[0].match(/value="([^"]*)"/i)?.[1] ?? "";
    if (n) out[n] = v;
  }
  return out;
}
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
async function texto(r: Response): Promise<string> {
  const buf = await r.arrayBuffer();
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { return new TextDecoder("iso-8859-1").decode(buf); }
}
function resumenGrilla(html: string) {
  const filas = [...html.matchAll(/<tr class="rg(?:Alt)?Row"[^>]*>([\s\S]*?)<\/tr>/g)];
  const primera = filas[0]?.[1].match(/lnkIDRec[^>]*>([^<]+)</)?.[1] ?? null;
  const m = html.match(/P[^ ]{0,3}gina <strong>(\d+)<\/strong> de <strong>(\d+)<\/strong>, registros del <strong>\d+<\/strong> al <strong>\d+<\/strong> de <strong>(\d+)<\/strong>/);
  return { filas: filas.length, primera, pagina: m ? +m[1] : null, paginas: m ? +m[2] : null, total: m ? +m[3] : null, bytes: html.length, inicio: html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 400) };
}
function analizar(texto: string, buscar: string | null, crudo: boolean, max: number, contexto: number, maxHits: number) {
  const limpio = crudo ? texto : texto.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const item: any = {};
  if (buscar) {
    const re = new RegExp(buscar, "gi");
    const hits: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(limpio)) && hits.length < maxHits) {
      const ini = Math.max(0, m.index - contexto);
      hits.push(limpio.slice(ini, m.index + m[0].length + contexto).replace(/\s+/g, " "));
      if (m[0].length === 0) re.lastIndex++;
    }
    item.hits = hits;
  }
  item.fragmento = limpio.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, max);
  return item;
}
async function postForm(url: string, form: Record<string, string>, jar: Jar) {
  const p = await fetch(url, { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", "Cookie": jar.header, "Referer": url }, body: new URLSearchParams(form).toString(), redirect: "follow" });
  jar.absorber(p);
  return { status: p.status, contentType: p.headers.get("content-type") ?? "", html: await texto(p) };
}

Deno.serve(async (req: Request) => {
  let body: any = {};
  try { body = await req.json(); } catch { /* vacío */ }
  const urls: string[] = Array.isArray(body.urls) ? body.urls.slice(0, 8) : [];
  const buscar: string | null = typeof body.buscar === "string" ? body.buscar : null;
  const crudo = body.crudo === true;
  const max = Math.min(Number(body.max ?? 1500), 20000);
  const contexto = Math.min(Number(body.contexto ?? 120), 600);
  const maxHits = Math.min(Number(body.max_hits ?? 25), 200);
  const out: any[] = [];

  if (body.cadena?.url) {
    const t0 = Date.now();
    try {
      const jar = new Jar();
      const g = await fetch(String(body.cadena.url), { headers: { "User-Agent": UA }, redirect: "follow" });
      jar.absorber(g);
      const h1 = await texto(g);
      const m = h1.match(new RegExp(String(body.cadena.regex), "i"));
      if (!m) { out.push({ modo: "cadena", error: "regex sin coincidencia", status1: g.status, bytes1: h1.length }); }
      else {
        const u2 = String(body.cadena.plantilla).replace("$1", m[1] ?? m[0]);
        const r2 = await fetch(u2, { headers: { "User-Agent": UA, "Cookie": jar.header, "Referer": g.url }, redirect: "follow" });
        jar.absorber(r2);
        const h2 = await texto(r2);
        out.push({ modo: "cadena", url2: u2.slice(0, 200), status2: r2.status, content_type2: r2.headers.get("content-type") ?? "", bytes2: h2.length, cookies: Object.keys(jar.c), ms: Date.now() - t0, ...analizar(h2, buscar, crudo, max, contexto, maxHits) });
      }
    } catch (e) { out.push({ modo: "cadena", error: String(e) }); }
  }

  if (body.secuencia?.url) {
    const url = String(body.secuencia.url);
    const t0 = Date.now();
    try {
      const jar = new Jar();
      const g = await fetch(url, { headers: { "User-Agent": UA } });
      jar.absorber(g);
      let html = await texto(g);
      const pasos: any[] = [];
      for (const paso of (body.secuencia.pasos ?? []).slice(0, 10)) {
        const base = paso.modo === "formulario" ? formulario(html) : ocultos(html);
        const form: Record<string, string> = { ...base, ...(paso.campos ?? {}) };
        if (paso.evento) { form.__EVENTTARGET = paso.evento; form.__EVENTARGUMENT = ""; }
        const r = await postForm(url, form, jar);
        html = r.html;
        pasos.push({ status: r.status, content_type: r.contentType, cookies: Object.keys(jar.c), ...resumenGrilla(html), enviados: Object.keys(form).length });
        await new Promise((res) => setTimeout(res, 200));
      }
      out.push({ url, modo: "secuencia", ms: Date.now() - t0, pasos, ...(buscar ? analizar(html, buscar, crudo, max, contexto, maxHits) : {}) });
    } catch (e) { out.push({ modo: "secuencia", error: String(e) }); }
  }

  if (body.postback?.url) {
    const t0 = Date.now();
    try {
      const url = String(body.postback.url);
      const jar = new Jar();
      const g = await fetch(url, { headers: { "User-Agent": UA } });
      jar.absorber(g);
      const html = await texto(g);
      const form: Record<string, string> = { ...ocultos(html), ...(body.postback.campos ?? {}) };
      if (body.postback.evento) { form.__EVENTTARGET = body.postback.evento; form.__EVENTARGUMENT = ""; }
      const r = await postForm(url, form, jar);
      out.push({ url, modo: "postback", status: r.status, bytes: r.html.length, ms: Date.now() - t0, ...analizar(r.html, buscar, crudo, max, contexto, maxHits) });
    } catch (e) { out.push({ modo: "postback", error: String(e) }); }
  }

  for (const url of urls) {
    const t0 = Date.now();
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 25000);
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "text/html,application/json,*/*" }, redirect: "follow", signal: ctl.signal });
      clearTimeout(timer);
      const t = await texto(r);
      out.push({ url, final: r.url, status: r.status, content_type: r.headers.get("content-type") ?? "", bytes: t.length, ms: Date.now() - t0, ...analizar(t, buscar, crudo, max, contexto, maxHits) });
    } catch (e) {
      out.push({ url, error: String(e), ms: Date.now() - t0 });
    }
  }
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
});
