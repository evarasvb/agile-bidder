// Mapa conceptual de una licitación (estilo NotebookLM): árbol JSON navegable que se guarda
// en el libro (consultas modo 'mapa'). Usa ficha, resumen de bases e informe si existen.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODELOS = [Deno.env.get("GEMINI_MODEL_INFORME"), "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite"].filter(Boolean) as string[];
function rolYSub(auth: string): { role: string; sub: string | null } {
  try { const p = JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return { role: p.role ?? "", sub: p.sub ?? null }; }
  catch { return { role: "", sub: null }; }
}
const SYS = `Eres el Experto FirmaVB. Construyes un MAPA CONCEPTUAL navegable de una licitación chilena para un proveedor pyme.
Responde SOLO con JSON válido (sin markdown) con esta forma: {"t":"título corto","d":"una frase","h":[{"t":"...","d":"...","h":[...]}]}.
Raíz = la licitación. Ramas de primer nivel, en este orden y solo si hay datos: "Qué compran", "Fechas clave", "Cómo se gana (criterios)", "Requisitos y anexos", "Garantías y multas", "El organismo y cómo paga", "Competencia y precio", "Riesgos", "Mi jugada". Cada rama con 2 a 6 hijos concretos (dato, cifra o acción), máximo 3 niveles, "t" de hasta 60 caracteres y "d" de hasta 160. Usa SOLO los datos entregados; si falta algo, di "revisar en bases" en "d". Español chileno, directo.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { role, sub } = rolYSub(req.headers.get("Authorization") ?? "");
    const body = await req.json().catch(() => ({}));
    const userId = role === "authenticated" ? sub : role === "service_role" ? (body.user_id ?? null) : null;
    if (!userId) return json({ error: "login", mensaje: "Inicia sesión para generar el mapa." }, 401);
    const codigo = String(body.codigo ?? "").trim().toUpperCase();
    if (!/^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2}$/.test(codigo)) return json({ error: "codigo" }, 400);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [ficha, bases, informe] = await Promise.all([
      sb.rpc("experto_ficha_licitacion", { p_codigo: codigo }).then((r) => r.data),
      sb.rpc("experto_bases_texto", { p_codigo: codigo }).then((r) => r.data ?? []),
      sb.schema("experto").from("consultas").select("respuesta").eq("user_id", userId).eq("licitacion", codigo).in("modo", ["informe", "estudio"]).order("creado_en", { ascending: false }).limit(2).then((r) => r.data ?? []),
    ]);
    if (!ficha && !bases.length) return json({ error: "sin_datos", mensaje: `No tengo ficha ni bases de ${codigo}.` }, 404);
    const f = ficha ?? {}; const o = f.organismo ?? {};
    const datos = [
      ficha ? `FICHA: ${f.codigo} ${f.nombre} | ${f.institucion} | ${f.tipo ?? ""} | presupuesto ${f.presupuesto ?? "s/i"} | publicada ${f.fecha_publicacion ?? ""} | cierre ${f.fecha_cierre ?? ""} | pago ${f.tipo_pago ?? ""} | ${String(f.descripcion ?? "").slice(0, 800)}
ÍTEMS: ${(f.items ?? []).slice(0, 15).map((i: any) => `${i.producto} x${i.cantidad ?? ""}`).join("; ")}
ORGANISMO: conducta ${o.conducta_pago ?? "s/i"}, ${o.pago_promedio_dias ?? "s/i"} días, reclamos pago 12m ${o.reclamos_pago_12m ?? o.reclamos ?? "s/i"} (${o.reclamos_pago_por_100_procesos ?? "s/i"} por 100 procesos), top proveedores ${(o.top_proveedores ?? []).slice(0, 4).map((p: any) => p.proveedor).join(", ")}
COMPETENCIA: ${(f.competencia ?? []).slice(0, 5).map((c: any) => `${c.proveedor} ${c.ordenes} OC unit ${c.precio_unit_mediano}`).join("; ")}` : "",
      bases.length ? `RESUMEN DE BASES: ${JSON.stringify(bases[0].resumen ?? {}).slice(0, 4000)}` : "",
      ...(informe as any[]).map((i: any, k: number) => `${k === 0 ? "INFORME/ESTUDIO PREVIO" : "OTRO ENTREGABLE"}: ${String(i.respuesta).slice(0, 3500)}`),
    ].filter(Boolean).join("\n\n");
    const key = Deno.env.get("GEMINI_API_KEY"); if (!key) return json({ error: "sin_ia" }, 500);
    let mapa: any = null;
    for (const model of MODELOS) {
      const r = await fetch(GEMINI_URL, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0.2, max_tokens: 3500, messages: [{ role: "system", content: SYS }, { role: "user", content: datos + "\n\nGenera el mapa." }] }) });
      if (!r.ok) { console.error("gemini", model, r.status); continue; }
      let c = String((await r.json()).choices?.[0]?.message?.content ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const a = c.indexOf("{"), z = c.lastIndexOf("}"); if (a >= 0 && z > a) c = c.slice(a, z + 1);
      try { mapa = JSON.parse(c); break; } catch { console.error("json", model); }
    }
    if (!mapa) return json({ error: "ia_no_disponible" }, 502);
    try { await sb.rpc("experto_registrar_uso", { p_user_id: userId, p_huella: "libro", p_modo: "mapa", p_pregunta: `mapa ${codigo}`, p_respuesta: JSON.stringify(mapa), p_fuentes: [], p_licitacion: codigo, p_ms: 0, p_ip: null }); } catch { /* no bloquear */ }
    return json({ ok: true, codigo, mapa });
  } catch (e) { return json({ error: String((e as Error)?.message ?? e) }, 500); }
});
