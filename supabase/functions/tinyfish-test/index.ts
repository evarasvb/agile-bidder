// PRUEBA (no producción): valida si el Agent API de TinyFish puede resolver el
// panel "Adjuntos" de Mercado Público (ViewAttachment.aspx), que hoy exige
// reCAPTCHA y por eso licitacion-adjuntos NO lo baja solo — solo guarda la URL
// para que el usuario la abra a mano (ver licitaciones_adjuntos_estado.url_adjuntos_mp
// / adjuntos_mp_solo_captcha).
// No escribe nada en tablas de producción: solo prueba y devuelve el resultado
// crudo para decidir si vale la pena conectarlo de verdad.
//   POST { probe: true }                 -> confirma que la clave/API responde (sin gastar en un licitación real)
//   POST { limit?: 1..10 (3) }            -> toma esa cantidad de licitaciones con adjuntos_mp_solo_captcha=true
//                                            y le pide al Agent que liste/baje las bases de cada una
//   POST { codigos: ["1234-56-LE26"] }    -> prueba códigos puntuales en vez de tomarlos de la cola
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const TINYFISH_BASE = "https://api.tinyfish.ai";

async function tf(key: string, path: string, payload: unknown) {
  const r = await fetch(`${TINYFISH_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(90_000),
  });
  const text = await r.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* deja texto crudo */ }
  return { status: r.status, ok: r.ok, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: key } = await admin.rpc("secreto_vault", { p_nombre: "tinyfish_api_key_test" });
    if (!key || typeof key !== "string") return json({ error: "sin_clave_tinyfish" }, 500);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    if (body.probe) {
      // Llamada mínima solo para confirmar auth + ver la forma real de la respuesta/errores.
      const r = await tf(key, "/v1/agent/run", { goal: "Responde solo con la palabra OK, sin navegar a ningún sitio." });
      return json({ probe: true, resultado: r });
    }

    let codigos: string[] = Array.isArray(body.codigos) ? body.codigos.map(String) : [];
    let candidatos: Record<string, unknown>[] = [];
    if (!codigos.length) {
      const limite = Math.min(Math.max(Number(body.limit) || 3, 1), 10);
      const { data, error } = await admin
        .from("licitaciones_adjuntos_estado")
        .select("codigo, url_adjuntos_mp")
        .eq("adjuntos_mp_solo_captcha", true)
        .not("url_adjuntos_mp", "is", null)
        .order("revisado_en", { ascending: false })
        .limit(limite);
      if (error) return json({ error: error.message }, 500);
      candidatos = data ?? [];
      codigos = candidatos.map((c) => String(c.codigo));
    } else {
      const { data } = await admin.from("licitaciones_adjuntos_estado").select("codigo, url_adjuntos_mp").in("codigo", codigos);
      candidatos = data ?? [];
    }

    if (!candidatos.length) return json({ mensaje: "No hay licitaciones en cola (adjuntos_mp_solo_captcha) para probar ahora mismo.", codigos });

    const resultados = [];
    for (const c of candidatos) {
      const url = String(c.url_adjuntos_mp ?? "");
      if (!url) { resultados.push({ codigo: c.codigo, error: "sin_url" }); continue; }
      const goal = `Entra a esta página de adjuntos de una licitación pública chilena (Mercado Público): ${url}. ` +
        `Lista los nombres de los archivos adjuntos que encuentres. Si hay un archivo PDF cuyo nombre sugiera que son las ` +
        `"Bases" (administrativas, técnicas o de la licitación), descárgalo y devuélveme su contenido como texto o un enlace ` +
        `de descarga. Si la página pide resolver un reCAPTCHA u otro desafío que no puedas pasar, dilo explícitamente.`;
      const r = await tf(key, "/v1/agent/run", { goal, url });
      resultados.push({ codigo: c.codigo, url, resultado: r });
    }
    return json({ probados: resultados.length, resultados });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
