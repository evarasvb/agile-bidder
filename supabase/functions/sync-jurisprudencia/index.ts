// Sincroniza jurisprudencia de compras públicas:
//   - Causas: dictámenes de la Contraloría General de la República (CGR) vía su API pública
//     de búsqueda (https://www.contraloria.cl/apibusca/search/dictamenes).
//   - Demandas: publicaciones del Tribunal de Contratación Pública (TCP), sitio WordPress,
//     vía su REST API estándar (/wp-json/wp/v2/posts).
// Cada entrada se guarda en experto.fragmentos con fuente 'Causa:' o 'Demanda:' para citas [n].
// Parseo defensivo: solo se inserta lo que trae URL y texto reales; si una fuente falla, se
// omite y se reporta en la respuesta. Nunca se inventan fallos ni dictámenes.
// Además siempre se refrescan las fuentes oficiales de referencia (fixture verificado).

import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

function rolJwt(auth: string | null): string | null {
  try { return JSON.parse(atob((auth ?? "").replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? null; } catch { return null; }
}

const UA = "FirmaVB/1.0 (+https://www.firmavb.cl)";
// Quita etiquetas HTML y normaliza espacios.
const limpiar = (s: string) => String(s ?? "")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
  .replace(/&#8230;/g, "…").replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\s+/g, " ").trim();
const fechaISO = (s: unknown): string | null => { const t = Date.parse(String(s ?? "")); return isNaN(t) ? null : new Date(t).toISOString(); };

// Fuentes oficiales de referencia (siempre presentes; URLs verificadas).
const REFERENCIA = [
  { tipo: "demanda", numero: "TCP", titulo: "Tribunal de Contratación Pública — cómo y cuándo reclamar",
    url: "https://tribunaldecontratacionpublica.cl/demanda-y-tramitacion/",
    texto: "El Tribunal de Contratación Pública (TCP) conoce la acción de impugnación contra actos u omisiones ilegales o arbitrarios en los procedimientos regidos por la Ley 19.886, entre la aprobación de las bases y la adjudicación, ambas inclusive. La demanda tiene un plazo fatal de 10 días hábiles (administrativos) desde que se tomó conocimiento del acto o desde su publicación en Mercado Público. Puede interponerla cualquier persona con interés actualmente comprometido.", fecha: "2003-07-30" },
  { tipo: "causa", numero: "CGR-Jurisprudencia", titulo: "Contraloría General de la República — Buscador de Jurisprudencia",
    url: "https://www.contraloria.cl/web/cgr/buscar-jurisprudencia",
    texto: "Buscador oficial de la jurisprudencia administrativa (dictámenes) de la Contraloría. Fija criterios obligatorios para los organismos en trato directo, convenios marco, modificaciones de contrato, probidad y conflictos de interés.", fecha: "2008-08-20" },
];

// --- Contraloría: dictámenes vía API de búsqueda ---
async function scrapeCGR(diag: Record<string, unknown>): Promise<any[]> {
  const filas: any[] = [];
  const terminos = ["compras públicas", "licitación pública", "trato directo", "convenio marco"];
  let ok = 0;
  for (const term of terminos) {
    try {
      const r = await fetch("https://www.contraloria.cl/apibusca/search/dictamenes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": UA },
        body: JSON.stringify({ search: term, exact_search: false, options: {}, order: "desc", date_name: "fecha_documento", source: "dictamenes", page: 1 }),
      });
      if (!r.ok) { diag[`cgr:${term}`] = `HTTP ${r.status}`; continue; }
      const j = await r.json();
      // Respuesta Elasticsearch: hits.hits[] con _id (id del dictamen) y _source (campos).
      const items: any[] = j?.hits?.hits ?? j?.resultados ?? j?.results ?? [];
      let n = 0;
      for (const it of items.slice(0, 6)) {
        const s = it?._source ?? it ?? {};
        const docId = String(it?._id ?? s.doc_id ?? "").trim();
        const numero = String(s.n_dictamen ?? s.numeric_doc_id ?? docId ?? "").trim();
        const titulo = limpiar(s.materia ?? s.descriptores ?? s.tema ?? (numero ? `Dictamen ${numero}` : ""));
        const cuerpo = limpiar(s.documento_completo ?? [s.materia, s.descriptores].filter(Boolean).join(". "));
        // URL pública real del dictamen (verificada): /pdfbuscador/dictamenes/{docId}/html
        const url = docId ? `https://www.contraloria.cl/pdfbuscador/dictamenes/${encodeURIComponent(docId)}/html` : "";
        const texto = cuerpo || titulo;
        if (!url || !texto || texto.length < 30) continue;
        filas.push({ tipo: "causa", numero: numero ? `CGR ${numero}` : "CGR", titulo: (titulo || "Dictamen CGR").slice(0, 300), url: url.slice(0, 500), texto: texto.slice(0, 1500), fecha: fechaISO(s.fecha_documento ?? s.fecha) });
        n++;
      }
      ok += n; diag[`cgr:${term}`] = n;
    } catch (e) { diag[`cgr:${term}`] = String((e as Error)?.message ?? e); }
  }
  diag.cgr_total = ok;
  return filas;
}

// --- Tribunal de Contratación Pública: posts vía WordPress REST ---
async function scrapeTCP(diag: Record<string, unknown>): Promise<any[]> {
  const filas: any[] = [];
  try {
    const r = await fetch("https://tribunaldecontratacionpublica.cl/wp-json/wp/v2/posts?per_page=15&_fields=title,excerpt,link,date", {
      headers: { "Accept": "application/json", "User-Agent": UA },
    });
    if (!r.ok) { diag.tcp = `HTTP ${r.status}`; return filas; }
    const posts = await r.json();
    if (!Array.isArray(posts)) { diag.tcp = "sin_lista"; return filas; }
    let n = 0;
    for (const p of posts) {
      const titulo = limpiar(p?.title?.rendered ?? p?.title ?? "");
      const cuerpo = limpiar(p?.excerpt?.rendered ?? p?.excerpt ?? "");
      const url = String(p?.link ?? "").trim();
      const texto = cuerpo || titulo;
      if (!url || !texto || texto.length < 20) continue;
      filas.push({ tipo: "demanda", numero: "TCP", titulo: titulo.slice(0, 300), url: url.slice(0, 500), texto: texto.slice(0, 1500), fecha: fechaISO(p?.date) });
      n++;
    }
    diag.tcp = n;
  } catch (e) { diag.tcp = String((e as Error)?.message ?? e); }
  return filas;
}

Deno.serve(async (req) => {
  if (rolJwt(req.headers.get("authorization")) !== "service_role") return json({ error: "no autorizado" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const diag: Record<string, unknown> = {};

  try {
    const [cgr, tcp] = await Promise.all([scrapeCGR(diag), scrapeTCP(diag)]);
    const filas = [...REFERENCIA, ...cgr, ...tcp];

    const { data, error } = await sb.rpc("jurisprudencia_insertar", { p_filas: filas });
    if (error) return json({ error: error.message, diag }, 500);

    return json({ leidas: filas.length, nuevas: data ?? 0, diag });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e), diag }, 500);
  }
});
