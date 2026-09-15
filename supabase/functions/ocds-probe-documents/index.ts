// PRUEBA (no producción): ¿la API OCDS de Mercado Público (api.mercadopublico.cl/APISOCDS/OCDS)
// trae tender.documents con URLs de bases/anexos descargables sin captcha, para licitaciones
// abiertas? sync-ocds hoy solo lee award/tender para procesos YA cerrados y no mira "documents".
//   GET ?codigo=1234-56-LE26
import { createClient } from "jsr:@supabase/supabase-js@2";
const API = "https://api.mercadopublico.cl/APISOCDS/OCDS";
Deno.serve(async (req) => {
  try {
    const codigo = new URL(req.url).searchParams.get("codigo") || "";
    if (!codigo) return new Response(JSON.stringify({ error: "falta codigo" }), { status: 400 });
    const r = await fetch(`${API}/tender/${codigo}`, { headers: { "User-Agent": "FirmaVB/1.0 (+https://www.firmavb.cl)", Accept: "application/json" } });
    const status = r.status;
    const j = await r.json().catch(() => null);
    const rel = j?.releases?.[j.releases.length - 1] ?? null;
    const tender = rel?.tender ?? null;
    const documents = tender?.documents ?? null;
    return new Response(JSON.stringify({
      codigo, status,
      tiene_releases: !!j?.releases?.length,
      tiene_tender: !!tender,
      documentos_count: Array.isArray(documents) ? documents.length : null,
      documentos_muestra: Array.isArray(documents) ? documents.slice(0, 5) : documents,
      claves_tender: tender ? Object.keys(tender) : null,
    }, null, 2), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 500 });
  }
});
