// pexels-imagen — FirmaVB
// Devuelve fotos de stock de Pexels para: posts en redes, imágenes del sitio y fichas de licitaciones.
// Uso (GET o POST):
//   ?q=hardware tools                → búsqueda libre
//   ?texto=Adquisición de tornillos  → detecta el rubro (pexels_termino_rubro) y busca
//   &orientacion=landscape|portrait|square (default landscape)
//   &n=1..10 (default 5)   &nocache=1 fuerza consulta nueva
// Respuesta: { consulta, termino, fotos:[{id,url_grande,url_mediana,url_pequena,alt,fotografo,fotografo_url,pexels_url,ancho,alto,color}], atribucion, desde_cache }
// Requiere secret PEXELS_API_KEY. Cachea 30 días en public.imagenes_pexels para no agotar la cuota gratis.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });

const CACHE_DIAS = 30;
const ATRIBUCION = "Photos provided by Pexels";

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function mapFoto(p: any) {
  return {
    id: p?.id,
    url_grande: p?.src?.large2x || p?.src?.large || p?.src?.original,
    url_mediana: p?.src?.large || p?.src?.medium,
    url_pequena: p?.src?.medium || p?.src?.small,
    alt: p?.alt || "",
    fotografo: p?.photographer || "",
    fotografo_url: p?.photographer_url || "",
    pexels_url: p?.url || "",
    ancho: p?.width, alto: p?.height, color: p?.avg_color,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  let body: Record<string, any> = {};
  if (req.method === "POST") body = await req.json().catch(() => ({}));
  const get = (k: string) => (body[k] ?? url.searchParams.get(k) ?? "").toString();

  const q = get("q").trim();
  const texto = get("texto").trim();
  const orientacion = ["landscape", "portrait", "square"].includes(get("orientacion")) ? get("orientacion") : "landscape";
  const n = Math.min(Math.max(parseInt(get("n") || "5", 10) || 5, 1), 10);
  const nocache = get("nocache") === "1";

  if (!q && !texto) return json({ error: "Falta q (búsqueda libre) o texto (título/descr. de licitación)" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1. Determinar término de búsqueda
  let termino = q;
  if (!termino) {
    const { data } = await admin.rpc("pexels_termino_rubro", { p_texto: texto });
    termino = (data as string) || "government building chile";
  }
  const clave = `${norm(termino)}|${orientacion}`;

  // 2. Caché
  if (!nocache) {
    const { data: c } = await admin.from("imagenes_pexels").select("fotos,total,actualizado_en,usos").eq("clave", clave).maybeSingle();
    if (c && c.fotos && (c.fotos as any[]).length > 0) {
      const edadDias = (Date.now() - new Date(c.actualizado_en).getTime()) / 86400000;
      if (edadDias < CACHE_DIAS) {
        admin.from("imagenes_pexels").update({ usos: (c.usos || 0) + 1 }).eq("clave", clave).then(() => {});
        return json({ consulta: q || texto, termino, orientacion, fotos: (c.fotos as any[]).slice(0, n), total: c.total, atribucion: ATRIBUCION, desde_cache: true });
      }
    }
  }

  // 3. Pexels
  const key = Deno.env.get("PEXELS_API_KEY");
  if (!key) return json({ error: "Falta el secret PEXELS_API_KEY en Supabase (Edge Functions → Secrets)" }, 500);

  const api = `https://api.pexels.com/v1/search?query=${encodeURIComponent(termino)}&per_page=10&orientation=${orientacion}&locale=es-ES`;
  const r = await fetch(api, { headers: { Authorization: key } });
  if (!r.ok) {
    // si Pexels falla, intentamos devolver caché vencida antes que nada
    const { data: c } = await admin.from("imagenes_pexels").select("fotos,total").eq("clave", clave).maybeSingle();
    if (c?.fotos && (c.fotos as any[]).length) return json({ consulta: q || texto, termino, orientacion, fotos: (c.fotos as any[]).slice(0, n), total: c.total, atribucion: ATRIBUCION, desde_cache: true, aviso: `Pexels respondió ${r.status}` });
    return json({ error: `Pexels respondió ${r.status}`, detalle: await r.text().catch(() => "") }, 502);
  }
  const j = await r.json();
  const fotos = ((j?.photos || []) as any[]).map(mapFoto).filter((f) => f.url_grande);

  await admin.from("imagenes_pexels").upsert({
    clave, consulta: termino, orientacion, fotos, total: j?.total_results ?? fotos.length, actualizado_en: new Date().toISOString(),
  });

  return json({ consulta: q || texto, termino, orientacion, fotos: fotos.slice(0, n), total: j?.total_results ?? fotos.length, atribucion: ATRIBUCION, desde_cache: false });
});
