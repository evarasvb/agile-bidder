// Amplía las palabras clave de un cliente a un CONCEPTO más amplio usando IA:
// sinónimos, variantes de escritura, y términos que aparecen en licitaciones/
// compras ágiles del Estado con el mismo sentido pero otras palabras.
// No reemplaza palabras_incluir (lo que el cliente escribió) — se guarda
// aparte en palabras_incluir_ia y el panel filtra por la unión de ambas.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

async function callGemini(key: string, model: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`${model} http_${r.status}: ${t.slice(0, 200)}`);
  }
  const data = await r.json();
  const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return JSON.parse(txt);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { cliente_id, palabras } = await req.json().catch(() => ({}));
    if (!cliente_id) return json({ error: "falta cliente_id" }, 400);

    const palabrasLimpias: string[] = Array.isArray(palabras)
      ? Array.from(new Set(palabras.map((p: unknown) => norm(String(p))).filter(Boolean)))
      : [];
    if (palabrasLimpias.length === 0) {
      return json({ error: "falta palabras (array no vacío)" }, 400);
    }

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "GEMINI_API_KEY no configurada" }, 500);

    const prompt = `Eres experto en compras públicas de Chile (Mercado Público: licitaciones y compras ágiles).
Un proveedor definió estas palabras clave de lo que vende: ${palabrasLimpias.join(", ")}.

Los organismos del Estado redactan sus bases con vocabulario propio, que muchas veces NO usa
exactamente estas palabras aunque pidan lo mismo. Tu tarea: para CADA palabra, genera 2-5 términos
relacionados que podrían aparecer en el título o descripción de una licitación o compra ágil que
en realidad busca eso — sinónimos, la forma en que el Estado lo nombra formalmente, variantes de
escritura (con/sin tilde, singular/plural), y la categoría o familia de producto/servicio a la que
pertenece. NO agregues marcas comerciales. NO agregues palabras genéricas que no tengan relación
directa (nada de "oficina", "insumos" sueltos si no venían en la lista).

Ejemplos del tipo de amplitud esperada:
- "toner" → tóner, cartucho de tóner, consumible de impresión, cartucho láser, toner laser
- "mouse" → ratón, mouse óptico, mouse inalámbrico, periférico computacional
- "notebook" → laptop, computador portátil, notebook computacional
- "aseo" → limpieza, artículos de aseo, insumos de limpieza, elementos de aseo y ornato

Responde SOLO un JSON con esta forma exacta:
{"expansion": {"<palabra original 1>": ["termino1", "termino2", ...], "<palabra original 2>": [...]}}`;

    const envModel = Deno.env.get("GEMINI_MODEL");
    const modelos = Array.from(
      new Set([envModel, "gemini-3.6-flash", "gemini-flash-latest", "gemini-flash-lite-latest"].filter(Boolean))
    ) as string[];

    let expansion: Record<string, string[]> | null = null;
    let lastErr = "";
    for (const modelo of modelos) {
      try {
        const parsed = await callGemini(key, modelo, prompt);
        if (parsed?.expansion && typeof parsed.expansion === "object") {
          expansion = parsed.expansion;
          break;
        }
        lastErr = `${modelo}: respuesta sin campo "expansion"`;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }

    if (!expansion) {
      return json({ error: "No se pudo ampliar con IA", detalle: lastErr }, 502);
    }

    // Aplana, normaliza y deduplica todos los términos generados (sin duplicar
    // las palabras originales, que ya se guardan aparte en palabras_incluir).
    const originales = new Set(palabrasLimpias);
    const ampliadas = new Set<string>();
    for (const palabraOriginal of Object.keys(expansion)) {
      const lista = expansion[palabraOriginal];
      if (!Array.isArray(lista)) continue;
      for (const termino of lista) {
        const n = norm(String(termino));
        if (n && n.length > 2 && !originales.has(n)) ampliadas.add(n);
      }
    }
    const palabrasIncluirIa = Array.from(ampliadas).slice(0, 120);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { error: upsertError } = await supabase
      .from("cliente_filtros_oportunidades")
      .upsert(
        { cliente_id, palabras_incluir_ia: palabrasIncluirIa, updated_at: new Date().toISOString() },
        { onConflict: "cliente_id" }
      );
    if (upsertError) {
      console.error("expandir-conceptos upsert error:", upsertError);
      return json({ error: "No se pudo guardar la ampliación", detalle: upsertError.message }, 500);
    }

    return json({ palabras_incluir_ia: palabrasIncluirIa, expansion });
  } catch (e) {
    console.error("expandir-conceptos error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
