// Ficha de empresa leída desde su sitio web (complemento del RUT en el onboarding
// y en Mi empresa). Baja la portada y hasta dos páginas internas ("nosotros",
// "productos"), las convierte a texto y la IA arma la ficha: descripción para un
// comprador público, productos como los escribe el Estado, industrias y datos
// de contacto. No guarda nada: el cliente revisa y confirma en el front.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const INDUSTRIAS = ["medico", "oficina", "alimentos", "tecnologia", "servicios", "mobiliario", "aseo", "construccion", "automotriz", "textil", "otro"];
const MAX_HTML = 600_000;
const MAX_TEXTO = 14_000;

// Solo sitios públicos: http(s), con nombre de dominio (no IP ni red interna).
export function urlSegura(entrada: string): URL | null {
  let s = String(entrada ?? "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.endsWith(".local") || h === "localhost" || h.includes(":")) return null;
  u.hash = "";
  return u;
}

export function htmlATexto(html: string): { titulo: string; meta: string; texto: string; enlaces: string[] } {
  const titulo = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const meta = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ?? "").trim();
  const enlaces = Array.from(html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)).map((m) => m[1]);
  const texto = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(br|p|div|li|h[1-6]|tr|section|article|header|footer)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{2,}/g, "\n").trim();
  return { titulo, meta, texto, enlaces };
}

async function bajar(u: URL): Promise<string | null> {
  try {
    const r = await fetch(u.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FirmaVB/1.0; +https://firmavb.cl)", Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const tipo = r.headers.get("content-type") ?? "";
    if (tipo && !/html|xml|text/i.test(tipo)) return null;
    const html = await r.text();
    return html.slice(0, MAX_HTML);
  } catch { return null; }
}

const INTERNAS = /nosotros|quienes|about|empresa|productos|servicios|catalogo|catálogo|soluciones/i;

async function gemini(key: string, model: string, prompt: string) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json" } }),
  });
  if (!r.ok) throw new Error(`${model} http_${r.status}`);
  const d = await r.json();
  return JSON.parse(d?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "no autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const base = urlSegura(body.url);
    if (!base) return json({ error: "Escribe la dirección de tu sitio, por ejemplo www.miempresa.cl" }, 400);

    // 1) Portada y hasta dos páginas internas que suelen contar qué hace la empresa.
    const portada = await bajar(base);
    if (!portada) return json({ error: "No pudimos abrir ese sitio. Revisa la dirección o inténtalo más tarde." }, 422);
    const p0 = htmlATexto(portada);
    const internas: URL[] = [];
    for (const href of p0.enlaces) {
      if (internas.length >= 2) break;
      let l: URL; try { l = new URL(href, base); } catch { continue; }
      if (l.hostname !== base.hostname || !INTERNAS.test(l.pathname) || l.pathname === base.pathname) continue;
      if (internas.some((x) => x.pathname === l.pathname)) continue;
      internas.push(l);
    }
    const textos = [p0.texto];
    const paginas = [base.pathname];
    const htmls = await Promise.all(internas.map(bajar));
    htmls.forEach((h, i) => { if (h) { textos.push(htmlATexto(h).texto); paginas.push(internas[i].pathname); } });
    const texto = textos.join("\n---\n").slice(0, MAX_TEXTO);
    if (texto.length < 200 && !p0.meta) return json({ error: "El sitio casi no tiene texto legible (puede estar hecho solo con imágenes o requerir inicio de sesión)." }, 422);

    // 2) IA: ficha para un comprador público.
    const prompt = `Eres experto en compras públicas de Chile (Mercado Público). Lee el texto del sitio web de una empresa y arma su ficha para venderle al Estado. Usa SOLO lo que dice el sitio; si un dato no está, déjalo null o vacío. No inventes.
Título del sitio: ${p0.titulo || "s/i"}
Meta descripción: ${p0.meta || "s/i"}
Texto del sitio (páginas ${paginas.join(", ")}):
"""${texto}"""

Responde SOLO JSON con:
- "nombre": nombre comercial o razón social de la empresa (string o null).
- "descripcion": 50 a 90 palabras, en tercera persona, para un comprador público: qué vende o hace, a quién, dónde y qué la distingue (experiencia, certificaciones, cobertura). Sin adjetivos vacíos.
- "productos": 8 a 20 productos o servicios concretos, como los escribe un organismo público en el título de una compra: minúsculas, 1 a 3 palabras, sin marcas, sin modelos, sin genéricos sueltos ("insumos", "servicios", "equipos").
- "industrias": 1 a 3 ids de esta lista exacta: ${INDUSTRIAS.join(", ")}.
- "region": región o ciudad de Chile donde opera, tal como aparece (string o null).
- "telefono": teléfono de contacto (string o null). "email": correo de contacto (string o null).
- "anios": años de experiencia o año de fundación si el sitio lo dice (string o null).
- "certificaciones": lista de certificaciones o registros mencionados (ISO, Chileproveedores, etc.), vacía si no hay.`;

    const key = Deno.env.get("GEMINI_API_KEY");
    let ia: any = null;
    if (key) {
      for (const m of [Deno.env.get("GEMINI_MODEL"), "gemini-3.6-flash", "gemini-flash-latest", "gemini-flash-lite-latest"].filter(Boolean) as string[]) {
        try { ia = await gemini(key, m, prompt); if (typeof ia?.descripcion === "string") break; } catch (_) { /* siguiente modelo */ }
      }
    }
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
    const productos = Array.from(new Set(((ia?.productos ?? []) as unknown[]).map((p) => norm(String(p))).filter((p) => p.length >= 4 && p.split(" ").length <= 4))).slice(0, 20);
    const industrias = ((ia?.industrias ?? []) as string[]).filter((i) => INDUSTRIAS.includes(i)).slice(0, 3);
    const texto_o_null = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

    return json({
      url: base.toString(),
      paginas,
      nombre: texto_o_null(ia?.nombre) ?? (p0.titulo ? p0.titulo.split(/[|–-]/)[0].trim().slice(0, 120) : null),
      descripcion: texto_o_null(ia?.descripcion, 900) ?? (p0.meta ? p0.meta.slice(0, 600) : null),
      productos,
      industrias,
      region: texto_o_null(ia?.region),
      telefono: texto_o_null(ia?.telefono),
      email: texto_o_null(ia?.email),
      anios: texto_o_null(ia?.anios),
      certificaciones: Array.isArray(ia?.certificaciones) ? ia.certificaciones.map((c: unknown) => String(c).trim()).filter(Boolean).slice(0, 8) : [],
      fuente: ia ? "ia" : "meta",
    });
  } catch (e) {
    console.error("empresa-desde-web", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
