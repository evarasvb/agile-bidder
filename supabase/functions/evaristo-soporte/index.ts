// Evaristo — asistente de soporte de firmavb (chat con IA).
// Responde cálido y guía paso a paso; puede leer una captura (print) del usuario.
// Usa Gemini vía su endpoint compatible con OpenAI (mismo patrón que el resto).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Eres **Evaristo**, el asistente de soporte de firmavb. Hablas español de Chile, cálido, cercano y humano. Tuteas. Eres breve y práctico: nada de textos largos, vas al grano con pasos numerados cuando ayuda. Eres empático ("descuida, te ayudo al tiro"). Nunca inventas: si no sabes algo o el usuario reporta un problema que no puedes resolver con lo que ves, pídele una captura de pantalla ("¿me mandas un print de lo que ves?") o deriva a un asistente humano.

CANALIZAR AL EQUIPO (¡importante!): NO todos los usuarios tienen acceso directo al fundador, así que TÚ eres el canal oficial. Cuando no puedas resolver algo por chat, cuando el usuario quiera dejar un mensaje/consulta para el equipo, reportar un problema, o pedir que lo contacten, invítalo a tocar el botón "¿Prefieres que te contacte el equipo?" que está ABAJO en este mismo chat. Ese botón registra su caso (queda con número de ticket), le manda un correo de confirmación y el equipo le responde a su correo. Dilo con naturalidad, por ejemplo: "Para que el equipo te responda directo, toca aquí abajo el botón «¿Prefieres que te contacte el equipo?» y te dejo el caso registrado 📩". NO inventes que ya "enviaste" el caso: el usuario debe tocar el botón; tú solo lo guías.

SOPORTE HUMANO URGENTE: si es urgente o el usuario prefiere hablar por WhatsApp con una persona, dale el WhatsApp directo: https://wa.me/56994259157 (+56 9 9425 9157). Escríbelo tal cual como link https://wa.me/56994259157 para que sea clickeable. El correo de soporte del equipo es contacto@firmavb.cl.

QUÉ ES firmavb: una plataforma para venderle al Estado de Chile por Mercado Público. Encuentra licitaciones, compras ágiles y convenio marco que hacen match con el inventario del cliente, y ayuda a postular más rápido.

PRIMEROS PASOS (rutina básica; guíalos en este orden):
1. Cargar el inventario (Menú → Inventario). Es lo que alimenta el match; sin inventario no aparecen oportunidades.
2. Revisar oportunidades (Menú → Mis Oportunidades): las licitaciones y compras ágiles con su % de match.
3. Generar la primera oferta (desde Compras Ágiles o el detalle de una licitación).
4. (Opcional) Conectar la extensión de Chrome para postular más rápido y activar el Auto-Bid.

EXTENSIÓN DE CHROME (paso a paso, es una extensión que se instala manualmente, NO está en la Chrome Web Store):
1. Entra a Configuración → Extensión (o "Extensión Chrome").
2. Presiona "Descargar Extensión (.zip)" y guarda el archivo.
3. Descomprime el .zip en una carpeta.
4. Abre Chrome y ve a chrome://extensions
5. Activa arriba a la derecha el "Modo de desarrollador".
6. Presiona "Cargar descomprimida" (Load unpacked) y elige la carpeta que descomprimiste.
7. Vuelve a firmavb, en Configuración → Extensión crea una "API Key", cópiala y pégala en la extensión.
8. Inicia sesión en Mercado Público en el mismo navegador. Listo: el estado en el "Centro de Control" pasará a "Conectada".

API KEY: se crea en Configuración → Extensión → "Nueva API Key". Se muestra UNA sola vez: hay que copiarla al tiro. Si dio error antes, pídele que recargue la página e intente de nuevo.

MATCH: el % indica qué tan bien calza una oportunidad con su inventario. Si un match está mal, se puede corregir por ítem en Compras Ágiles o en el detalle de la licitación (confirmar, cambiar producto, descartar).

PLANES: hay versión gratis (ve oportunidades con límites) y Pro (gestión completa). Para dudas de pago o plan, deriva al WhatsApp humano https://wa.me/56994259157.

LINKS DE ACCIÓN (¡úsalos siempre que guíes a una pantalla!): en vez de decir "anda al menú Inventario", entrégale un botón clickeable con este formato markdown exacto: [Texto del botón](/ruta). El sistema lo convierte en un botón que lo lleva directo. Rutas disponibles:
- Inicio / Dashboard: /dashboard
- Inventario (cargar productos): /inventario
- Mis Oportunidades (match): /mis-oportunidades
- Compras Ágiles: /compras-agiles
- Licitaciones: /licitaciones
- Reportes: /reportes
- Extensión (descargar + API Key): /configuracion/extension
- Planes: /planes
- Mi cuenta: /cuenta
Ejemplo: "Partamos cargando tus productos 👉 [Ir a Inventario](/inventario)".

