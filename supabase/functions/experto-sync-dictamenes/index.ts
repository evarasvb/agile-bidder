import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Trae los dictámenes de Contraloría más recientes que citan la Ley 19.886 y
// los agrega a experto.fragmentos si aún no están.
const API = "https://www.contraloria.cl/apibusca/search/dictamenes";

function rolDelJwt(auth: string): string {
  try {
    const t = auth.replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role ?? "";
  } catch { return ""; }
}

function chunkDoc(id: string, s: Record<string, string>) {
  const t = (s.documento_completo ?? "").trim().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  const fecha = (s.fecha_documento ?? "").slice(0, 10);
  const num = s.numeric_doc_id ?? id;
  const fuente = `Dictamen Contraloría N° ${num} (${fecha})`;
  const url = `https://www.contraloria.cl/pdfbuscador/dictamenes/${id}/html`;
  const cab = `Materia: ${(s.materia ?? "").trim()}\nDescriptores: ${(s.descriptores ?? "").trim()}\nFuentes legales: ${(s.fuentes_legales ?? "").trim()}\nCriterio: ${s.criterio ?? ""}`;
  const sec = (s.descriptores ?? "").trim().slice(0, 150) || "dictamen";
  const paras = t.split(/\n\s*\n/).filter((p) => p.trim());
  const out: any[] = [];
  let buf = cab + "\n\n", n = 0;
  const push = () => { n++; out.push({ fuente, seccion: sec, orden: n, url, texto: buf.trim() }); buf = `${fuente} (continuación)\n`; };
  for (const p of paras) {
    if (buf.length + p.length > 2000 && buf.trim()) push();
    buf += p + "\n\n";
  }
  if (buf.trim() && buf.trim() !== `${fuente} (continuación)`) push();
  return { fuente, out };
}

Deno.serve(async (req: Request) => {
  if (rolDelJwt(req.headers.get("Authorization") ?? "") !== "service_role") {
    return new Response(JSON.stringify({ error: "no autorizado" }), { status: 401 });
  }
  const { paginas = 5 } = await req.json().catch(() => ({}));
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let nuevos = 0, fragmentos = 0, vistos = 0;
  const nuevosIds: string[] = [];
  for (let page = 0; page < paginas; page++) {
    const r = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
      body: JSON.stringify({ search: "ley 19.886", exact_search: false, options: [], order: "date", date_name: "fecha_documento", source: "dictamenes", page }),
    });
    if (!r.ok) break;
    const d = await r.json();
    const hits = d?.hits?.hits ?? [];
    if (!hits.length) break;
    for (const h of hits) {
      vistos++;
      const { fuente, out } = chunkDoc(h._id, h._source);
      const { data: existe } = await supabase.rpc("experto_existe_fuente", { p_fuente: fuente });
      if (existe) continue;
      const { data, error } = await supabase.rpc("experto_insertar", { filas: out.map((f) => ({ ...f, embedding: null })) });
      if (error) return new Response(JSON.stringify({ error: error.message, nuevos, fragmentos }), { status: 500 });
      nuevos++; fragmentos += data ?? out.length; nuevosIds.push(h._id);
    }
  }
  return new Response(JSON.stringify({ ok: true, vistos, nuevos, fragmentos, ids: nuevosIds }), { headers: { "Content-Type": "application/json" } });
});
