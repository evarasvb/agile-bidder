// Don Evaristo Abogado — el experto legal de Mercado Público / ChileCompra.
// Responde preguntas en chat (cercano) y redacta documentos formales — cartas de
// apelación, reclamos, oficios — (profesional), con las mismas fuentes reales
// (Ley 19.886, Reglamento, dictámenes de Contraloría, sentencias del TCP, el libro)
// y los mismos datos de organismos que ya usa Don Evaristo Experto.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { fetchClaudeComoOpenAI } from "../_shared/claudeFallback.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
// Comparte el mismo cupo mensual que el Experto (chat/informe): "documento" gasta
// cupo de informe (es un trabajo elaborado), "chat" gasta cupo de chat.
const LIMITES_FREE = { chat: 3, informe: 1 };
const MODELOS_CHAT = [Deno.env.get("GEMINI_MODEL_CHAT"), "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.6-flash"].filter(Boolean) as string[];
const MODELOS_DOC = [Deno.env.get("GEMINI_MODEL_INFORME"), "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"].filter(Boolean) as string[];
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
// Respaldo si Gemini falla en TODOS sus modelos (ej. cuota de la cuenta agotada): Claude.
const CLAUDE_MODELO_CHAT = "claude-haiku-4-5-20251001";
const CLAUDE_MODELO_DOC = "claude-sonnet-5";

const STOP = new Set("de la el los las un una unos unas y o u que en para por con sin sobre al del se su sus es son fue ser hay como cuando donde qué que cual cuál cuáles quien quién cómo cuánto cuánta cuántos cuántas mi mis me tu tus le les lo nos si no más muy este esta estos estas ese esa eso aquel puedo puede pueden podemos debo debe deben hacer tiene tienen tengo".split(" "));
function palabrasClave(t: string): string[] {
  return [...new Set(t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ\- ]/g, " ").split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w)))].slice(0, 10);
}
function rolYSub(auth: string): { role: string; sub: string | null } {
  try {
    const p = JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { role: p.role ?? "", sub: p.sub ?? null };
  } catch { return { role: "", sub: null }; }
}
function ipCliente(req: Request): string | null {
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = xff.length ? xff[xff.length - 1] : (req.headers.get("x-real-ip") ?? req.headers.get("cf-connecting-ip") ?? "").trim();
  return ip ? ip.slice(0, 64) : null;
}
function textoFragmentos(frs: any[]) {
  return frs.map((f, i) => `[${i + 1}] ${f.fuente}${f.seccion ? " — " + f.seccion : ""}\n${String(f.texto).slice(0, 1800)}`).join("\n\n");
}
function textoOrganismo(o: any) {
  const recl = o.reclamos == null ? "sin dato" : `${o.reclamos} reclamos por incumplir plazo de pago en 12 meses`;
  return `${o.institucion} (RUT ${o.rut ?? "s/i"}, ${o.region ?? "s/i"})
Reclamos por no pago: ${recl} | Conducta de pago: ${o.conducta_pago ?? "s/i"} (${o.pago_promedio_dias ?? "s/i"} días promedio)
Reclamos desglosados 12 meses: ${o.reclamos_pago_12m ?? "s/i"} por pago no oportuno, ${o.reclamos_proceso_12m ?? "s/i"} por irregularidad en el proceso.`;
}

// Completa con la tasa que el propio cliente indica los meses sin certificado CMF cargado
// (calcular_interes_mora ya no inventa nada ahí: deja tasa_anual null). Cada tramo llenado
// así queda marcado "origen: usuario" para que el documento y la UI lo digan explícito.
function gapFillTasas(calculo: any, monto: number, tasasManual: Record<string, number>) {
  const detalle = (calculo?.detalle ?? []).map((t: any) => {
    if (t.tasa_anual != null) return { ...t, origen: "cmf" };
    const tasa = tasasManual[t.mes];
    if (tasa) {
      const interes = Math.round(monto * (tasa / 100) * t.dias / 360);
      return { ...t, tasa_anual: tasa, interes, mes_tasa: null, origen: "usuario" };
    }
    return { ...t, origen: "cmf" };
  });
  const completo = detalle.every((t: any) => t.tasa_anual != null);
  const interes = detalle.reduce((a: number, t: any) => a + (t.interes ?? 0), 0);
  return { dias_atraso: calculo?.dias_atraso ?? 0, interes, total: monto + interes, completo, detalle };
}

