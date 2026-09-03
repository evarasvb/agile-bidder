// Noticias de compras públicas (fuente externa del Experto). Lee RSS cada 6 h y guarda cada nota
// como fragmento "Noticia: <medio> (<fecha>)" con su link, para que el Experto la cite como [n].
import { createClient } from "jsr:@supabase/supabase-js@2";

const FEEDS: { nombre: string; url: string }[] = [
  { nombre: "ChileCompra", url: "https://www.chilecompra.cl/feed/" },
  { nombre: "Google News", url: "https://news.google.com/rss/search?q=%22Mercado+P%C3%BAblico%22+OR+ChileCompra+OR+%22compras+p%C3%BAblicas%22+OR+%22licitaci%C3%B3n+p%C3%BAblica%22&hl=es-419&gl=CL&ceid=CL:es-419" },
  { nombre: "Google News Contraloría", url: "https://news.google.com/rss/search?q=Contralor%C3%ADa+licitaci%C3%B3n+OR+%22trato+directo%22+OR+%22convenio+marco%22&hl=es-419&gl=CL&ceid=CL:es-419" },
];
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
function rolJwt(auth: string | null): string | null {
  try { return JSON.parse(atob((auth ?? "").replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? null; } catch { return null; }
}
const limpiar = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const tag = (xml: string, t: string) => { const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i")); return m ? limpiar(m[1]) : ""; };

Deno.serve(async (req) => {
  if (rolJwt(req.headers.get("authorization")) !== "service_role") return json({ error: "no autorizado" }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const res: Record<string, unknown> = {}; const filas: any[] = [];
  const desde = Date.now() - 60 * 24 * 3600 * 1000;
  for (const f of FEEDS) {
    try {
      const r = await fetch(f.url, { headers: { "User-Agent": "FirmaVB/1.0 (+https://www.firmavb.cl)", Accept: "application/rss+xml, application/xml, text/xml" } });
      if (!r.ok) { res[f.nombre] = `HTTP ${r.status}`; continue; }
      const xml = await r.text();
      const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
      let n = 0;
      for (const it of items) {
        const titulo = tag(it, "title"); const link = tag(it, "link") || (it.match(/<link>([^<]+)/) ?? [])[1] || ""; const desc = tag(it, "description"); const fecha = tag(it, "pubDate");
        const medio = tag(it, "source") || f.nombre;
        const ts = Date.parse(fecha); if (!titulo || !link || (ts && ts < desde)) continue;
        const dia = ts ? new Date(ts).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        filas.push({ fuente: `Noticia: ${medio} (${dia})`, seccion: titulo.slice(0, 200), url: link.trim().slice(0, 500), texto: `${titulo}. ${desc}`.slice(0, 1500), fecha: ts ? new Date(ts).toISOString() : null });
        n++;
      }
      res[f.nombre] = n;
    } catch (e) { res[f.nombre] = String((e as Error)?.message ?? e); }
  }
  const { data, error } = await sb.rpc("noticias_insertar", { p_filas: filas });
  return json({ leidas: filas.length, nuevas: data ?? 0, error: error?.message, feeds: res });
});
