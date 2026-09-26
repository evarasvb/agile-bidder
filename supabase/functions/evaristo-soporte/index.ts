// Don Evaristo — el experto de FirmaVB en Mercado Público (chat con IA).
// Etapa 1 (memoria + contexto): sabe quién es el cliente y qué está haciendo
// (pantalla, licitación en pantalla, inventario, extensión, matches, ofertas,
// señales, libros del Experto, tickets) vía la RPC evaristo_contexto, guarda
// la conversación en evaristo_conversaciones/evaristo_mensajes (sobrevive al
// cambio de pantalla y de dispositivo) y puede leer una captura del usuario.
//   POST { modo:"contexto", contexto:{codigo?} }        -> { contexto, saludo }  (sin IA, barato)
//   POST { messages, contexto, imagen?, conversacion_id? } -> { reply, conversacion_id }
// Usa Gemini vía su endpoint compatible con OpenAI (mismo patrón que el resto).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Tope diario por usuario (mensajes propios): evita abuso sin estorbar a nadie real.
const MAX_MENSAJES_DIA = 150;

const SYSTEM_PROMPT = `Eres **Don Evaristo**, el experto de FirmaVB: 17 años vendiéndole al Estado de Chile por Mercado Público y, además, quien conoce la plataforma FirmaVB por dentro. Hablas español de Chile, cálido, cercano y humano. Tuteas. Eres breve y práctico: vas al grano, con pasos numerados cuando ayuda. Eres empático ("descuida, te ayudo al tiro"). Nunca inventas: si no sabes algo, lo dices, pides un print ("¿me mandas un print de lo que ves?") o derivas al equipo.

TU ROL: no eres un bot de preguntas frecuentes, eres un asesor. Guías, aconsejas, anticipas y resuelves. Usas el CONTEXTO EN VIVO (abajo) para hablar de lo que el cliente tiene en pantalla y de su situación real (su inventario, sus matches, sus ofertas, lo que cierra pronto). Si ves una oportunidad o un riesgo, lo dices sin que te lo pregunten.

EXPERTO EN MERCADO PÚBLICO (Ley 19.886 y su reglamento, ChileCompra):
- Tipos de proceso: L1 (≤100 UTM), LE (100–1.000 UTM), LP (>1.000 UTM), LQ/LR (grandes), Compra Ágil (COT, ≤30 UTM: solo cotizar, sin bases pesadas), Convenio Marco, Trato Directo.
- Lo que decide una postulación: cumplir la admisibilidad (anexos firmados, garantía de seriedad si la piden, documentos al día), los criterios de evaluación con su ponderación (precio, plazo, experiencia, servicios adicionales), y no pasarse de la fecha/hora de cierre.
- Consejos prácticos: leer primero las bases y sus anexos; revisar en la ficha el historial del organismo (a quién le compra, a qué precio, cómo paga); en compra ágil manda el precio y el plazo, responder rápido; en licitación conviene preguntar en el foro si hay dudas; declarar inhabilidades correctamente; adjuntar la garantía cuando corresponde; mantener actualizado el registro de proveedores.
- Cuando la consulta requiere leer las bases completas o hacer un análisis a fondo (matriz de postulación, estudio del organismo, competencia, "bajo el agua"), llévalo al Libro del Experto de esa licitación: [Abrir el Libro del Experto](/experto/libro/CODIGO) (reemplaza CODIGO por el código real). Ahí lees las bases y armas los entregables.

QUÉ ES FirmaVB: plataforma para venderle al Estado de Chile por Mercado Público. Encuentra licitaciones, compras ágiles y convenio marco que hacen match con el inventario del cliente, y ayuda a postular más rápido (ofertas, fichas técnicas, cotizaciones en PDF, extensión de Chrome).

PRIMEROS PASOS (rutina básica; guíalos en este orden):
1. Cargar el inventario (Menú → Inventario). Es lo que alimenta el match; sin inventario no aparecen oportunidades.
2. Revisar oportunidades (Menú → Mis Oportunidades): las licitaciones y compras ágiles con su % de match.
3. Generar la primera oferta (desde Compras Ágiles o el detalle de una licitación).
4. (Opcional) Conectar la extensión de Chrome para postular más rápido y subir las bases con captcha.

EXTENSIÓN DE CHROME (se instala manualmente, NO está en la Chrome Web Store):
1. Configuración → Extensión. 2. "Descargar Extensión (.zip)". 3. Descomprimir. 4. chrome://extensions. 5. Activar "Modo de desarrollador". 6. "Cargar descomprimida" y elegir la carpeta. 7. En FirmaVB crear una "API Key", copiarla y pegarla en la extensión. 8. Iniciar sesión en Mercado Público en el mismo navegador. El estado pasa a "Conectada".

API KEY: Configuración → Extensión → "Nueva API Key". Se muestra UNA sola vez. Si dio error, recargar e intentar de nuevo.

MATCH: el % indica qué tan bien calza una oportunidad con su inventario. Se corrige por ítem (confirmar, cambiar producto, descartar). Bajo 60 % se marca "dudoso" y no se suma hasta confirmarlo.

BASES: el robot baja las bases que Mercado Público entrega sin captcha; las de la sección con captcha se suben solas si tiene la extensión, o a mano con "Subir bases (PDF)". Una vez leídas, el Libro del Experto las usa.

PLANES: gratis (oportunidades con límites, 3 preguntas al Experto al mes) y Pro (todo ilimitado). Para pagos o planes, deriva al WhatsApp humano https://wa.me/56994259157.

CANALIZAR AL EQUIPO: cuando no puedas resolver algo, o el usuario quiera dejar un caso, invítalo a tocar el botón "¿Prefieres que te contacte el equipo?" que está ABAJO en este chat: registra el caso con número de ticket y el equipo responde a su correo. NO digas que ya lo enviaste tú. Urgencias o hablar con una persona: WhatsApp https://wa.me/56994259157 (+56 9 9425 9157); correo contacto@firmavb.cl.
EXCEPCIÓN — REPORTE DE ERROR TÉCNICO (algo no funciona, no carga, no redirige, se cae, manda un print de un error): si el usuario tiene sesión, el sistema deja el caso registrado automáticamente al tiro (sin que toque ningún botón) y eso se te avisa aparte en la propia respuesta. En ese caso NO le pidas que toque el botón: solo reconoce el problema, dale tu mejor hipótesis o paso para probar, y sigue con tu día. No prometas tú mismo un número de ticket ni digas "ya quedó registrado": eso lo agrega el sistema si corresponde.

ACCIONES QUE PUEDES EJECUTAR (no solo aconsejas: también haces). Tienes herramientas para dejar acciones en cola; la extensión de Chrome del cliente las ejecuta en SU navegador, con SU sesión de Mercado Público, en el próximo minuto. Solo funcionan si la extensión está conectada (lo dice el contexto: "Extensión lista para ejecutar acciones"). Si no está conectada, no llames la herramienta: guíalo a instalarla y conectarla.
- sincronizar_licitacion (código de licitación 1234-56-LE26): trae la ficha, los ítems y las bases/anexos con captcha a FirmaVB. Úsala cuando el Experto no tiene las bases, cuando el cliente pide "tráeme/sincroniza/baja las bases", o cuando detectes que faltan.
- sincronizar_ca (código de compra ágil 1234-56-COT26): trae los documentos (términos de referencia, fotos) de la compra ágil.
- preparar_oferta (código): abre la ficha en Mercado Público con la oferta de FirmaVB ya cargada en el formulario para que el cliente la revise y la envíe él. Requiere que exista una oferta generada en FirmaVB; si no existe, mándalo a generarla primero. Tú NUNCA envías la oferta: la envía el cliente.
- publicar_cm (Convenio Marco): recorre "Mis productos" del cliente en conveniomarco.mercadopublico.cl y publica precio (referencial menos $1) y regiones en cada producto. Publica precios reales, por eso queda en estado "confirmar": el cliente debe apretar Confirmar en la tarjeta del chat. Opcional: regiones y marcas a considerar.
Reglas: (1) antes de programar, di en una frase qué vas a hacer; (2) después de programar, cuenta que quedó en cola y que en un minuto la extensión la ejecuta (o que espera su Confirmar), sin inventar que ya terminó; (3) el estado real lo ves con estado_acciones: "hecha" es terminada, "fallida" trae el motivo, "en_curso" sigue corriendo; (4) no programes dos veces lo mismo; (5) si el cliente pide algo que ninguna herramienta cubre (por ejemplo enviar la oferta, firmar, pagar garantía), explica que eso lo hace él y dile cómo.

LINKS DE ACCIÓN (úsalos siempre que guíes a una pantalla), formato markdown exacto [Texto](/ruta):
- Inicio: /dashboard · Inventario: /inventario · Mis Oportunidades: /mis-oportunidades · Compras Ágiles: /compras-agiles · Licitaciones: /licitaciones · Reportes: /reportes · Extensión: /configuracion/extension · Planes: /planes · Mi cuenta: /cuenta · Mi empresa: /mi-empresa
- Detalle de una compra ágil: /compras-agiles/CODIGO · Detalle de una licitación: /licitaciones/CODIGO · Libro del Experto: /experto/libro/CODIGO

CÓMO ATIENDES:
- Parte por lo que el contexto dice (ej: "veo que la compra ágil 1234-56-COT26 cierra hoy a las 11:00 y tienes 1 ítem con match al 67 %…").
- Da el SIGUIENTE paso concreto y termina con una acción clara (link de acción o pregunta corta).
- Anticípate a la causa raíz (sin inventario → sin match; inventario sin descripción/foto → match débil y ficha pobre; extensión sin actividad → no sube bases).
- Un tema a la vez. 2–6 líneas o una lista corta. Cercano y experto, nunca robótico.`;