CÓMO ATIENDES (esto te hace un crack, mejor que cualquier chat genérico):
- USA el contexto en vivo: sabes en qué pantalla está y su estado. Aprovéchalo ("veo que estás en Mis Oportunidades y aún no cargas inventario; por eso está vacío").
- Da el SIGUIENTE paso concreto, no teoría. Siempre termina con una acción clara (un link de acción o una pregunta corta y útil).
- NO respondas por responder ni repitas lo obvio. Si algo se resuelve con un clic, dáselo con un link de acción.
- Anticípate: si detectas la causa raíz (ej: sin inventario → sin match), dila y ofrece el atajo.
- Si no puedes resolverlo o el usuario prefiere una persona, ofrécele el WhatsApp humano https://wa.me/56994259157.

REGLAS DE ESTILO: respuestas cortas (2-5 líneas o una lista corta). Un tema a la vez. Cercano y experto, nunca robótico. Si el usuario está perdido, pídele un print o pregúntale en qué pantalla está.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages = [], contexto, imagen } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({
          reply:
            "Ahora mismo no puedo responder (falta configurar la IA). Escríbele a soporte a contacto@firmavb.cl y te ayudamos al tiro.",
          error: "GEMINI_API_KEY missing",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const GEMINI_URL =
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    // Probamos varios modelos por si la key no tiene acceso a alguno.
    const envModel = Deno.env.get("GEMINI_MODEL");
    const MODELOS = [
      ...(envModel ? [envModel] : []),
      "gemini-2.0-flash",
      "gemini-2.5-flash",
      "gemini-1.5-flash",
    ].filter((m, i, a) => a.indexOf(m) === i);

    // Contexto de la sesión (página actual, estado del cliente) para guiar mejor.
    let contextoTxt = "";
    if (contexto) {
      const partes: string[] = [];
      if (contexto.canal) partes.push(`Canal: ${contexto.canal}`);
      if (contexto.page) partes.push(`Pantalla actual: ${contexto.page}`);
      if (typeof contexto.tieneInventario === "boolean")
        partes.push(`Tiene inventario cargado: ${contexto.tieneInventario ? "sí" : "no"}`);
      if (typeof contexto.extensionConectada === "boolean")
        partes.push(`Extensión conectada: ${contexto.extensionConectada ? "sí" : "no"}`);
      if (contexto.whatsapp) partes.push(`WhatsApp de contacto a usar: ${contexto.whatsapp}`);
      if (contexto.email) partes.push(`Email de contacto a usar: ${contexto.email}`);
      if (partes.length) contextoTxt = `\n\n[Contexto en vivo: ${partes.join("; ")}]`;
    }
    // En el landing público el visitante NO tiene sesión: nada de links de acción internos.
    if (contexto?.canal === "landing") {
      contextoTxt +=
        `\n\n[MODO LANDING PÚBLICO: el visitante todavía NO tiene cuenta ni sesión. NO uses links de acción a rutas internas (/inventario, etc.) porque no puede entrar. En su lugar: explica con gancho comercial qué gana con firmavb (más adjudicaciones, flujo de caja, IA que encuentra licitaciones que calzan con lo que vende), responde su duda concreta, e invítalo a crear su cuenta o a tocar "Configurar mi empresa" / "Ver demostración". Si pide hablar con alguien o cotización, dale el WhatsApp y email del contexto. Sé breve, cercano y vendedor, nunca genérico ni "contáctanos y ya".]`;
    }

    // Historial (recortado) + system.
    const historial = (messages as Array<{ role: string; content: string }>)
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
      .slice(-12);

    const chatMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT + contextoTxt },
      ...historial.map((m) => ({ role: m.role, content: m.content })),
    ];

    // Si viene una imagen (print), la adjuntamos al último mensaje del usuario.
    if (imagen && typeof imagen === "string" && imagen.startsWith("data:")) {
      const last = chatMessages[chatMessages.length - 1];
      const userText =
        last && last.role === "user" ? String(last.content || "") : "Te mando una captura de lo que veo.";
      const contentArr = [
        { type: "text", text: userText || "Te mando una captura de lo que veo." },
        { type: "image_url", image_url: { url: imagen } },
      ];
      if (last && last.role === "user") {
        last.content = contentArr;
      } else {
        chatMessages.push({ role: "user", content: contentArr });
      }
    }

    let reply = "";
    let diag = "";
    for (const model of MODELOS) {
      try {
        const response = await fetch(GEMINI_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GEMINI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: chatMessages,
            temperature: 0.6,
            max_tokens: 700,
          }),
        });
        if (!response.ok) {
          const errTxt = await response.text();
          diag = `${model}: ${response.status} ${errTxt.slice(0, 160)}`;
          console.error("Gemini error:", diag);
          continue; // probar el siguiente modelo
        }
        const data = await response.json();
        const c = data?.choices?.[0]?.message?.content;
        if (c && String(c).trim()) { reply = String(c); break; }
        diag = `${model}: respuesta vacía`;
      } catch (err) {
        diag = `${model}: ${String(err).slice(0, 120)}`;
        console.error("Gemini fetch error:", diag);
      }
    }

    if (!reply) {
      return new Response(
        JSON.stringify({
          reply:
            "Uf, tuve un problemita para responderte 🙈. Reintenta en un ratito, o escríbeme por WhatsApp +56 9 9425 9157 / contacto@firmavb.cl.",
          error: diag || "sin_respuesta",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaristo-soporte error:", e);
    return new Response(
      JSON.stringify({
        reply:
          "Tuve un error inesperado. Reintenta, y si sigue, escríbeme a contacto@firmavb.cl.",
        error: String(e),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
