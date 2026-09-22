// Don Evaristo Abogado — el experto legal de Mercado Público / ChileCompra.
// Responde preguntas en chat (cercano) y redacta documentos formales — cartas de
// apelación, reclamos, oficios — (profesional), con las mismas fuentes reales
// (Ley 19.886, Reglamento, dictámenes de Contraloría, sentencias del TCP, el libro)
// y los mismos datos de organismos que ya usa Don Evaristo Experto.
import { createClient } from "jsr:@supabase/supabase-js@2";

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
  carta_cobranza: {
    titulo: "Carta de cobro de una factura impaga (a un organismo del Estado o a un cliente privado)",
    guia: `Es una carta formal de cobro dirigida al deudor por una factura vencida e impaga. Estructura: identifica la factura (número, fecha de emisión y de recepción, monto), el bien o servicio entregado y su recepción conforme; indica los días de atraso respecto del plazo legal o pactado; requiere el pago dentro de un plazo breve (por ejemplo 5 días hábiles) e indica los medios de pago; y advierte, de forma profesional y sin amenazar, las consecuencias del no pago.
FUNDAMENTO LEGAL que puedes invocar como marco (es correcto en Chile; cítalo por su nombre y número aunque no aparezca en las FUENTES): (a) Ley 21.131 sobre pago a treinta días: las facturas deben pagarse en un máximo de 30 días corridos desde su recepción, salvo acuerdo en contrario dentro de los márgenes legales, y su atraso hace correr intereses moratorios y una comisión fija por recuperación de costos de cobranza; (b) Ley 19.983: la copia cedible de la factura, recibida y no reclamada dentro de 8 días corridos, tiene mérito ejecutivo, esto es, permite iniciar un juicio ejecutivo de cobro; (c) si el deudor es un organismo del Estado, rige además el deber de pago oportuno de la Ley 19.886 y el proveedor puede reclamar el no pago ante la propia institución, ChileCompra (gestión de pago / ProntoPago) y la Contraloría General de la República.
Tono firme pero cordial: es el primer requerimiento formal y busca cobrar sin romper la relación comercial. No inventes montos de interés exactos: si no se entregan, refiérete a "los intereses y la comisión que la ley establece". Máximo 500 palabras.`
  },
  requerimiento_pago: {
    titulo: "Requerimiento pre-judicial de pago (última gestión formal antes de demandar)",
    guia: `Es el requerimiento FORMAL Y FINAL de pago antes de ejercer acciones judiciales de cobro. Estructura: identifica la factura y su recepción conforme; expone el atraso y el monto adeudado; requiere el pago íntegro (capital más intereses y comisión legal) dentro de un plazo perentorio (por ejemplo 5 días hábiles); y advierte expresamente que, de no pagarse, se ejercerán las acciones legales de cobro que la ley franquea.
FUNDAMENTO LEGAL (correcto en Chile; cítalo por nombre y número): (a) Ley 19.983: la copia cedible de la factura recibida y no reclamada dentro de 8 días corridos constituye título ejecutivo, habilitando la demanda ejecutiva de cobro; (b) Ley 21.131: pago a 30 días, con intereses moratorios y comisión por recuperación de costos de cobranza sobre el monto adeudado; (c) para deudores del Estado, el deber de pago oportuno de la Ley 19.886 y el reclamo ante ChileCompra y la Contraloría por el no pago.
Deja claro que este es el último requerimiento amistoso antes de demandar. Tono formal y enérgico, sin insultos ni amenazas ilegítimas. No inventes montos de interés exactos: si no se entregan, refiérete a "los intereses y la comisión que la ley establece". Máximo 550 palabras.`
  },
};

const SYS_CHAT = `Eres Don Evaristo Abogado, el asesor legal de FirmaVB, experto en Mercado Público / ChileCompra: Ley 19.886, Reglamento (Decreto 661/2024), dictámenes de Contraloría y jurisprudencia del Tribunal de Contratación Pública (TCP).
Hablas de tú, cercano, como un abogado amigo que te explica el enredo legal en cristiano antes de citar la norma — nada de "el suscrito", "por medio de la presente" ni lenguaje de tribunal en el chat (eso es para los documentos que generas, no para hablar). Frases cortas y directas. Si el caso tiene mérito, dilo con confianza y explica cómo ganarlo; si es débil, dilo sin rodeos y ofrece la mejor alternativa real. Cierra siempre con el paso concreto que darías hoy.
Reglas:
- Responde SOLO con lo que respaldan las FUENTES y DATOS entregados. Cita [n] tras cada afirmación que venga de una fuente. Con ley o reglamento nombra el artículo; con dictámenes de Contraloría número y año (si es anterior a dic-2024 puede citar el reglamento antiguo D.250/2004, reemplazado por el D.661/2024); con sentencias del TCP, rol y fecha; con el libro, dilo como criterio práctico del autor.
- Si hay FICHA ORGANISMO, úsala para evaluar el caso (reclamos previos contra ese organismo, conducta de pago).
- Si hay DOCUMENTOS DEL USUARIO (contratos, notificaciones, actas, reclamos previos que subió), son la base de los hechos: léelos y úsalos como evidencia concreta del caso.
- Si el usuario necesita presentar algo formal (recurso, reclamo, carta, apelación), NO redactes el documento completo en el chat: explícale qué documento le conviene y en qué plazo, y dile que lo genere con el botón "Generar documento" de este mismo módulo, donde queda con formato profesional listo para firmar y descargar en PDF.
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

    const res: Record<string, any> = {};
    await Promise.all(Object.entries(tareas).map(async ([k, p]) => { try { res[k] = await p; } catch { res[k] = null; } }));

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
    const contexto = partes.join("\n\n") || "(sin fuentes ni datos para esta consulta)";

    const userMsg = modo === "chat" ? `${contexto}\n\nPREGUNTA: ${pregunta}` : `${contexto}\n\nRedacta el documento completo con los datos y hechos de arriba.`;
    const messages = [
      { role: "system", content: modo === "chat" ? SYS_CHAT : sysDocumento(tipoDocumento) },
      ...(modo === "chat" ? historial.filter((h) => h && (h.role === "user" || h.role === "assistant") && h.content).map((h) => ({ role: h.role, content: String(h.content).slice(0, 2000) })) : []),
      { role: "user", content: userMsg },
    ];

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return new Response(JSON.stringify({ error: "sin_ia" }), { status: 500, headers: cors });

    let upstream: Response | null = null; let modelo = "";
    for (const mdl of (modo === "chat" ? MODELOS_CHAT : MODELOS_DOC)) {
      const r = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: mdl, messages, temperature: modo === "chat" ? 0.3 : 0.2, max_tokens: modo === "chat" ? 2000 : 3200, stream: true, reasoning_effort: "low" }),
      });
      if (r.ok && r.body) { upstream = r; modelo = mdl; break; }
      console.error("gemini", mdl, r.status, (await r.text()).slice(0, 200));
    }
    if (!upstream) return new Response(JSON.stringify({ error: "ia_no_disponible" }), { status: 502, headers: cors });

    const fuentesMeta = fragmentos.map((f, i) => ({ n: i + 1, fuente: f.fuente, seccion: f.seccion, url: f.url }));
    const enc = new TextEncoder(); const dec = new TextDecoder();
    let respuesta = "";
    const stream = new ReadableStream({
      async start(ctrl) {
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ meta: { modelo, fuentes: fuentesMeta, codigo, uso: u, tipo_documento: modo === "documento" ? tipoDocumento : undefined } })}\n\n`));
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
