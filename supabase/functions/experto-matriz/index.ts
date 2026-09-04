// Matriz de postulación (plan Pro): todo lo que hay que cumplir, entregar y cómo se puntúa,
// como checklist trabajable (pantalla, Excel, Word, PDF). Se guarda en el libro (modo 'matriz').
// Usa ficha, bases, documentos de trabajo del usuario y su perfil de empresa.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODELOS = [Deno.env.get("GEMINI_MODEL_INFORME"), "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite"].filter(Boolean) as string[];
function rolYSub(auth: string): { role: string; sub: string | null } {
  try { const p = JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return { role: p.role ?? "", sub: p.sub ?? null }; }
  catch { return { role: "", sub: null }; }
}
function resumenPlano(r: any): string {
  const v = (x: any): string => x == null || x === "" ? "no indicado" : Array.isArray(x) ? (x.length ? x.map(v).join("; ") : "ninguno indicado") : typeof x === "object" ? Object.entries(x).map(([k, y]) => `${k.replace(/_/g, " ")}: ${v(y)}`).join(", ") : String(x);
  return Object.entries(r).map(([k, y]) => `- ${k.replace(/_/g, " ")}: ${v(y)}`).join("\n");
}
const SYS = `Eres el Experto FirmaVB, asesor con 17 años vendiéndole al Estado chileno. Construyes la MATRIZ DE POSTULACIÓN de una licitación para un proveedor pyme: todo lo que hay que cumplir, entregar y cómo se puntúa, para trabajarla como checklist (pantalla, Excel, Word o PDF).
Responde SOLO con JSON válido (sin markdown) con esta forma exacta:
{"titulo":"Matriz de postulación · código · nombre corto","resumen":"2 frases: qué es y veredicto",
 "umbral_adjudicacion": número (puntaje mínimo para adjudicar si las bases lo fijan) o null,
 "admisibilidad":[{"requisito":"...","regla":"qué exige exactamente (cifra, plazo, formato)","fuente":"sección o numeral de las bases, o 'ficha'","chequeo":{"tipo":"si_no|minimo|maximo|rango|texto","esperado":"solo si_no: la respuesta que CUMPLE, 'SÍ' o 'NO' (p. ej. 'NO' para '¿registra deudas previsionales?')","umbral":número o null,"umbral2":número o null (solo rango),"unidad":"meses|horas hábiles|%|días|... o null"},"entrada":"dato actual del proveedor si se sabe por sus documentos o perfil ('SÍ', 'NO' o un número), si no null","estado":"pendiente|cumple|no_cumple|revisar","nota":"cómo cumplirlo o qué falta según los documentos del proveedor"}],
 "evaluacion":[{"criterio":"...","como_se_puntua":"fórmula o escala","ponderacion":"% o puntos","ponderacion_num":número entre 0 y 1 o null,"puntaje_max":"...","puntaje_max_num":número o null,"puntaje_estimado":número que el proveedor probablemente obtiene según sus documentos o null,"que_hacer":"qué hacer para el máximo puntaje","fuente":"..."}],
 "anexos":[{"anexo":"Anexo N° y nombre","obligatorio":true,"cuando":"siempre | solo UTP | solo Cloud | ...","quien_firma":"...","nota":"..."}],
 "reglas_especiales":[{"aspecto":"...","regla":"..."}],
 "tareas":[{"fase":"1. Administrativo y legal | 2. Comercial y precio | 3. Técnico | 4. Anexos y firmas | 5. Garantías | 6. Envío","documento":"...","responsable":"Proveedor | Representante legal | Cliente final | Partner | FirmaVB","accion":"acción concreta","plazo":"fecha o 'X días antes del cierre'","estado":"pendiente|ok"}],
 "fechas":[{"hito":"...","fecha":"..."}]}
Usa SOLO los datos entregados (bases, ficha, documentos del proveedor, perfil de la empresa). El "chequeo" sirve para fórmulas de Excel: usa si_no para requisitos de sí o no (inscripción, declaración, aceptación), minimo/maximo/rango para cifras (garantía mínima en meses, SLA máximo en horas, descuento entre 2 y 10) con el umbral exacto de las bases, y texto para el resto. Si hay DOCUMENTOS DEL PROVEEDOR, úsalos para marcar estado cumple/ok y anotar en "nota" lo que ya está listo y lo que falta. Si algo no está en las fuentes, estado "revisar" y nota "revisar en bases". Máximo 25 filas por lista. Español chileno, directo, cifras exactas, sin inventar.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { role, sub } = rolYSub(req.headers.get("Authorization") ?? "");
    const body = await req.json().catch(() => ({}));
    const userId = role === "authenticated" ? sub : role === "service_role" ? (body.user_id ?? null) : null;
    if (!userId) return json({ error: "login", mensaje: "Inicia sesión para generar la matriz." }, 401);
    const codigo = String(body.codigo ?? "").trim().toUpperCase();
    if (!/^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2}$/.test(codigo)) return json({ error: "codigo" }, 400);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: uso } = await sb.rpc("experto_uso_mes", { p_user_id: userId, p_huella: "libro" });
    const u = uso?.[0] ?? { plan: "free" };
    if (!u.plan || u.plan === "free") return json({ error: "pro", mensaje: "La matriz de postulación es del plan Pro: $50.000 por 30 días, con estudios, matrices y preguntas sin límite.", uso: u }, 402);

    const [ficha, bases, docs, perfil] = await Promise.all([
      sb.rpc("experto_ficha_licitacion", { p_codigo: codigo }).then((r) => r.data),
      sb.rpc("experto_bases_texto", { p_codigo: codigo }).then((r) => r.data ?? []),
      sb.rpc("experto_documentos_texto", { p_user_id: userId, p_codigo: codigo, p_max: 12000 }).then((r) => r.data ?? []),
      sb.from("clientes").select("empresa_nombre, rut_empresa, representante_nombre, representante_rut, giros, region, categoria_negocio").eq("user_id", userId).maybeSingle().then((r) => r.data),
    ]);
    if (!ficha && !bases.length) return json({ error: "sin_datos", mensaje: `No tengo ficha ni bases de ${codigo}.` }, 404);
    const f = ficha ?? {};
    const partes: string[] = [];
    if (ficha) partes.push(`FICHA: ${f.codigo} ${f.nombre} | ${f.institucion} | ${f.tipo ?? ""} | presupuesto ${f.presupuesto ?? "s/i"} | publicada ${f.fecha_publicacion ?? ""} | cierre ${f.fecha_cierre ?? ""} | pago ${f.tipo_pago ?? ""} | ${String(f.descripcion ?? "").slice(0, 800)}\nÍTEMS: ${(f.items ?? []).slice(0, 15).map((i: any) => `${i.producto} x${i.cantidad ?? ""}`).join("; ")}`);
    (bases as any[]).forEach((b) => {
      const secs = (Array.isArray(b.secciones) ? b.secciones : []).filter((s: any) => /admisib|requisit|anexo|criterio|evalua|puntaj|ponder|garant|plazo|utp|uni[oó]n temporal|multa|entrega|oferta/i.test(String(s.texto)));
      let total = 0; const elegidas: any[] = [];
      for (const s of secs) { const t = String(s.texto).slice(0, 3000); if (total + t.length > 30000) break; elegidas.push({ titulo: s.titulo, texto: t }); total += t.length; }
      partes.push(`BASES "${b.archivo}" (${b.paginas ?? "?"} páginas)\nRESUMEN (extraído del PDF; "no indicado" = las bases no lo exigen o no lo mencionan):\n${b.resumen ? resumenPlano(b.resumen) : "(sin resumen)"}\nSECCIONES RELEVANTES:\n${elegidas.map((s) => `## ${s.titulo}\n${s.texto}`).join("\n\n")}`);
    });
    if ((docs as any[]).length) partes.push("DOCUMENTOS DEL PROVEEDOR (subidos por el usuario; úsalos para marcar qué ya está listo):\n" + (docs as any[]).map((d) => `### ${d.nombre} (${d.tipo})\n${d.texto}`).join("\n\n"));
    if (perfil) partes.push(`PERFIL DE LA EMPRESA: ${perfil.empresa_nombre ?? "s/i"}, RUT ${perfil.rut_empresa ?? "s/i"}, representante ${perfil.representante_nombre ?? "s/i"} (${perfil.representante_rut ?? "s/i"}), giros ${(perfil.giros ?? []).join?.(", ") || perfil.giros || "s/i"}, región ${perfil.region ?? "s/i"}, rubro ${perfil.categoria_negocio ?? "s/i"}`);
    const key = Deno.env.get("GEMINI_API_KEY"); if (!key) return json({ error: "sin_ia" }, 500);
    let matriz: any = null;
    for (const model of [...MODELOS, "espera", ...MODELOS]) {
      if (model === "espera") { await new Promise((ok) => setTimeout(ok, 2500)); continue; }
      const r = await fetch(GEMINI_URL, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0.2, max_tokens: 7000, messages: [{ role: "system", content: SYS }, { role: "user", content: partes.join("\n\n") + `\n\nGenera la matriz de postulación de ${codigo}.` }] }) });
      if (!r.ok) { console.error("gemini", model, r.status); continue; }
      let c = String((await r.json()).choices?.[0]?.message?.content ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const a = c.indexOf("{"), z = c.lastIndexOf("}"); if (a >= 0 && z > a) c = c.slice(a, z + 1);
      try { matriz = JSON.parse(c); break; } catch { console.error("json", model); }
    }
    if (!matriz) return json({ error: "ia_no_disponible", mensaje: "El modelo no respondió bien. Intenta de nuevo en un minuto." }, 502);
    matriz.generada_en = new Date().toISOString(); matriz.codigo = codigo;
    try { await sb.rpc("experto_registrar_uso", { p_user_id: userId, p_huella: "libro", p_modo: "matriz", p_pregunta: `matriz ${codigo}`, p_respuesta: JSON.stringify(matriz), p_fuentes: [], p_licitacion: codigo, p_ms: 0, p_ip: null }); } catch { /* no bloquear */ }
    return json({ ok: true, codigo, matriz, documentos: (docs as any[]).length });
  } catch (e) { return json({ error: String((e as Error)?.message ?? e) }, 500); }
});
