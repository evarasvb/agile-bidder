import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN = "f9687223a2b5c176a164ad66ec214de2";
const session = new Supabase.ai.Session("gte-small");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  if (req.headers.get("x-indexar-token") !== TOKEN) {
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
