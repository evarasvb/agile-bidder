// Onboarding "Tu empresa": a partir del RUT y de la descripción que el cliente
// escribe en sus palabras, arma el perfil de búsqueda (palabras clave +
// industrias). Cruza lo que dice con lo que REALMENTE ha vendido al Estado
// (perfil_por_rut sobre las OC históricas) y la IA lo traduce al vocabulario
// con que el Estado redacta sus compras. No guarda nada: el front muestra la
// sugerencia y el cliente la confirma.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const INDUSTRIAS = ["medico", "oficina", "alimentos", "tecnologia", "educacion", "servicios", "mobiliario", "aseo", "construccion", "automotriz", "textil", "otro"];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// Palabras que traen ruido: medidas, modelos, genéricos que calzan con todo.
const RUIDO = new Set([
  "servicio", "servicios", "insumos", "insumo", "productos", "producto", "materiales", "material", "varios",
  "otros", "general", "equipos", "equipo", "articulos", "articulo", "informacion", "gestion", "compra",
  "adquisicion", "suministro", "core", "ultra", "pro", "plus", "kit", "set", "tipo", "unidad", "unidades",
]);
const esRuido = (p: string) => p.length < 4 || /\d/.test(p) || RUIDO.has(p);

async function gemini(key: string, model: string, prompt: string) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    }),
  });
  if (!r.ok) throw new Error(`${model} http_${r.status}`);
  const d = await r.json();
  return JSON.parse(d?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "no autenticado" }, 401);

    const { descripcion, rut } = await req.json().catch(() => ({}));
    const desc = String(descripcion || "").trim().slice(0, 1500);
    if (desc.length < 40) return json({ error: "La descripción debe tener al menos 40 caracteres" }, 400);

    // 1) Lo que la empresa ya le vendió al Estado (si vende).
    let historial: any = null;
    if (rut) {
      const { data } = await userClient.rpc("perfil_por_rut", { p_rut: String(rut) });
      historial = data || null;
    }
    const vendidos: string[] = (historial?.top_productos || [])
      .filter((p: any) => p?.categoria && p.categoria !== "NA")
      .map((p: any) => String(p.producto))
      .slice(0, 10);

    // 2) IA: traduce descripción + historial al vocabulario del Estado.
    const prompt = `Eres experto en compras públicas de Chile (Mercado Público).
Una empresa describe lo que vende así: """${desc}"""
${vendidos.length ? `Como referencia, sus órdenes de compra históricas mencionan: ${vendidos.join("; ")}.` : "No registra ventas al Estado."}

REGLA CLAVE: básate SOBRE TODO en la descripción de la empresa. El historial es solo referencia: usa de él únicamente lo que sea COHERENTE con lo que la empresa dice vender, e IGNORA cualquier producto del historial que no tenga relación con su rubro (p. ej. una empresa de software educativo no debe recibir palabras de aseo o alimentos aunque aparezcan en su historial).

Devuelve el perfil de búsqueda para encontrarle licitaciones y compras ágiles:
- "palabras": 12 a 20 palabras o frases cortas (1 a 3 palabras) de PRODUCTOS o SERVICIOS concretos del rubro de la empresa, como los escribe un organismo público en el título de una compra. Todas deben ser plausibles para esta empresa según su descripción. Minúsculas, sin marcas, sin modelos, sin números, sin genéricos sueltos ("insumos", "servicios", "materiales", "equipos").
- "industrias": 1 a 3 ids de esta lista exacta: ${INDUSTRIAS.join(", ")}. Elige la(s) que de verdad calcen; si ninguna calza bien, usa "otro".
- "resumen": una frase de máximo 25 palabras que describa a la empresa para un comprador público.
Responde SOLO JSON: {"palabras": [...], "industrias": [...], "resumen": "..."}`;

    const key = Deno.env.get("GEMINI_API_KEY");
    let ia: any = null;
    if (key) {
      for (const m of [Deno.env.get("GEMINI_MODEL"), "gemini-3.6-flash", "gemini-flash-latest", "gemini-flash-lite-latest"].filter(Boolean) as string[]) {
        try { ia = await gemini(key, m, prompt); if (Array.isArray(ia?.palabras)) break; } catch (_) { /* siguiente modelo */ }
      }
    }

    // 3) Limpieza final. Antes se mezclaban SIEMPRE los productos históricos del
    //    RUT con las palabras de la IA, lo que ensuciaba el perfil (p. ej. un SaaS
    //    educativo recibía palabras de rubros ajenos que figuraban en su historial).
    //    Ahora la IA (que ya recibe el historial como referencia) manda; el historial
    //    crudo solo se usa de respaldo si la IA no devolvió nada.
    const base = Array.isArray(ia?.palabras) && ia.palabras.length ? ia.palabras : vendidos;
    const palabras = Array.from(new Set(
      base.map((p: unknown) => norm(String(p))).filter((p) => p && !esRuido(p) && p.split(" ").length <= 4),
    )).slice(0, 20);
    const industrias = (ia?.industrias || []).filter((i: string) => INDUSTRIAS.includes(i)).slice(0, 3);

    return json({
      palabras,
      industrias,
      resumen: typeof ia?.resumen === "string" ? ia.resumen : null,
      vende_al_estado: !!historial?.vende_al_estado,
      historial: historial?.resumen
        ? {
            razon_social: historial.nombre || null,
            monto_total: historial.resumen.monto_total ?? null,
            organismos: historial.resumen.organismos_distintos ?? null,
            ultima_venta: historial.resumen.ultima_venta ?? null,
          }
        : null,
      fuente: ia ? "ia" : "historial",
    });
  } catch (e) {
    console.error("perfil-empresa-ia", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
