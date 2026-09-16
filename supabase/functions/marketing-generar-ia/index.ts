// FirmaVB — genera el contenido de una campaña de marketing con IA a partir de
// una idea suelta del admin ("convocar a proveedores del Estado a una charla").
// Devuelve nombre, objetivo y el contenido ya armado para cada canal elegido
// (email, facebook, instagram, whatsapp), en la voz de FirmaVB.
//   POST { idea, canales: string[], nombre_sugerido? } -> JSON con el contenido
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODELOS = [Deno.env.get("GEMINI_MODEL_INFORME"), "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite"].filter(Boolean) as string[];

const CANALES_VALIDOS = ["email", "facebook", "instagram", "whatsapp"];

const SYS = `Eres el redactor de marketing de FirmaVB. FirmaVB es el software de Enrique Varas — 17 años vendiéndole al Estado chileno — que ayuda a pymes proveedoras a encontrar y ganar licitaciones y compras ágiles en Mercado Público (matching por inventario, alertas, el Experto con IA, cotizaciones).
Hablas como Enrique: de tú, cercano, directo, como alguien que ya pasó por esto y te lo cuenta sin adornos. Frases cortas. Nunca "estimado/a", nunca corporativo, nunca estilo newsletter genérico. Siempre un beneficio concreto y una acción clara.
Con la idea que te dan, arma el contenido para CADA canal pedido:
- email: "asunto" (corto, sin clickbait, que genere ganas de abrir) y "contenido_html" — un email en HTML simple tipo carta personal (usa <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;max-width:560px;margin:0 auto;padding:8px 4px;"> con <p> cortos, un botón <a style="background:#1E40AF;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;"> si hace falta un link, y firma "Enrique Varas · Fundador de FirmaVB"). Sin placeholders tipo [nombre] ni [link] — si falta un dato real, escribe el texto sin ese hueco.
- facebook / instagram: "caption" (texto del post, cercano, con un gancho en la primera línea) y "hashtags" (3 a 6, relevantes, sin inventar marcas ajenas).
- whatsapp: "mensaje" (corto, como si lo escribieras tú a un contacto, sin formato de email).
También arma "nombre" (nombre corto de la campaña, 3-6 palabras) y "objetivo" (una frase: qué se busca lograr).
Responde SOLO con JSON válido, sin texto antes ni después, con esta forma exacta (omite las claves de canales no pedidos):
{"nombre":"...","objetivo":"...","email":{"asunto":"...","contenido_html":"..."},"facebook":{"caption":"...","hashtags":"#uno #dos"},"instagram":{"caption":"...","hashtags":"#uno #dos"},"whatsapp":{"mensaje":"..."}}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "sin_auth" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await sb.auth.getUser(auth.replace("Bearer ", ""));
    if (!user || user.email !== "evaras@firmavb.cl") return json({ error: "no_autorizado" }, 403);

    const body = await req.json().catch(() => ({}));
    const idea = String(body.idea ?? "").trim();
    if (!idea) return json({ error: "falta_idea", mensaje: "Cuéntame la idea de la campaña." }, 400);
    const canales = (Array.isArray(body.canales) ? body.canales : []).filter((c: unknown) => CANALES_VALIDOS.includes(String(c)));
    if (!canales.length) return json({ error: "faltan_canales", mensaje: "Elige al menos un canal." }, 400);
    const nombreSugerido = String(body.nombre_sugerido ?? "").trim();

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "sin_ia" }, 500);

    const userMsg = `IDEA DE LA CAMPAÑA: ${idea}\nCANALES PEDIDOS: ${canales.join(", ")}${nombreSugerido ? `\nNOMBRE QUE YA TENÍA EN MENTE (úsalo o mejóralo): ${nombreSugerido}` : ""}`;

    let texto = "";
    for (const modelo of MODELOS) {
      const r = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelo,
          messages: [{ role: "system", content: SYS }, { role: "user", content: userMsg }],
          temperature: 0.6,
          max_tokens: 2500,
        }),
      });
      if (!r.ok) { console.error("gemini", modelo, r.status, (await r.text()).slice(0, 200)); continue; }
      const j = await r.json();
      texto = j.choices?.[0]?.message?.content ?? "";
      if (texto) break;
    }
    if (!texto) return json({ error: "ia_no_disponible" }, 502);

    // El modelo a veces envuelve el JSON en ```json ... ``` pese a la instrucción.
    const limpio = texto.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
    let contenido: Record<string, unknown>;
    try { contenido = JSON.parse(limpio); } catch {
      return json({ error: "respuesta_invalida", mensaje: "La IA no devolvió un JSON válido, intenta de nuevo." }, 502);
    }

    return json({ ok: true, contenido });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
