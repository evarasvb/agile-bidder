import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// El token vive SOLO en el secreto EXPERTO_INDEXAR_TOKEN (Supabase → Edge Functions →
// Secrets). El literal que había antes en el código quedó expuesto a cualquiera con
// acceso al repo y debe considerarse comprometido: rotarlo al configurar el secreto.
const TOKEN = Deno.env.get("EXPERTO_INDEXAR_TOKEN") ?? "";
const session = new Supabase.ai.Session("gte-small");

function rolDelJwt(auth: string): string {
  try {
    const t = auth.replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role ?? "";
  } catch { return ""; }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  // Doble candado: el JWT debe ser de service_role (no basta ser un usuario logueado)
  // Y además el token del secreto, para escribir en la base de conocimiento compartida.
  if (!TOKEN || req.headers.get("x-indexar-token") !== TOKEN || rolDelJwt(req.headers.get("Authorization") ?? "") !== "service_role") {
    return new Response(JSON.stringify({ error: "no autorizado" }), { status: 401 });
  }
  const { fragmentos, sin_embedding = false } = await req.json();
  if (!Array.isArray(fragmentos) || fragmentos.length === 0) {
    return new Response(JSON.stringify({ error: "fragmentos vacío" }), { status: 400 });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const filas = [];
  for (const f of fragmentos) {
    let embedding: string | null = null;
    if (!sin_embedding) {
      const emb = await session.run(f.texto, { mean_pool: true, normalize: true });
      embedding = JSON.stringify(Array.from(emb as number[]));
    }
    filas.push({
      fuente: f.fuente,
      seccion: f.seccion ?? null,
      orden: f.orden ?? null,
      url: f.url ?? null,
      texto: f.texto,
      embedding,
    });
  }
  const { data, error } = await supabase.rpc("experto_insertar", { filas });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ ok: true, insertados: data }), {
    headers: { "Content-Type": "application/json" },
  });
});