const TIPOS_DOC: Record<string, { titulo: string; guia: string }> = {
  apelacion: {
    titulo: "Recurso/reclamo formal por una licitación o compra ágil",
    guia: "Estructura: Antecedentes del proceso (código, organismo, acto que se impugna — rechazo, inadmisibilidad, adjudicación); Hechos en orden cronológico; Fundamentos de derecho citando la Ley 19.886, el Reglamento D.661/2024, dictámenes de Contraloría o sentencias del TCP que respalden el reclamo; Petitorio claro (qué se pide: reconsideración, dejar sin efecto el acto, admitir la oferta, etc.). Si corresponde, menciona el plazo legal para presentarlo y ante quién se presenta (la propia entidad, el Tribunal de Contratación Pública o Contraloría, según el caso)."
  },
  reclamo_contraloria: {
    titulo: "Reclamo o denuncia ante la Contraloría General de la República",
    guia: "Estructura: Identificación del organismo denunciado y del proceso; Hechos que constituyen la irregularidad; Normativa infringida (Ley 19.886, Reglamento, principios de la contratación pública); Petitorio (que se instruya un procedimiento, se emita dictamen, se corrija la irregularidad)."
  },
  carta: {
    titulo: "Carta formal (aclaración, objeción a bases, solicitud, respuesta a un organismo)",
    guia: "Carta profesional breve y directa: antecedentes del proceso, lo que se solicita o aclara, y el fundamento (legal o contractual) si corresponde. No es un recurso legal, es comunicación formal."
  },
  cobro_intereses_mora: {
    titulo: "Nota de débito / carta de cobro de intereses por mora en el pago",
    guia: "Estructura: identificación de la deuda (monto, fecha en que debía pagarse, fecha de pago o que sigue impaga); fundamento legal del derecho a cobrar interés corriente por el atraso (Ley 18.010 y, si aplica, Ley 21.131 de pago a 30 días o la cláusula de pago de la licitación/OC); el CÁLCULO DE INTERESES entregado en el contexto —cópialo tal cual, con los mismos números, nunca lo recalcules ni inventes una tasa distinta—; petitorio de pago del interés (y del capital si sigue impago)."
  },
};

const SYS_CHAT = `Eres Don Evaristo Abogado, el asesor legal de FirmaVB, experto en Mercado Público / ChileCompra: Ley 19.886, Reglamento (Decreto 661/2024), dictámenes de Contraloría y jurisprudencia del Tribunal de Contratación Pública (TCP).
Hablas de tú, cercano, como un abogado amigo que te explica el enredo legal en cristiano antes de citar la norma — nada de "el suscrito", "por medio de la presente" ni lenguaje de tribunal en el chat (eso es para los documentos que generas, no para hablar). Frases cortas y directas. Si el caso tiene mérito, dilo con confianza y explica cómo ganarlo; si es débil, dilo sin rodeos y ofrece la mejor alternativa real. Cierra siempre con el paso concreto que darías hoy.
Reglas:
- Responde SOLO con lo que respaldan las FUENTES y DATOS entregados. Cita [n] tras cada afirmación que venga de una fuente. Con ley o reglamento nombra el artículo; con dictámenes de Contraloría número y año (si es anterior a dic-2024 puede citar el reglamento antiguo D.250/2004, reemplazado por el D.661/2024); con sentencias del TCP, rol y fecha; con el libro, dilo como criterio práctico del autor.
- Si hay FICHA ORGANISMO, úsala para evaluar el caso (reclamos previos contra ese organismo, conducta de pago).
- Si hay DOCUMENTOS DEL USUARIO (contratos, notificaciones, actas, reclamos previos que subió), son la base de los hechos: léelos y úsalos como evidencia concreta del caso.
- Si el usuario necesita presentar algo formal (recurso, reclamo, carta, apelación), NO redactes el documento completo en el chat: explícale qué documento le conviene y en qué plazo, y dile que lo genere con el botón "Generar documento" de este mismo módulo, donde queda con formato profesional listo para firmar y descargar en PDF.
- Si te cuenta que le pagaron atrasado o le deben plata (mora), explícale en el chat que tiene derecho a cobrar interés corriente por el atraso [cítalo], sin calcular el monto tú mismo (no hagas la aritmética en el chat). Dile que en "Generar documento" con el tipo "Nota de débito / cobro de intereses por mora" le pides el monto adeudado, la fecha en que debía pagarse y si ya le pagaron o sigue impago, y ahí Don Evaristo Abogado hace el cálculo exacto y redacta la nota de débito lista para enviar.
- Si las fuentes no cubren la pregunta, dilo ("No tengo fuente en mi base para eso") y no inventes artículos, plazos ni jurisprudencia.
- Máximo 280 palabras salvo que pidan detalle. Párrafos cortos. Formato Markdown simple.`;