type Ctx = Record<string, any>;

function rol(auth: string): string {
  try { return JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? ""; } catch { return ""; }
}

const fmtCLP = (n: unknown) => (typeof n === "number" && n > 0 ? `$${Math.round(n).toLocaleString("es-CL")}` : null);
function enCuanto(iso: unknown, ahora: Date): string | null {
  if (!iso) return null;
  const d = new Date(String(iso)); if (isNaN(d.getTime())) return null;
  const h = (d.getTime() - ahora.getTime()) / 36e5;
  if (h < 0) return "ya cerró";
  if (h < 1) return `en ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 36) return `en ${Math.round(h)} h`;
  return `en ${Math.round(h / 24)} días`;
}

// Resume el JSON de evaristo_contexto en pocas líneas para el prompt.
function resumirContexto(c: Ctx, extra: Ctx): string {
  const ahora = new Date(c.ahora ?? Date.now());
  const L: string[] = [];
  if (extra.canal) L.push(`Canal: ${extra.canal}`);
  if (extra.page) L.push(`Pantalla actual: ${extra.page}${extra.ruta ? ` (${extra.ruta})` : ""}`);
  const cl = c.cliente;
  if (cl) L.push(`Cliente: ${cl.empresa ?? "sin nombre"} · plan ${cl.plan} · ${cl.dias_en_firmavb ?? "?"} días en FirmaVB${cl.region ? ` · ${cl.region}` : ""}${cl.categoria ? ` · rubro ${cl.categoria}` : ""}${cl.nombre_responsable ? ` · responsable ${cl.nombre_responsable}` : ""}`);
  const inv = c.inventario;
  if (inv) L.push(`Inventario: ${inv.total} productos (${inv.incompletos} sin descripción o foto, ${inv.sin_precio} sin precio)${inv.total === 0 ? " → SIN INVENTARIO: no puede haber match" : ""}`);
  const ex = c.extension;
  if (ex) L.push(`Extensión Chrome: ${ex.claves_activas > 0 ? (ex.ultima_actividad ? `instalada, última actividad ${enCuanto(ex.ultima_actividad, ahora)?.replace("en ", "hace ") ?? ex.ultima_actividad}` : "clave creada pero sin actividad aún") : "no instalada"}`);
  const p = c.en_pantalla;
  if (p) {
    L.push(`EN PANTALLA: ${p.tipo === "compra_agil" ? "compra ágil" : "licitación"} ${p.codigo} "${p.nombre}" de ${p.organismo}; cierra ${enCuanto(p.fecha_cierre, ahora) ?? "?"}${fmtCLP(p.monto) ? ` · monto ${fmtCLP(p.monto)}` : ""}; ${p.items_con_match} ítems con match${p.bases_leidas != null ? `; bases leídas: ${p.bases_leidas}${p.adjuntos_solo_captcha ? " (las bases están en la sección con captcha)" : ""}` : ""}${p.oferta ? `; oferta ${p.oferta.estado}${fmtCLP(p.oferta.valor_total) ? ` por ${fmtCLP(p.oferta.valor_total)}` : ""}` : "; sin oferta aún"}${p.libro_experto ? "; ya tiene Libro del Experto" : ""}${p.buen_pagador === false ? "; OJO: organismo con mala conducta de pago" : ""}${p.pago_promedio_dias ? `; paga en ~${p.pago_promedio_dias} días` : ""}`);
    const mi = Array.isArray(p.match_items) ? p.match_items.slice(0, 4) : [];
    if (mi.length) L.push(`  Matches: ${mi.map((m: Ctx) => `"${m.pedido}" ↔ "${m.tu_producto}" (${m.score}%${fmtCLP(m.precio) ? `, ${fmtCLP(m.precio)}` : ""})`).join(" · ")}`);
  }
  const ca = Array.isArray(c.compras_agiles_con_match) ? c.compras_agiles_con_match : [];
  if (ca.length) L.push(`Compras ágiles abiertas con match (más urgentes): ${ca.slice(0, 3).map((x: Ctx) => `${x.codigo} "${String(x.nombre).slice(0, 50)}" cierra ${enCuanto(x.fecha_cierre, ahora)} (${x.items_con_match} ítems, hasta ${Math.round(x.score_max)}%)`).join(" · ")}`);
  const li = Array.isArray(c.licitaciones_con_match) ? c.licitaciones_con_match : [];
  if (li.length) L.push(`Licitaciones abiertas con match: ${li.slice(0, 3).map((x: Ctx) => `${x.codigo} "${String(x.nombre).slice(0, 50)}" cierra ${enCuanto(x.fecha_cierre, ahora)} (${x.items_con_match} ítems)`).join(" · ")}`);
  if (c.ofertas?.total) L.push(`Ofertas: ${c.ofertas.total} (${Object.entries(c.ofertas.por_estado ?? {}).map(([k, v]) => `${v} ${k}`).join(", ")})`);
  const se = Array.isArray(c.senales_recientes) ? c.senales_recientes : [];
  if (se.length) L.push(`Últimas acciones del cliente: ${se.slice(0, 5).map((s: Ctx) => `${s.tipo} ${s.codigo}${s.titulo ? ` (${String(s.titulo).slice(0, 40)})` : ""}`).join(" · ")}`);
  const lb = Array.isArray(c.libros_experto) ? c.libros_experto : [];
  if (lb.length) L.push(`Libros del Experto abiertos: ${lb.slice(0, 4).map((l: Ctx) => l.codigo).join(", ")}`);
  const tk = Array.isArray(c.tickets_abiertos) ? c.tickets_abiertos : [];
  if (tk.length) L.push(`Tickets abiertos con el equipo: ${tk.map((t: Ctx) => `#${t.numero} ${t.asunto} (${t.estado})`).join(" · ")}`);
  const fv = c.facturas_vencidas;
  if (fv?.total_vencidas > 0) L.push(`MODO COBRANZA — Facturas vencidas: ${fv.total_vencidas} por ${fmtCLP(fv.monto_total) ?? "un monto"} en total. Detalle: ${(fv.detalle ?? []).slice(0, 3).map((f: Ctx) => `${f.deudor} ${fmtCLP(f.monto) ?? "s/i"} (${f.dias_atraso} días de atraso)`).join(" · ")}. Si viene al caso, ofrécele redactar la carta de cobro con Don Evaristo Abogado (/experto/cobranza).`);
  // Memoria compartida: lo que este cliente conversó en Don Evaristo Abogado o Experto
  // (otros módulos), para no obligarlo a repetir contexto si sigue la conversación aquí.
  const conv = (Array.isArray(c.conversaciones_recientes) ? c.conversaciones_recientes : []).filter((m: Ctx) => m.canal !== "app");
  if (conv.length) L.push(`Conversó hace poco en otros módulos de Don Evaristo (últimas 48 h): ${conv.slice(0, 4).map((m: Ctx) => `[${m.canal}] ${m.rol === "user" ? "preguntó" : "respondió"}: "${String(m.texto).slice(0, 90)}"`).join(" · ")}`);
  if (typeof extra.tieneInventario === "boolean" && !inv) L.push(`Tiene inventario cargado: ${extra.tieneInventario ? "sí" : "no"}`);
  if (typeof extra.extensionConectada === "boolean" && !ex) L.push(`Extensión conectada: ${extra.extensionConectada ? "sí" : "no"}`);
  if (extra.whatsapp) L.push(`WhatsApp de contacto a usar: ${extra.whatsapp}`);
  if (extra.email) L.push(`Email de contacto a usar: ${extra.email}`);
  return L.length ? `\n\n[CONTEXTO EN VIVO — ${ahora.toLocaleString("es-CL", { timeZone: "America/Santiago" })} hora de Chile]\n${L.join("\n")}` : "";
}

// Saludo proactivo sin IA: lo más útil que Don Evaristo ve en este momento.
function saludoProactivo(c: Ctx): string {
  const ahora = new Date(c.ahora ?? Date.now());
  const nombre = c.cliente?.nombre_responsable ? `, ${String(c.cliente.nombre_responsable).split(" ")[0]}` : "";
  const p = c.en_pantalla;
  if (p) {
    const cierra = enCuanto(p.fecha_cierre, ahora);
    const tipo = p.tipo === "compra_agil" ? "esta compra ágil" : "esta licitación";
    const match = p.items_con_match > 0 ? `Tienes ${p.items_con_match} ítem${p.items_con_match === 1 ? "" : "s"} con match.` : "Todavía no hay match con tu inventario.";
    const bases = p.tipo === "licitacion" ? (p.bases_leidas > 0 ? " Ya leí las bases." : p.adjuntos_solo_captcha ? " Las bases están en la sección con captcha: con la extensión se suben solas." : "") : "";
    const accion = p.tipo === "compra_agil" ? "¿Armamos la cotización?" : `¿Revisamos las bases en el [Libro del Experto](/experto/libro/${p.codigo})?`;
    return `Hola${nombre} 👋 Veo que estás en ${tipo} de ${p.organismo}${cierra ? `, cierra **${cierra}**` : ""}. ${match}${bases} ${accion}`;
  }
  const fv = c.facturas_vencidas;
  if (fv?.total_vencidas > 0) {
    const u = (fv.detalle ?? [])[0];
    return `Hola${nombre} 👋 Ojo con la plata: tienes ${fv.total_vencidas} factura${fv.total_vencidas === 1 ? "" : "s"} vencida${fv.total_vencidas === 1 ? "" : "s"} por ${fmtCLP(fv.monto_total) ?? "cobrar"}${u ? ` (la más atrasada, de ${u.deudor}, lleva ${u.dias_atraso} días)` : ""}. ¿Te preparo la carta de cobro? 👉 [Ir a Cobranza](/experto/cobranza)`;
  }
  if ((c.inventario?.total ?? 0) === 0) return `Hola${nombre} 👋 Soy Don Evaristo. Veo que aún no cargas tu inventario: sin eso no puedo buscarte oportunidades. Partamos por ahí 👉 [Ir a Inventario](/inventario)`;
  const ca = Array.isArray(c.compras_agiles_con_match) ? c.compras_agiles_con_match : [];
  if (ca.length) {
    const u = ca[0];
    return `Hola${nombre} 👋 Tienes ${ca.length} compra${ca.length === 1 ? "" : "s"} ágil${ca.length === 1 ? "" : "es"} abierta${ca.length === 1 ? "" : "s"} con match. La más urgente, **${u.codigo}** de ${u.organismo}, cierra ${enCuanto(u.fecha_cierre, ahora)} 👉 [Verla](/compras-agiles/${u.codigo}). ¿Te ayudo con esa o con otra cosa?`;
  }
  const inc = c.inventario?.incompletos ?? 0;
  if (inc > 0 && inc / Math.max(1, c.inventario.total) > 0.5) return `Hola${nombre} 👋 Soy Don Evaristo. Un dato: ${inc} de tus ${c.inventario.total} productos no tienen descripción o foto, y eso baja el match y afea las fichas. Puedo enriquecerlos con IA desde [Inventario](/inventario). ¿En qué más te ayudo?`;
  return `Hola${nombre} 👋 Soy Don Evaristo, tu experto en Mercado Público. Cuéntame qué estás intentando hacer y te llevo de la mano: postular, cotizar, entender unas bases o afinar tu inventario.`;
}

async function contextoDe(sbUser: SupabaseClient | null, codigo?: string | null): Promise<Ctx | null> {
  if (!sbUser) return null;
  const { data, error } = await sbUser.rpc("evaristo_contexto", { p_codigo: codigo ?? null });
  if (error) { console.error("evaristo_contexto", error.message); return null; }
  return (data as Ctx) ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { messages = [], contexto = {}, imagen, conversacion_id, modo, identidad } = body ?? {};
    const auth = req.headers.get("Authorization") ?? "";
    const autenticado = rol(auth) === "authenticated";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    // Cliente con el JWT del usuario: la RPC y las tablas de memoria respetan su RLS.
    const sbUser = autenticado ? createClient(url, anon, { global: { headers: { Authorization: auth } } }) : null;
    const codigo = typeof contexto?.codigo === "string" ? contexto.codigo.trim().toUpperCase() : null;
    const ctx = await contextoDe(sbUser, codigo);

    if (modo === "contexto") {
      return json({ contexto: ctx, saludo: ctx && !ctx.anonimo ? saludoProactivo(ctx) : null });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return json({ reply: "Ahora mismo no puedo responder (falta configurar la IA). Escríbele a soporte a contacto@firmavb.cl y te ayudamos al tiro.", error: "GEMINI_API_KEY missing" });
    }

    // Usuario y tope diario.
    let userId: string | null = null;
    let userEmail: string | null = null;
    if (sbUser) {
      const { data } = await sbUser.auth.getUser();
      userId = data?.user?.id ?? null;
      userEmail = data?.user?.email ?? null;
      if (userId) {
        const desde = new Date(Date.now() - 864e5).toISOString();
        const { count } = await sbUser.from("evaristo_mensajes").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("rol", "user").gte("creado_en", desde);
        if ((count ?? 0) >= MAX_MENSAJES_DIA) {
          return json({ reply: "Hoy ya conversamos harto 😅. Mañana seguimos; si es urgente, escríbeme por WhatsApp https://wa.me/56994259157.", error: "tope_diario" });
        }
      }
    }

    const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const envModel = Deno.env.get("GEMINI_MODEL");
    // 2026-08-25: Google retiró gemini-2.0-* y gemini-2.5-flash; flash-latest/lite-latest de respaldo.
    const MODELOS = [...(envModel ? [envModel] : []), "gemini-3.6-flash", "gemini-flash-latest", "gemini-flash-lite-latest"].filter((m, i, a) => a.indexOf(m) === i);

    let contextoTxt = resumirContexto(ctx ?? {}, contexto ?? {});
    if (contexto?.canal === "landing") {
      contextoTxt += `\n\n[MODO LANDING PÚBLICO: el visitante todavía NO tiene cuenta ni sesión. NO uses links de acción a rutas internas porque no puede entrar. Explica con gancho comercial qué gana con FirmaVB (más adjudicaciones, flujo de caja, IA que encuentra licitaciones que calzan con lo que vende), responde su duda concreta con tu experiencia en Mercado Público, e invítalo a crear su cuenta o a tocar "Configurar mi empresa" / "Ver demostración". Si pide hablar con alguien o cotización, dale el WhatsApp y email del contexto. Sé breve, cercano y vendedor, nunca genérico.]`;
    }

    // ---- Acciones ejecutables (solo con sesión): estado de la extensión y cola reciente ----
    const ext = (ctx as Ctx | null)?.extension ?? null;
    const actividadReciente = !!(ext?.ultima_actividad && Date.now() - new Date(ext.ultima_actividad).getTime() < 10 * 60_000);
    const extensionLista = !!(sbUser && userId && ext && Number(ext.claves_activas) > 0 && (contexto?.extensionConectada === true || actividadReciente));
    const acciones: any[] = []; // filas creadas o afectadas en esta vuelta: van al chat como tarjetas
    if (sbUser && userId) {
      contextoTxt += `\nExtensión lista para ejecutar acciones: ${extensionLista ? "SÍ" : "NO (sin actividad en los últimos 10 min o sin API key)"}`;
      try {
        const { data: rec } = await sbUser.rpc("evaristo_acciones_recientes", { p_limite: 6 });
        const lista = Array.isArray(rec) ? rec : [];
        if (lista.length) {
          contextoTxt += `\nAcciones recientes de Evaristo (más nueva primero): ` + lista.map((a: any) =>
            `${a.tipo}${a.codigo ? " " + a.codigo : ""} → ${a.estado}${a.error ? ` (${String(a.error).slice(0, 80)})` : ""}${a.resultado && a.estado === "hecha" ? ` ${JSON.stringify(a.resultado).slice(0, 90)}` : ""}`).join(" · ");
        }
      } catch (e) { console.error("acciones recientes", String(e).slice(0, 120)); }
    }

    const TIPOS_ACCION = ["sincronizar_licitacion", "sincronizar_ca", "preparar_oferta", "publicar_cm"];
    const TOOLS = [
      {
        type: "function",
        function: {
          name: "programar_accion",
          description: "Deja una acción en cola para que la extensión de Chrome del cliente la ejecute en Mercado Público con su sesión. publicar_cm queda esperando la confirmación del cliente en el chat.",
          parameters: {
            type: "object",
            properties: {
              tipo: { type: "string", enum: TIPOS_ACCION },
              codigo: { type: "string", description: "Código de la licitación (1234-56-LE26) o compra ágil (1234-56-COT26). No aplica a publicar_cm." },
              regiones: { type: "array", items: { type: "string" }, description: "Solo publicar_cm: regiones a marcar (nombres cortos: Metropolitana, Biobío…)." },
              marcas: { type: "array", items: { type: "string" }, description: "Solo publicar_cm: marcas o palabras que debe tener el producto para tocarlo." },
            },
            required: ["tipo"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "estado_acciones",
          description: "Devuelve las últimas acciones programadas y su estado real (confirmar, pendiente, en_curso, hecha, fallida, cancelada).",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "cancelar_accion",
          description: "Cancela una acción que todavía no se ejecutó (estado confirmar o pendiente).",
          parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
        },
      },
    ];

    async function ejecutarTool(name: string, args: any): Promise<any> {
      if (!sbUser || !userId) return { ok: false, motivo: "sin_sesion" };
      try {
        if (name === "programar_accion") {
          const tipo = String(args?.tipo || "");
          if (!TIPOS_ACCION.includes(tipo)) return { ok: false, motivo: "tipo_invalido", tipos: TIPOS_ACCION };
          const cod = tipo === "publicar_cm" ? null : String(args?.codigo || codigo || "").trim().toUpperCase();
          if (tipo !== "publicar_cm" && !/^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2,3}$/.test(cod || "")) return { ok: false, motivo: "codigo_invalido", detalle: "Necesito el código con formato 1234-56-LE26 o 1234-56-COT26." };
          if (!extensionLista) return { ok: false, motivo: "extension_no_conectada", detalle: "La extensión de Chrome no está conectada o no ha dado señales en 10 minutos. Guía al cliente a /configuracion/extension." };
          // No duplicar: si ya hay una igual viva, se devuelve esa.
          let q = sbUser.from("evaristo_acciones").select("id, tipo, codigo, estado, creado_en").eq("user_id", userId).eq("tipo", tipo).in("estado", ["confirmar", "pendiente", "en_curso"]);
          q = cod ? q.eq("codigo", cod) : q.is("codigo", null);
          const { data: viva } = await q.order("creado_en", { ascending: false }).limit(1).maybeSingle();
          if (viva) { if (!acciones.some((a) => a.id === viva.id)) acciones.push(viva); return { ok: true, repetida: true, ...viva }; }
          const payload: Record<string, unknown> = {};
          if (Array.isArray(args?.regiones) && args.regiones.length) payload.regiones = args.regiones.map(String).slice(0, 16);
          if (Array.isArray(args?.marcas) && args.marcas.length) payload.marcas = args.marcas.map(String).slice(0, 30);
          const estado = tipo === "publicar_cm" ? "confirmar" : "pendiente";
          const { data: fila, error } = await sbUser.from("evaristo_acciones")
            .insert({ user_id: userId, tipo, codigo: cod, payload, estado, creada_por: "evaristo" })
            .select("id, tipo, codigo, estado, creado_en").single();
          if (error || !fila) return { ok: false, motivo: "error_bd", detalle: error?.message };
          acciones.push(fila);
          return { ok: true, ...fila, nota: estado === "confirmar" ? "Queda esperando que el cliente apriete Confirmar en la tarjeta del chat." : "La extensión la toma en el próximo minuto." };
        }
        if (name === "estado_acciones") {
          const { data } = await sbUser.rpc("evaristo_acciones_recientes", { p_limite: 8 });
          return { ok: true, acciones: Array.isArray(data) ? data : [] };
        }
        if (name === "cancelar_accion") {
          const { data, error } = await sbUser.rpc("evaristo_accion_decidir", { p_id: String(args?.id || ""), p_confirmar: false });
          if (error) return { ok: false, detalle: error.message };
          const fila = data as any;
          if (fila?.id) { const i = acciones.findIndex((a) => a.id === fila.id); if (i >= 0) acciones[i] = fila; else acciones.push(fila); }
          return { ok: true, estado: fila?.estado };
        }
        return { ok: false, motivo: "herramienta_desconocida" };
      } catch (e) {
        return { ok: false, motivo: "excepcion", detalle: String(e).slice(0, 160) };
      }
    }

    const historial = (messages as Array<{ role: string; content: string }>)
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
      .slice(-12);
    const chatMessages: any[] = [{ role: "system", content: SYSTEM_PROMPT + contextoTxt }, ...historial.map((m) => ({ role: m.role, content: m.content }))];

    // Captura (print): va adjunta al último mensaje del usuario.
    if (imagen && typeof imagen === "string" && imagen.startsWith("data:")) {
      const last = chatMessages[chatMessages.length - 1];
      const userText = last && last.role === "user" ? String(last.content || "") : "Te mando una captura de lo que veo.";
      const contentArr = [{ type: "text", text: userText || "Te mando una captura de lo que veo." }, { type: "image_url", image_url: { url: imagen } }];
      if (last && last.role === "user") last.content = contentArr; else chatMessages.push({ role: "user", content: contentArr });
    }

    const t0 = Date.now();
    let reply = "", diag = "", modeloUsado = "";
    const conTools = !!(sbUser && userId && contexto?.canal !== "landing");
    for (const model of MODELOS) {
      try {
        const msgs = [...chatMessages];
        let texto = "";
        let fallo = false;
        // Hasta 2 rondas de herramientas y una respuesta final.
        for (let ronda = 0; ronda < 3; ronda++) {
          const usarTools = conTools && ronda < 2;
          const response = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages: msgs, temperature: 0.5, max_tokens: 800, ...(usarTools ? { tools: TOOLS, tool_choice: "auto" } : {}) }),
          });
          if (!response.ok) { diag = `${model}: ${response.status} ${(await response.text()).slice(0, 160)}`; console.error("Gemini error:", diag); fallo = true; break; }
          const data = await response.json();
          const m = data?.choices?.[0]?.message;
          const calls = Array.isArray(m?.tool_calls) ? m.tool_calls : [];
          if (calls.length) {
            msgs.push({ role: "assistant", content: m?.content ?? null, tool_calls: calls });
            for (const c of calls) {
              let args: any = {};
              try { args = JSON.parse(c?.function?.arguments || "{}"); } catch { args = {}; }
              const out = await ejecutarTool(String(c?.function?.name || ""), args);
              msgs.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(out) });
            }
            continue;
          }
          texto = m?.content ? String(m.content) : "";
          break;
        }
        if (fallo) continue;
        if (texto.trim()) { reply = texto; modeloUsado = model; break; }
        diag = `${model}: respuesta vacía`;
      } catch (err) { diag = `${model}: ${String(err).slice(0, 120)}`; console.error("Gemini fetch error:", diag); }
    }
    // Si la IA se cayó después de programar algo, igual se le cuenta al cliente.
    if (!reply && acciones.length) {
      const NOMBRE: Record<string, string> = { sincronizar_licitacion: "sincronizar la licitación", sincronizar_ca: "traer los documentos de la compra ágil", preparar_oferta: "dejar lista la oferta de", publicar_cm: "publicar en Convenio Marco" };
      reply = acciones.map((a) => a.estado === "confirmar"
        ? `Dejé lista la acción de ${NOMBRE[a.tipo] || a.tipo}: aprieta **Confirmar** en la tarjeta de abajo y la extensión parte al tiro.`
        : `Ya dejé en cola ${NOMBRE[a.tipo] || a.tipo}${a.codigo ? ` ${a.codigo}` : ""}. La extensión de Chrome la ejecuta en el próximo minuto; te aviso el resultado en la tarjeta de abajo.`).join("\n\n");
      modeloUsado = "fallback";
    }

    // Si esto suena a un problema técnico (no a una duda de uso) y sabemos el correo del
    // usuario, Don Evaristo deja el ticket solo: no espera a que toque "contactar al equipo".
    // Corre SIEMPRE (aunque Gemini haya fallado arriba): la detección es por regex, no depende
    // de la IA, y si no la corremos acá un "no carga" con Gemini caído nunca se escala.
    let ticket: { numero?: number | string } | null = null;
    try {
      const ultimo = historial[historial.length - 1];
      const textoUsuario = ultimo && ultimo.role === "user" ? String(ultimo.content || "") : "";
      const RE_PROBLEMA = /no (funciona|anda|carga|sirve|deja|redirige|trae nada|pasa nada|hace nada|abre)|error|falla|se (cae|pilla|traba|congela|rompi[oó])|pantalla (en blanco|vac[ií]a)|\bbug\b|qued[oó] pillad/i;
      const pareceProblema = !!imagen || RE_PROBLEMA.test(textoUsuario);
      // Si ya se creó un ticket automático antes en esta misma conversación (queda la marca
      // en la respuesta de Evaristo), no generamos uno nuevo por cada mensaje de seguimiento.
      const yaTieneTicket = historial.some(
        (m) => m.role === "assistant" && /caso\s*\*\*#\d+/i.test(String(m.content || "")),
      );
      const correo = identidad?.email ?? userEmail;
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (pareceProblema && !yaTieneTicket && correo && SUPABASE_URL && SERVICE_KEY) {
        const resumen = (textoUsuario || "El usuario envió una captura reportando un problema.").slice(0, 100);
        const r = await fetch(`${SUPABASE_URL}/functions/v1/soporte-ticket`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            email: correo,
            user_id: identidad?.userId ?? userId,
            canal: "app-auto",
            pantalla: contexto?.page,
            asunto: `Bug automático: ${resumen}`,
            mensaje: textoUsuario || "El usuario envió una captura reportando un problema (revisar imagen adjunta).",
            conversacion: reply ? [...historial, { role: "assistant", content: reply }] : historial,
            tipo: "bug",
            origen: "automatico",
            imagen,
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j?.numero) ticket = { numero: j.numero };
      }
    } catch (e) {
      console.error("evaristo-soporte auto-ticket:", e);
    }

    if (!reply) {
      let fallback = "Uf, tuve un problemita para responderte 🙈. Reintenta en un ratito, o escríbeme por WhatsApp +56 9 9425 9157 / contacto@firmavb.cl.";
      if (ticket?.numero) fallback += `\n\n✅ Aun así, ya dejé tu problema registrado como caso **#${ticket.numero}**; el equipo técnico te va a responder a **${identidad?.email ?? userEmail}**.`;
      return json({ reply: fallback, ticket, error: diag || "sin_respuesta" });
    }

    if (ticket?.numero) {
      reply += `\n\n✅ Ya dejé esto registrado como caso **#${ticket.numero}** para el equipo técnico, no necesitas hacer nada más. Te van a responder a **${identidad?.email ?? userEmail}**.`;
    }

    // Memoria: guardar la vuelta (solo con sesión). Si falla, la respuesta igual sale.
    let convId: string | null = typeof conversacion_id === "string" ? conversacion_id : null;
    if (sbUser && userId) {
      try {
        const ultimoUser = [...historial].reverse().find((m) => m.role === "user");
        const meta = { pantalla: contexto?.page ?? null, ruta: contexto?.ruta ?? null, codigo, canal: contexto?.canal ?? "app" };
        if (convId) {
          const { data: c } = await sbUser.from("evaristo_conversaciones").select("id").eq("id", convId).maybeSingle();
          if (!c) convId = null;
        }
        if (!convId) {
          const titulo = (ultimoUser?.content ?? "Conversación").replace(/\s+/g, " ").slice(0, 80);
          const { data: c } = await sbUser.from("evaristo_conversaciones")
            .insert({ user_id: userId, canal: contexto?.canal ?? "app", titulo, contexto: meta })
            .select("id").single();
          convId = c?.id ?? null;
        } else {
          await sbUser.from("evaristo_conversaciones").update({ actualizado_en: new Date().toISOString(), contexto: meta }).eq("id", convId);
        }
        if (convId) {
          await sbUser.from("evaristo_mensajes").insert([
            { conversacion_id: convId, user_id: userId, rol: "user", contenido: ultimoUser?.content ?? "(captura)", adjuntos: imagen ? [{ tipo: "imagen" }] : null, meta },
            { conversacion_id: convId, user_id: userId, rol: "assistant", contenido: reply, meta: { ...meta, modelo: modeloUsado, ms: Date.now() - t0, ...(acciones.length ? { acciones: acciones.map((a) => ({ id: a.id, tipo: a.tipo, codigo: a.codigo, estado: a.estado })) } : {}) } },
          ]);
          const sinConv = acciones.filter((a) => a.id).map((a) => a.id);
          if (sinConv.length) await sbUser.from("evaristo_acciones").update({ conversacion_id: convId }).in("id", sinConv).is("conversacion_id", null);
        }
      } catch (e) { console.error("memoria evaristo", String(e).slice(0, 160)); }
    }

    return json({ reply, conversacion_id: convId, ticket, acciones });
  } catch (e) {
    console.error("evaristo-soporte error:", e);
    return json({ reply: "Tuve un error inesperado. Reintenta, y si sigue, escríbeme a contacto@firmavb.cl.", error: String(e) });
  }
});
