// Experto FirmaVB — ESTUDIO PROFUNDO (plan Pro). Para una licitación, mira hacia atrás todo lo
// parecido que compró ese organismo: quién ganó, a qué precio respecto del presupuesto, cuántos
// compitieron, quién es el incumbente, cómo paga, y (si están) las bases. Misma salida SSE que
// experto-consultar para reutilizar la interfaz.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODELOS = [Deno.env.get("GEMINI_MODEL_INFORME"), "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite"].filter(Boolean) as string[];
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fmt = (n: any) => n == null ? "s/i" : "$" + Math.round(Number(n)).toLocaleString("es-CL");
const fecha = (d: any) => d ? new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "s/i";
const pct = (a: any, b: any) => a != null && b ? Math.round(Number(a) / Number(b) * 100) + "%" : "s/i";
function rolYSub(auth: string): { role: string; sub: string | null } {
  try { const p = JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return { role: p.role ?? "", sub: p.sub ?? null }; }
  catch { return { role: "", sub: null }; }
}
function ipCliente(req: Request): string | null {
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = xff.length ? xff[xff.length - 1] : (req.headers.get("x-real-ip") ?? "").trim();
  return ip ? ip.slice(0, 64) : null;
}

const SYS = `Eres el Experto FirmaVB, asesor con 17 años vendiéndole al Estado chileno. Entregas a un proveedor pyme un ESTUDIO PROFUNDO de una licitación: no solo esta compra, sino el historial de compras parecidas del mismo organismo. Usa SOLO los datos y fuentes entregados. Español chileno, directo, con cifras. Formato Markdown con estas secciones exactas:

## 1. Qué compra este organismo y cada cuánto
Historial de procesos parecidos (código, fecha, estado, presupuesto). Si se repite cada año, dilo con las fechas.
## 2. Quién ha ganado y a qué precio
Tabla Markdown: Proceso | Fecha | Ganador | Monto adjudicado | % del presupuesto | N° oferentes. Luego el promedio del % adjudicado/presupuesto.
## 3. Incumbente y competencia
Quién gana más veces a este organismo, quién siempre postula, quién vende estos productos al Estado y a qué precio unitario mediano.
## 4. Cómo se evalúa
Si hay BASES: criterios y ponderación reales con su sección. Si no, lo que la ficha permite saber y qué revisar (y sugiere subir las bases con el botón "Subir bases (PDF)").
## 5. Riesgo de pago del organismo
Reclamos por pago no oportuno por cada 100 procesos, plazo declarado, conducta histórica.
## 6. Estrategia recomendada
Precio objetivo (rango con cifras, justificado con el historial), a quién hay que ganarle, dónde poner el esfuerzo técnico, garantías y plazos.
## 7. Plan de trabajo hasta el cierre
Hitos con fechas hacia atrás desde el cierre.
## Fuentes
Lista numerada de lo citado.

Reglas: cita [n] tras cada afirmación con fuente; "Datos Mercado Público vía FirmaVB (OCDS)" para historial y adjudicaciones; no inventes procesos, montos ni criterios; si el historial es corto, dilo (la base OCDS parte en julio de 2026 y crece a diario); montos con separador de miles; máximo 1.400 palabras.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const t0 = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const { role, sub } = rolYSub(req.headers.get("Authorization") ?? "");
    const userId = role === "authenticated" ? sub : role === "service_role" ? (body.user_id ?? null) : null;
    if (!userId) return json({ error: "login", mensaje: "Inicia sesión en FirmaVB para pedir un estudio profundo." }, 401);
    const codigo = String(body.codigo ?? "").trim().toUpperCase();
    if (!/^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2}$/.test(codigo)) return json({ error: "falta_codigo", mensaje: "Indica el ID de la licitación (ej. 2699-35-LE26)." }, 400);
    const contextoProv = String(body.pregunta ?? "").trim().slice(0, 500);
    const huella = String(body.huella ?? "").slice(0, 80);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: uso } = await sb.rpc("experto_uso_mes", { p_user_id: userId, p_huella: huella || "anon" });
    const u = uso?.[0] ?? { consultas: 0, informes: 0, plan: "free" };
    if (!u.plan || u.plan === "free") return json({ error: "pro", mensaje: "El estudio profundo es del plan Pro: $50.000 por 30 días, con estudios y preguntas sin límite.", uso: u }, 402);

    const ficha = (await sb.rpc("experto_ficha_licitacion", { p_codigo: codigo })).data;
    if (!ficha) return json({ error: "sin_ficha", mensaje: `No encontré la licitación ${codigo} en la base.` }, 404);
    const rut: string | null = ficha.organismo?.rut ?? null;
    const nombre = String(ficha.nombre ?? "");
    const productos = (ficha.items ?? []).slice(0, 3).map((i: any) => String(i.producto ?? "")).join(" ").trim() || nombre;

    const t: Record<string, Promise<any>> = {
      hist: rut ? sb.rpc("experto_estudio_organismo", { p_rut: rut, p_texto: nombre, p_meses: 36, p_cantidad: 40 }).then((r) => r.data ?? []) : Promise.resolve([]),
      topadj: rut ? sb.rpc("experto_top_adjudicatarios", { p_rut: rut, meses: 24, cantidad: 8 }).then((r) => r.data ?? []) : Promise.resolve([]),
      adj: sb.rpc("experto_adjudicaciones", { texto: nombre.slice(0, 120), p_rut: null, meses: 24, cantidad: 10 }).then((r) => r.data ?? []),
      comp: sb.rpc("experto_competencia", { texto: productos.slice(0, 80), meses: 12, cantidad: 8 }).then((r) => r.data ?? []),
      org: rut ? sb.rpc("experto_organismo", { nombre_o_rut: rut }).then((r) => r.data?.[0]) : Promise.resolve(null),
      bases: sb.rpc("experto_bases_texto", { p_codigo: codigo }).then((r) => r.data ?? []),
      n1: sb.rpc("experto_buscar_texto", { consulta: "criterios evaluacion puntaje precio experiencia", cantidad: 3 }).then((r) => r.data ?? []),
      n2: sb.rpc("experto_buscar_texto", { consulta: "garantia seriedad oferta", cantidad: 2 }).then((r) => r.data ?? []),
    };
    const res: Record<string, any> = {};
    await Promise.all(Object.entries(t).map(async ([k, p]) => { try { res[k] = await p; } catch { res[k] = null; } }));

    // Fuentes normativas [1..n], luego bases
    const frag: any[] = [...(res.n1 ?? []), ...(res.n2 ?? [])];
    const bases: any[] = res.bases ?? [];
    const partes: string[] = [];
    if (frag.length) partes.push("FUENTES:\n" + frag.map((f, i) => `[${i + 1}] ${f.fuente}${f.seccion ? " — " + f.seccion : ""}\n${String(f.texto).slice(0, 1200)}`).join("\n\n"));
    const o = ficha.organismo ?? {};
    partes.push(`FICHA DE LA LICITACIÓN ${codigo} (Datos Mercado Público vía FirmaVB):\n${nombre}\nOrganismo: ${ficha.institucion} (RUT ${rut ?? "s/i"}) — ${ficha.comuna ?? ""}, ${ficha.region ?? ""}\nEstado: ${ficha.estado} | Tipo: ${ficha.tipo ?? "s/i"} | Presupuesto: ${fmt(ficha.presupuesto)} | Modalidad: ${ficha.modalidad ?? "s/i"} | Pago: ${ficha.tipo_pago ?? "s/i"} | Contrato: ${ficha.duracion_contrato ?? "s/i"}\nPublicada ${fecha(ficha.fecha_publicacion)} | Cierre ${fecha(ficha.fecha_cierre)} | Adjudicación estimada ${fecha(ficha.fecha_adjudicacion)}\nDescripción: ${String(ficha.descripcion ?? "").slice(0, 1200)}\nÍtems: ${(ficha.items ?? []).slice(0, 20).map((i: any) => `${i.producto}${i.cantidad ? ` (${i.cantidad} ${i.unidad ?? ""})` : ""}`).join("; ") || "s/i"}\nLink: ${ficha.url}`);
    const hist: any[] = res.hist ?? [];
    if (hist.length) {
      const conAdj = hist.filter((h) => h.monto_adjudicado && h.monto_estimado);
      const prom = conAdj.length ? Math.round(conAdj.reduce((a, h) => a + Number(h.monto_adjudicado) / Number(h.monto_estimado), 0) / conAdj.length * 100) : null;
      partes.push(`HISTORIAL DE PROCESOS PARECIDOS DEL MISMO ORGANISMO, 36 meses (Datos Mercado Público vía FirmaVB (OCDS); ${hist.length} procesos, promedio adjudicado/presupuesto ${prom != null ? prom + "%" : "s/i"}):\n` +
        hist.map((h) => `${h.codigo} | ${fecha(h.fecha)} | ${h.estado ?? "s/i"} | ${String(h.titulo ?? "").slice(0, 90)} | presupuesto ${fmt(h.monto_estimado)} | ganó ${h.adjudicatario ?? "s/i"} por ${fmt(h.monto_adjudicado)} (${pct(h.monto_adjudicado, h.monto_estimado)} del presupuesto) | ${h.num_oferentes ?? "s/i"} oferentes: ${h.oferentes ?? "s/i"}`).join("\n"));
    } else partes.push("HISTORIAL DEL ORGANISMO: sin procesos parecidos en la base OCDS todavía (cubre desde julio de 2026).");
    if (res.topadj?.length) partes.push("QUIÉN LE GANA A ESTE ORGANISMO (OCDS, 24 meses):\n" + res.topadj.map((x: any) => `${x.adjudicatario} (${x.rut ?? "s/i"}): ${x.licitaciones} ganadas por ${fmt(x.monto)}, participó en ${x.participaciones}`).join("\n"));
    if (res.adj?.length) partes.push("LICITACIONES PARECIDAS EN OTROS ORGANISMOS (OCDS, 24 meses):\n" + res.adj.map((a: any) => `${a.codigo} | ${a.comprador} | ${fecha(a.fecha_adjudicacion)} | ganó ${a.adjudicatario ?? "s/i"} por ${fmt(a.monto_adjudicado)} (${pct(a.monto_adjudicado, a.monto_estimado)} del presupuesto) | ${a.num_oferentes ?? "s/i"} oferentes`).join("\n"));
    if (res.comp?.length) partes.push(`QUIÉN VENDE ESTOS PRODUCTOS AL ESTADO (órdenes de compra, 12 meses):\n` + res.comp.map((c: any) => `${c.proveedor} (${c.rut ?? ""}): ${c.ordenes} OC, ${fmt(c.monto)}, precio unitario mediano ${fmt(c.precio_unit_mediano)}, ${c.compradores} compradores`).join("\n"));
    if (res.org) { const g = res.org; partes.push(`PAGO DEL ORGANISMO (Datos Mercado Público vía FirmaVB): reclamos por pago no oportuno 12 meses: ${g.reclamos_pago_12m ?? g.reclamos ?? "s/i"}; por irregularidad del proceso: ${g.reclamos_proceso_12m ?? "s/i"}; procesos 12 meses: ${g.procesos_12m ?? "s/i"} → ${g.reclamos_pago_por_100_procesos ?? "s/i"} reclamos de pago por cada 100 procesos; mayor reclamante: ${g.top_reclamante ?? "s/i"} (${g.top_reclamante_pct ?? "s/i"}%); plazo declarado: ${g.plazo_pago ?? "s/i"}; conducta histórica: ${g.conducta_pago ?? "s/i"} (${g.pago_promedio_dias ?? "s/i"} días)`); }
    else partes.push(`PAGO DEL ORGANISMO: conducta ${o.conducta_pago ?? "s/i"}, ${o.pago_promedio_dias ?? "s/i"} días promedio; reclamos por no pagar a tiempo: ${o.reclamos ?? "s/i"}`);
    bases.forEach((b, i) => {
      const secs = (Array.isArray(b.secciones) ? b.secciones : []).filter((s: any) => /evalua|criterio|puntaj|ponder|garant|multa|plazo|pago/i.test(String(s.texto))).slice(0, 8);
      partes.push(`[${frag.length + i + 1}] BASES DE LA LICITACIÓN ${codigo} — "${b.archivo}" (${b.paginas ?? "?"} páginas, PDF subido por un usuario)\nRESUMEN: ${JSON.stringify(b.resumen ?? {})}\n${secs.map((s: any) => `## ${s.titulo}\n${String(s.texto).slice(0, 2500)}`).join("\n\n")}`);
    });
    if (!bases.length) partes.push("NO HAY BASES CARGADAS para esta licitación.");
    const userMsg = `${partes.join("\n\n")}\n\nGenera el estudio profundo de la licitación ${codigo}.${contextoProv ? " Contexto del proveedor: " + contextoProv : ""}`;

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "sin_ia" }, 500);
    let upstream: Response | null = null; let modelo = "";
    for (const mdl of MODELOS) {
      const r = await fetch(GEMINI_URL, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: mdl, messages: [{ role: "system", content: SYS }, { role: "user", content: userMsg }], temperature: 0.3, max_tokens: 4000, stream: true, reasoning_effort: "low" }) });
      if (r.ok && r.body) { upstream = r; modelo = mdl; break; }
      console.error("gemini", mdl, r.status, (await r.text()).slice(0, 200));
    }
    if (!upstream) return json({ error: "ia_no_disponible" }, 502);

    const fuentesMeta = [
      ...frag.map((f, i) => ({ n: i + 1, fuente: f.fuente, seccion: f.seccion, url: f.url })),
      ...bases.map((b, i) => ({ n: frag.length + i + 1, fuente: `Bases de la licitación ${codigo}: ${b.archivo}`, seccion: `${b.paginas ?? "?"} páginas`, url: null })),
    ];
    const enc = new TextEncoder(); const dec = new TextDecoder(); let respuesta = "";
    const stream = new ReadableStream({
      async start(ctrl) {
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ meta: { modelo, fuentes: fuentesMeta, codigo, uso: u, historial: hist.length, pedir_bases: bases.length ? null : codigo } })}\n\n`));
        const reader = upstream!.body!.getReader(); let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read(); if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n"); buf = lines.pop() ?? "";
            for (const ln of lines) {
              const s = ln.trim(); if (!s.startsWith("data:")) continue;
              const d = s.slice(5).trim(); if (d === "[DONE]") continue;
              try { const j = JSON.parse(d); const delta = j.choices?.[0]?.delta?.content; if (delta) { respuesta += delta; ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ delta })}\n\n`)); } } catch { /* ignorar */ }
            }
          }
        } catch (e) { ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`)); }
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ done: true, ms: Date.now() - t0 })}\n\n`));
        ctrl.close();
        try { await sb.rpc("experto_registrar_uso", { p_user_id: userId, p_huella: huella || "anon", p_modo: "informe", p_pregunta: `estudio profundo ${codigo}`, p_respuesta: respuesta, p_fuentes: fuentesMeta, p_licitacion: codigo, p_ms: Date.now() - t0, p_ip: ipCliente(req) }); } catch { /* no bloquear */ }
      },
    });
    return new Response(stream, { headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) { return json({ error: String((e as Error)?.message ?? e) }, 500); }
});