function sysDocumento(tipo: string): string {
  const t = TIPOS_DOC[tipo] ?? TIPOS_DOC.carta;
  return `Eres Don Evaristo Abogado, redactando un documento FORMAL Y PROFESIONAL para un proveedor del Estado chileno: ${t.titulo}.
Aquí NO hablas cercano: es un documento oficial en español formal chileno, con la estructura clásica de una carta/recurso ante un organismo público. Usa SOLO los hechos, datos y fuentes que se te entregan; no inventes fechas, montos, artículos ni jurisprudencia.
${t.guia}
Formato de salida (texto plano, sin encabezados Markdown "#", sin negritas decorativas — es una carta que se imprime tal cual):
[Ciudad], [fecha entregada]

Señor(a) [destinatario o cargo entregado]
[Institución entregada]
PRESENTE

REF.: [una línea con el asunto]

De mi consideración:

[Cuerpo: antecedentes del proceso; hechos en orden; fundamentos de derecho citando [n] tras cada afirmación legal; petitorio claro y concreto]

Sin otro particular, saluda atentamente a usted,


[Nombre de la empresa o representante entregado]
[RUT entregado, si se entregó]

Reglas: cita [n] tras cada afirmación de derecho, con el mismo criterio que en el chat (artículo, número de dictamen/año, rol y fecha del TCP). Si falta un dato (fecha, destinatario, RUT), dejarlo entre corchetes como "[completar: dato]" en vez de inventarlo. Máximo 900 palabras.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const t0 = Date.now();
  try {
    const body = await req.json();
    const modo: "chat" | "documento" = body.modo === "documento" ? "documento" : "chat";
    const pregunta: string = String(body.pregunta ?? "").trim();
    const huella: string = String(body.huella ?? "").slice(0, 80);
    const historial: { role: string; content: string }[] = Array.isArray(body.historial) ? body.historial.slice(-6) : [];
    const codigo: string | null = body.codigo ? String(body.codigo).trim().toUpperCase() : null;
    // Solo modo documento: tipo de documento, destinatario y hechos que arma el usuario en el formulario.
    const tipoDocumento: string = TIPOS_DOC[body.tipo_documento] ? body.tipo_documento : "carta";
    const destinatario: string = String(body.destinatario ?? "").trim().slice(0, 200);
    const hechos: string = String(body.hechos ?? "").trim().slice(0, 4000);
    const peticion: string = String(body.peticion ?? "").trim().slice(0, 1000);
    const ciudadFecha: string = String(body.ciudad_fecha ?? "").trim().slice(0, 100);
    // Solo tipo_documento = cobro_intereses_mora: datos exactos para el cálculo determinístico.
    const montoAdeudado: number | null = Number.isFinite(Number(body.monto_adeudado)) && Number(body.monto_adeudado) > 0 ? Number(body.monto_adeudado) : null;
    const fechaVencimiento: string | null = /^\d{4}-\d{2}-\d{2}$/.test(String(body.fecha_vencimiento ?? "")) ? String(body.fecha_vencimiento) : null;
    const fechaPago: string | null = /^\d{4}-\d{2}-\d{2}$/.test(String(body.fecha_pago ?? "")) ? String(body.fecha_pago) : null;
    // Tasas que el propio cliente indica para meses sin certificado CMF cargado (ver gapFillTasas).
    const tasasManual: Record<string, number> = {};
    if (Array.isArray(body.tasas_manual)) {
      for (const t of body.tasas_manual) {
        const mes = /^\d{4}-\d{2}-\d{2}$/.test(String(t?.mes ?? "")) ? String(t.mes) : null;
        const tasa = Number(t?.tasa_anual);
        if (mes && Number.isFinite(tasa) && tasa > 0 && tasa < 200) tasasManual[mes] = tasa;
      }
    }

    const { role, sub } = rolYSub(req.headers.get("Authorization") ?? "");
    const userId = role === "authenticated" ? sub : (role === "service_role" && body.user_id ? String(body.user_id) : null);
    if (!userId) return new Response(JSON.stringify({ error: "login", mensaje: "Inicia sesión en FirmaVB para usar a Don Evaristo Abogado." }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    const ip = ipCliente(req);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (modo === "documento" && !hechos) {
      return new Response(JSON.stringify({ error: "faltan_hechos", mensaje: "Cuéntame qué pasó (los hechos) para redactar el documento." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Límites: comparte el cupo mensual con Don Evaristo Experto (chat/informe).
    const { data: uso } = await sb.rpc("experto_uso_mes", { p_user_id: userId, p_huella: huella || "anon" });
    const u = uso?.[0] ?? { consultas: 0, informes: 0, plan: "free" };
    const esPro = u.plan && u.plan !== "free";
    const cuotaModo: "chat" | "informe" = modo === "documento" ? "informe" : "chat";
    if (!esPro) {
      const usado = cuotaModo === "chat" ? u.consultas : u.informes;
      const lim = LIMITES_FREE[cuotaModo];
      if (usado >= lim) {
        return new Response(JSON.stringify({ error: "limite", mensaje: `Llegaste al límite gratuito de ${lim} ${cuotaModo === "chat" ? "preguntas" : "documento"} al mes (se comparte con Don Evaristo Experto). Con el plan Pro de FirmaVB es ilimitado.`, plan: u.plan, uso: u }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    // Recolección en paralelo
    const consultaBase = modo === "chat" ? pregunta : `${hechos} ${peticion}`;
    const kws = palabrasClave(consultaBase);
    const qOr = kws.slice(0, 4).join(" or ");
    const tareas: Record<string, Promise<any>> = {};
    if (kws.length) {
      tareas.normOr = sb.rpc("experto_buscar_or", { consulta: qOr, cantidad: 8 }).then((r) => r.data ?? []);
      tareas.normAnd = sb.rpc("experto_buscar_texto", { consulta: kws.slice(0, 3).join(" "), cantidad: 4 }).then((r) => r.data ?? []);
    }
    if (codigo) tareas.ficha = sb.rpc("experto_ficha_licitacion", { p_codigo: codigo }).then((r) => r.data);
    // Documentos que el usuario subió (contratos, notificaciones, reclamos previos): sin código = carpeta general.
    tareas.docs = sb.rpc("experto_documentos_texto", { p_user_id: userId, p_codigo: codigo, p_max: 10000 }).then((r) => r.data ?? []);
    // Organismo: por destinatario/institución escrita o detectado en el texto de la pregunta/hechos.
    const org = (pregunta + " " + hechos).match(/((?:i\.?\s*)?municipalidad|hospital|ministerio|servicio de salud|servicio local|universidad|gobierno regional|subsecretar[ií]a|direcci[oó]n|instituto|carabineros|ej[eé]rcito|armada|junaeb|junji|sename|cenabast|serviu|corfo|sence|fonasa)\s+(?:de\s+)?([a-záéíóúñ\s]{3,40})/i);
    const busquedaOrg = destinatario || org?.[0];
    if (busquedaOrg) tareas.org = sb.rpc("experto_buscar_organismo", { p_texto: busquedaOrg.replace(/[?¿.,]/g, "").trim().slice(0, 60) }).then(async (r) => r.data ? (await sb.rpc("experto_organismo", { nombre_o_rut: r.data })).data?.[0] : null);
    if (userId) tareas.perfil = sb.from("clientes").select("empresa_nombre, rut, region").eq("user_id", userId).maybeSingle().then((r) => r.data);
    // Cálculo determinístico de intereses por mora (nunca lo hace la IA): se pasa el resultado ya calculado.
    if (tipoDocumento === "cobro_intereses_mora" && montoAdeudado && fechaVencimiento) {
      tareas.calculo = sb.rpc("calcular_interes_mora", { p_monto: montoAdeudado, p_fecha_vencimiento: fechaVencimiento, p_fecha_pago: fechaPago }).then((r) => r.data?.[0] ?? null);
    }

    const res: Record<string, any> = {};
    await Promise.all(Object.entries(tareas).map(async ([k, p]) => { try { res[k] = await p; } catch { res[k] = null; } }));
    if (res.calculo && montoAdeudado) res.calculo = gapFillTasas(res.calculo, montoAdeudado, tasasManual);

    let fragmentos: any[] = [];
    const vistos = new Set<number>();
    for (const f of [...(res.normAnd ?? []), ...(res.normOr ?? [])]) if (!vistos.has(f.id)) { vistos.add(f.id); fragmentos.push(f); }
    fragmentos = fragmentos.slice(0, 10);

    const partes: string[] = [];
    if (fragmentos.length) partes.push("FUENTES:\n" + textoFragmentos(fragmentos));
    if (res.ficha) partes.push(`LICITACIÓN ${res.ficha.codigo}: ${res.ficha.nombre}\nOrganismo: ${res.ficha.institucion} | Estado: ${res.ficha.estado} | Cierre: ${res.ficha.fecha_cierre ?? "s/i"}`);
    if (res.org) partes.push("FICHA ORGANISMO (Datos Mercado Público vía FirmaVB):\n" + textoOrganismo(res.org));
    if (res.docs?.length) partes.push("DOCUMENTOS DEL USUARIO (contratos, notificaciones, reclamos previos que subió; son evidencia de los hechos):\n" + res.docs.map((d: any) => `### ${d.nombre} (${d.tipo})\n${d.texto}`).join("\n\n"));
    if (res.perfil) partes.push(`DATOS DEL PROVEEDOR (para firmar el documento): empresa "${res.perfil.empresa_nombre ?? "s/i"}", RUT ${res.perfil.rut ?? "s/i"}, región ${res.perfil.region ?? "s/i"}.`);
    if (modo === "documento") {
      partes.push(`DATOS DEL DOCUMENTO A REDACTAR:\nDestinatario/institución: ${destinatario || "[completar: destinatario]"}\nCiudad y fecha: ${ciudadFecha || "[completar: fecha]"}\nHECHOS que cuenta el usuario:\n${hechos}\n${peticion ? "Lo que pide el usuario: " + peticion : ""}`);
    }
    if (tipoDocumento === "cobro_intereses_mora") {
      if (montoAdeudado && fechaVencimiento && res.calculo?.completo) {
        const c = res.calculo;
        const tramos: any[] = c.detalle ?? [];
        const desgloseTramos = tramos.map((t) => `- ${t.mes} (${t.dias} días a ${t.tasa_anual}% anual, ${t.origen === "usuario" ? "tasa indicada por el cliente, NO verificada contra la CMF" : `CMF vigente desde ${t.mes_tasa}`}): $${Number(t.interes).toLocaleString("es-CL")}`).join("\n");
        const hayManual = tramos.some((t) => t.origen === "usuario");
        partes.push(`CÁLCULO DE INTERESES POR MORA (determinístico — cita estos números EXACTOS, no los recalcules ni los redondees distinto). La tasa de interés corriente la publica la CMF cada mes y puede cambiar de un mes a otro, así que el período se partió por mes calendario, cada tramo con la tasa vigente ese mes:
Capital adeudado: $${Math.round(montoAdeudado).toLocaleString("es-CL")}
Días de atraso totales: ${c.dias_atraso}
Tramos por mes:
${desgloseTramos}
Interés total (suma de los tramos): $${Number(c.interes).toLocaleString("es-CL")}
Total a cobrar (capital + interés): $${Number(c.total).toLocaleString("es-CL")}
Si hay más de un tramo, menciona en el documento que el interés se calculó por tramos mensuales según la tasa vigente en cada uno (no apliques una sola tasa a todo el período).${hayManual ? " Al menos un tramo usa una tasa que indicó el cliente (no viene del certificado de la CMF): dilo explícitamente en el documento para ese tramo y pide verificarla antes de presentar el cobro." : ""} Advertencia obligatoria a incluir en el documento: verificar que las tasas sigan vigentes antes de presentar el cobro.`);
      } else if (montoAdeudado && fechaVencimiento) {
        partes.push("CÁLCULO DE INTERESES POR MORA: no tengo cargada la tasa de interés corriente de la CMF para todos los meses que cubre este atraso (puede ser que aún no cargue meses anteriores). No inventes una tasa ni un monto de interés: redacta el documento pidiendo el pago del capital adeudado y deja el cálculo del interés pendiente de completar, indicando que se agregará con la tasa vigente de cada mes.");
      } else {
        partes.push("CÁLCULO DE INTERESES POR MORA: faltan el monto adeudado o la fecha en que debía pagarse. No calcules nada: pide esos datos en el documento.");
      }
    }
    const contexto = partes.join("\n\n") || "(sin fuentes ni datos para esta consulta)";

    const userMsg = modo === "chat" ? `${contexto}\n\nPREGUNTA: ${pregunta}` : `${contexto}\n\nRedacta el documento completo con los datos y hechos de arriba.`;
    const messages = [
      { role: "system", content: modo === "chat" ? SYS_CHAT : sysDocumento(tipoDocumento) },
      ...(modo === "chat" ? historial.filter((h) => h && (h.role === "user" || h.role === "assistant") && h.content).map((h) => ({ role: h.role, content: String(h.content).slice(0, 2000) })) : []),
      { role: "user", content: userMsg },
    ];

    const key = Deno.env.get("GEMINI_API_KEY");
    let upstream: Response | null = null; let modelo = "";
    if (key) {
      for (const mdl of (modo === "chat" ? MODELOS_CHAT : MODELOS_DOC)) {
        const r = await fetch(GEMINI_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: mdl, messages, temperature: modo === "chat" ? 0.3 : 0.2, max_tokens: modo === "chat" ? 2000 : 3200, stream: true, reasoning_effort: "low" }),
        });
        if (r.ok && r.body) { upstream = r; modelo = mdl; break; }
        console.error("gemini", mdl, r.status, (await r.text()).slice(0, 200));
      }
    }
    if (!upstream) {
      const claude = await fetchClaudeComoOpenAI(messages, { modelo: modo === "chat" ? CLAUDE_MODELO_CHAT : CLAUDE_MODELO_DOC, maxTokens: modo === "chat" ? 2000 : 3200, temperature: modo === "chat" ? 0.3 : 0.2 });
      if (claude) { upstream = claude.resp; modelo = claude.modelo; }
    }
    if (!upstream) return new Response(JSON.stringify({ error: "ia_no_disponible" }), { status: 502, headers: cors });

    const fuentesMeta = fragmentos.map((f, i) => ({ n: i + 1, fuente: f.fuente, seccion: f.seccion, url: f.url }));
    const enc = new TextEncoder(); const dec = new TextDecoder();
    let respuesta = "";
    const stream = new ReadableStream({
      async start(ctrl) {
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ meta: { modelo, fuentes: fuentesMeta, codigo, uso: u, tipo_documento: modo === "documento" ? tipoDocumento : undefined, calculo_mora: tipoDocumento === "cobro_intereses_mora" && res.calculo ? { ...res.calculo, monto_adeudado: montoAdeudado } : undefined } })}\n\n`));
        const reader = upstream!.body!.getReader(); let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n"); buf = lines.pop() ?? "";
            for (const ln of lines) {
              const s = ln.trim(); if (!s.startsWith("data:")) continue;
              const d = s.slice(5).trim(); if (d === "[DONE]") continue;
              try {
                const j = JSON.parse(d); const delta = j.choices?.[0]?.delta?.content;
                if (delta) { respuesta += delta; ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ delta })}\n\n`)); }
              } catch { /* ignorar */ }
            }
          }
        } catch (e) { ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`)); }
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ done: true, ms: Date.now() - t0 })}\n\n`));
        ctrl.close();
        try { await sb.rpc("experto_registrar_uso", { p_user_id: userId, p_huella: huella || "anon", p_modo: cuotaModo, p_pregunta: `[Abogado${modo === "documento" ? ":" + tipoDocumento : ""}] ${modo === "chat" ? pregunta : hechos.slice(0, 200)}`, p_respuesta: respuesta, p_fuentes: fuentesMeta, p_licitacion: codigo, p_ms: Date.now() - t0, p_ip: ip }); } catch { /* no bloquear */ }
      },
    });
    return new Response(stream, { headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
