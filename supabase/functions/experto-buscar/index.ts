import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const session = new Supabase.ai.Session("gte-small");
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { pregunta, cantidad = 6 } = await req.json();
    if (!pregunta || typeof pregunta !== "string") {
      return new Response(JSON.stringify({ error: "falta pregunta" }), { status: 400, headers: cors });
    }
    const emb = await session.run(pregunta, { mean_pool: true, normalize: true });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase.rpc("experto_buscar", {
      consulta_embedding: JSON.stringify(Array.from(emb as number[])),
      cantidad: Math.min(Number(cantidad) || 6, 12),
      umbral: 0.3,
    });
    if (error) throw error;
    return new Response(JSON.stringify({ fragmentos: data }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: cors });
  }
});
