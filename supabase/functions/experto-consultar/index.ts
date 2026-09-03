// Experto FirmaVB — chat y análisis de licitaciones con fuentes reales.
// Busca en Postgres (normativa, jurisprudencia, datos de Mercado Público) y
// responde con Gemini en streaming (SSE). Límites por plan.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
// Gratis con cuenta: 3 preguntas y 1 informe al mes. Comodín sin cuenta: 1 pregunta por navegador y 3 por IP al día.
const LIMITES_FREE = { chat: 3, informe: 1 };
const LIMITES_ANON = { chat: 1, informe: 0 };
const MAX_IP_ANON_24H = 3;
// Topes que el cliente no controla (el limite mensual por huella se reinicia en incognito):
//  - por IP y hora: frena loops
//  - anonimas en 24h rodantes: techo de costo en Gemini cuando se viraliza
// Si la consulta de cuota falla, se deja pasar (fail-open): es una red de seguridad, no auth.
const MAX_IP_HORA = Number(Deno.env.get("EXPERTO_MAX_IP_HORA") ?? 20);
const MAX_ANON_24H = Number(Deno.env.get("EXPERTO_MAX_ANON_24H") ?? 500);
// Chat: prioridad velocidad (lite responde en <1 s). Informe: prioridad calidad.
const MODELOS_CHAT = [Deno.env.get("GEMINI_MODEL_CHAT"), "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.6-flash"].filter(Boolean) as string[];
const MODELOS_INFORME = [Deno.env.get("GEMINI_MODEL_INFORME"), "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"].filter(Boolean) as string[];
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const STOP = new Set("de la el los las un una unos unas y o u que en para por con sin sobre al del se su sus es son fue ser hay como cuando donde qué que cual cuál cuáles quien quién cómo cuánto cuánta cuántos cuántas mi mis me tu tus le les lo nos si no más muy este esta estos estas ese esa eso aquel puedo puede pueden podemos debo debe deben hacer tiene tienen tengo hay está están estoy ese esa alguna algun algún alguno algunos algunas alguien algo otra otro otras otros".split(" "));

const GENERICAS = new Set("licitacion licitaciones licitacio compra compras agil agiles abierta abiertas abierto abiertos semana semanas hoy ahora vigente vigentes oportunidad oportunidades estado mercado publico publicas publica dame dime muestrame busca buscar quiero necesito hay existen existe cuales cuantas cuantos tipo tipos vende venden vender precio precios quien quienes competencia proveedor proveedores organismo organismos entiende cual sobre respecto tema".split(" "));
function palabrasClave(t: string): string[] {
  return [...new Set(t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ\- ]/g, " ").split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w)))].slice(0, 10);
}
// Palabras de contenido (sin genéricas) para consultar datos de mercado
function palabrasDatos(t: string): string[] {
  return palabrasClave(t).filter((w) => !GENERICAS.has(w)).slice(0, 4);
}
function rolYSub(auth: string): { role: string; sub: string | null } {
  try {
    const p = JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { role: p.role ?? "", sub: p.sub ?? null };
  } catch { return { role: "", sub: null }; }
}
function ipCliente(req: Request): string | null {
  // X-Forwarded-For puede traer valores forjados por el cliente al inicio; el gateway
  // agrega la IP real AL FINAL. Se toma la ultima para que el tope por IP no se pueda esquivar.
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = xff.length ? xff[xff.length - 1] : (req.headers.get("x-real-ip") ?? req.headers.get("cf-connecting-ip") ?? "").trim();
  return ip ? ip.slice(0, 64) : null;
}
const fmt = (n: any) => n == null ? "s/i" : "$" + Math.round(Number(n)).toLocaleString("es-CL");
const fecha = (d: any) => d ? new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "s/i";

function textoFragmentos(frs: any[]) {
  return frs.map((f, i) => `[${i + 1}] ${f.fuente}${f.seccion ? " — " + f.seccion : ""}\n${String(f.texto).slice(0, 1800)}`).join("\n\n");
}
function textoOrganismo(o: any) {
  const top = (o.top_proveedores ?? []).slice(0, 5).map((p: any) => `${p.proveedor} (${p.ordenes} OC, ${fmt(p.monto)})`).join("; ");
  const recl = o.reclamos == null ? "sin dato" : `${o.reclamos} reclamos por incumplir plazo de pago en los últimos 12 meses (ficha Mercado Público leída el ${o.dato_pago_al ?? "s/i"}${o.reclamos_hace_90d != null ? `; hace 90 días eran ${o.reclamos_hace_90d}` : ""})`;
  const desglose = o.reclamos_pago_12m == null ? "sin dato" :
    `${o.reclamos_pago_12m} por pago no oportuno y ${o.reclamos_proceso_12m ?? 0} por irregularidad en el proceso (buscador de reclamos MP desde ${o.reclamos_desde ?? "s/i"}); ${o.reclamos_pago_90d ?? 0} de pago en los últimos 90 días; ${o.reclamantes_pago_12m ?? 0} reclamantes distintos${o.top_reclamante ? `, el mayor (${o.top_reclamante}) concentra el ${o.top_reclamante_pct}%` : ""}; procesos publicados 12 meses: ${o.procesos_12m ?? 0} → ${o.reclamos_pago_por_100_procesos ?? "s/i"} reclamos de pago por cada 100 procesos`;
  return `${o.institucion} (RUT ${o.rut ?? "s/i"}, ${o.region ?? "s/i"})
Reclamos por no pago (ficha MP): ${recl}
Reclamos desglosados: ${desglose}
Plazo de pago declarado en sus licitaciones: ${o.plazo_pago ?? "s/i"} | Conducta de pago histórica: ${o.conducta_pago ?? "s/i"} (${o.pago_promedio_dias ?? "s/i"} días promedio)
Órdenes de compra últimos 12 meses: ${o.oc_12m ?? 0} por ${fmt(o.monto_12m)} | Licitaciones abiertas hoy: ${o.licitaciones_abiertas ?? 0}
Top proveedores 12 meses: ${top || "s/i"}`;
}
function textoFicha(f: any) {
  if (!f) return "";
  const items = (f.items ?? []).slice(0, 25).map((i: any) => `- ${i.producto}${i.cantidad ? ` (${i.cantidad} ${i.unidad ?? ""})` : ""}${i.descripcion ? ": " + i.descripcion : ""}`).join("\n");
  const o = f.organismo ?? {};
  const top = (o.top_proveedores ?? []).slice(0, 5).map((p: any) => `${p.proveedor} (${p.ordenes} OC, ${fmt(p.monto)})`).join("; ");
  const comp = (f.competencia ?? []).slice(0, 6).map((c: any) => `${c.proveedor}: ${c.ordenes} OC, ${fmt(c.monto)}, precio unit. mediano ${fmt(c.precio_unit_mediano)}`).join("\n");
  const sim = (f.licitaciones_similares_del_organismo ?? []).map((s: any) => `${s.codigo} (${s.estado}, ${fecha(s.publicada)}, ${fmt(s.presupuesto)}): ${s.nombre}`).join("\n");
  return `LICITACIÓN ${f.codigo}: ${f.nombre}
Organismo: ${f.institucion} (${f.unidad_compra ?? ""}) — ${f.comuna ?? ""}, ${f.region ?? ""}
Estado: ${f.estado} | Tipo: ${f.tipo ?? "s/i"} | Presupuesto: ${fmt(f.presupuesto)} ${f.moneda ?? ""} | Modalidad: ${f.modalidad ?? "s/i"} | Pago: ${f.tipo_pago ?? "s/i"} | Duración contrato: ${f.duracion_contrato ?? "s/i"}
Publicada: ${fecha(f.fecha_publicacion)} | Cierre: ${fecha(f.fecha_cierre)} | Adjudicación estimada: ${fecha(f.fecha_adjudicacion)}
Fechas API: ${JSON.stringify(f.fechas_api ?? {})}
Descripción: ${(f.descripcion ?? "").slice(0, 1500)}
Link: ${f.url}
ÍTEMS:\n${items || "(sin ítems)"}
ORGANISMO: conducta de pago ${o.conducta_pago ?? "s/i"}, ${o.pago_promedio_dias ?? "s/i"} días promedio; reclamos por no pagar a tiempo (12 meses, ficha Mercado Público al ${o.dato_pago_al ?? "s/i"}): ${o.reclamos ?? "s/i"}${o.reclamos_hace_90d != null ? ` (hace 90 días: ${o.reclamos_hace_90d})` : ""}; plazo de pago declarado: ${o.plazo_pago ?? "s/i"}; OC últimos 12 meses ${o.oc_12m ?? 0} por ${fmt(o.monto_12m)}; licitaciones abiertas ${o.licitaciones_abiertas ?? 0}. Top proveedores: ${top || "s/i"}
COMPETENCIA (quién vende estos productos al Estado, 12 meses):\n${comp || "s/i"}
LICITACIONES SIMILARES DEL MISMO ORGANISMO:\n${sim || "ninguna"}`;
}

// Bases subidas por usuarios: resumen estructurado + secciones más afines a la pregunta.
function textoBases(bases: any[], pregunta: string, maxChars: number, nDesde: number, codigo: string): string {
  const claves = [...palabrasClave(pregunta), "evaluacion", "criterio", "puntaje", "ponderacion", "garantia", "multa", "pago", "admisibilidad", "anexo", "plazo"]
    .map((w) => w.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const out: string[] = [];
  bases.forEach((b, i) => {
    const n = nDesde + i + 1;
    let presupuesto = Math.max(2500, Math.floor(maxChars / bases.length));
    const secs: any[] = Array.isArray(b.secciones) ? b.secciones : [];
    const puntuadas = secs.map((s, idx) => { const t = norm(String(s.texto ?? "")); return { idx, s, p: claves.reduce((a, k) => a + (t.split(k).length - 1), 0) }; })
      .sort((x, y) => y.p - x.p || x.idx - y.idx);
    const elegidas: any[] = [];
    for (const c of puntuadas) { const len = String(c.s.texto ?? "").length + 40; if (len > presupuesto) continue; elegidas.push(c); presupuesto -= len; }
    elegidas.sort((x, y) => x.idx - y.idx);
    out.push(`[${n}] BASES DE LA LICITACIÓN ${codigo} — archivo "${b.archivo}" (${b.paginas ?? "?"} páginas, subido por un usuario de FirmaVB)
RESUMEN ESTRUCTURADO DE LAS BASES: ${b.resumen ? JSON.stringify(b.resumen) : "(sin resumen)"}
SECCIONES DE LAS BASES MÁS RELACIONADAS CON LA PREGUNTA:
${elegidas.map((c) => `## ${c.s.titulo}\n${c.s.texto}`).join("\n\n") || "(sin secciones)"}`);
  });
  return out.join("\n\n");
}

const SYS_CHAT = `Eres el Experto FirmaVB, asesor con 17 años vendiéndole al Estado chileno por Mercado Público / ChileCompra.
Hablas como Evaristo Varas en su libro "Véndele al Estado y No Mueras en el Intento": de tú, cercano, directo, como un amigo que ya pasó por esto y te lo cuenta sin adornos. Frases cortas. Nada de "estimado", "revisor en mano" ni saludos largos; entra al grano en la primera línea. Ejemplos concretos de la calle antes que teoría. Cuando toca, un empujón honesto ("no hay atajos", "no basta con querer ganar, hay que poder cumplir"). Si algo es riesgoso, dilo sin rodeos. Cierra siempre con el paso concreto que daría hoy.
Reglas:
- Responde SOLO con lo que respaldan las FUENTES y DATOS entregados. Cita entre corchetes [n] la fuente usada después de cada afirmación que provenga de ella. Con ley o reglamento nombra el artículo en la frase; con directivas su número; con dictámenes de Contraloría número y año (advierte si es anterior a dic-2024: puede citar el reglamento antiguo D.250/2004, reemplazado por el D.661/2024); con sentencias del TCP rol y fecha; con el libro, dilo como criterio práctico del autor.
- Con datos de Mercado Público entrega código, organismo, monto, cierre y link.
- Si hay FICHA ORGANISMO, úsala para evaluar el riesgo de venderle. Distingue reclamos por pago no oportuno (riesgo de caja) de los por irregularidad en el proceso (riesgo de evaluación). Pondera por volumen: usa "reclamos de pago por cada 100 procesos" (menos de 1 bajo, 1 a 5 medio, más de 5 alto) antes que el número bruto; si un solo reclamante concentra más del 50%, adviértelo (puede ser un proveedor reclamando en masa). Compara con la cifra de hace 90 días si existe. Cítalo como "Datos Mercado Público vía FirmaVB". Si el dato dice "sin dato", dilo así.
- Con LICITACIONES PARECIDAS YA ADJUDICADAS y QUIÉN LE GANA A ESTE ORGANISMO, di quién gana, a qué precio respecto del presupuesto y cuántos oferentes compiten; cítalo como "Datos Mercado Público vía FirmaVB (OCDS)".
- Si hay BASES DE LA LICITACIÓN (PDF subido por un usuario), son la fuente principal para criterios de evaluación, ponderaciones, garantías, plazos, multas, anexos y cláusulas: responde con esos datos exactos, cita [n] y nombra la sección o numeral. Si el contexto dice NO HAY BASES CARGADAS y la pregunta las necesita, responde lo que sí sabes y pide que las suban con el botón "Subir bases (PDF)"; no mandes al usuario a descargarlas de Mercado Público.
- Si las fuentes no cubren la pregunta, dilo ("No tengo fuente en mi base para eso") y señala qué documento consultar. No inventes artículos, plazos, cifras ni licitaciones.
- Montos en pesos con separador de miles ($1.234.567). Máximo 250 palabras salvo que pidan detalle. Párrafos cortos; lista corta solo para varias licitaciones. Formato Markdown simple.`;

const SYS_INFORME = `Eres el Experto FirmaVB, asesor con 17 años vendiéndole al Estado chileno. Vas a entregar a un proveedor pyme un INFORME DE TRABAJO para una licitación concreta, usando SOLO la ficha, fuentes y datos entregados. Hablas como Evaristo Varas en su libro "Véndele al Estado y No Mueras en el Intento": de tú, cercano, directo, como un amigo que ya pasó por esto y te lo cuenta sin adornos. Frases cortas. Nada de "estimado", "revisor en mano" ni saludos largos; entra al grano en la primera línea. Ejemplos concretos de la calle antes que teoría. Cuando toca, un empujón honesto ("no hay atajos", "no basta con querer ganar, hay que poder cumplir"). Si algo es riesgoso, dilo sin rodeos. Cierra siempre con el paso concreto que daría hoy. Formato Markdown con estas secciones exactas:

## 1. Resumen ejecutivo
Qué se compra, quién, cuánto, cuándo cierra, y tu veredicto en una línea: ¿vale la pena postular? (sí / con reservas / no) y por qué.
## 2. Fechas clave y plan de trabajo
Cronograma hacia atrás desde el cierre: preguntas/aclaraciones, garantía, preparación de anexos, subida de oferta. Con días.
## 3. Checklist de admisibilidad
Lista de verificación de lo que deja fuera una oferta (documentos, garantía de seriedad si aplica, inhabilidades art. 4 Ley 19.886, registro de proveedores, formato de anexos). Marca lo que la ficha permite confirmar y lo que hay que revisar en las bases.
## 4. Cómo se ganan los puntos
Qué criterios de evaluación suelen aplicarse a este tipo de compra y dónde poner el esfuerzo (precio vs. técnico vs. plazo vs. experiencia). Si la ficha no trae criterios, dilo y explica cómo leerlos en las bases.
## 5. Riesgos y jurisprudencia aplicable
Errores que en casos parecidos Contraloría o el TCP ya sancionaron o validaron (cita [n]). Riesgos del organismo (pago, reclamos).
## 6. Competencia y precio de referencia
Quién le vende esto al Estado y a qué precio mediano; quién ganó licitaciones parecidas y con qué monto respecto del presupuesto; quién le gana habitualmente a este organismo; presupuesto vs. mercado; recomendación de estrategia de precio.
## 7. Próximos 3 pasos
Acciones concretas para hoy.
## Fuentes
Lista numerada de las fuentes citadas (norma y artículo, directiva, dictamen, sentencia, capítulo del libro, "Datos Mercado Público vía FirmaVB").

Reglas: cita [n] tras cada afirmación con fuente; si hay BASES DE LA LICITACIÓN en el contexto, la sección 4 usa sus criterios y ponderaciones reales y las secciones 2 y 3 sus plazos, garantías y anexos, citando la sección; no inventes criterios ni plazos que no estén en la ficha, las bases o las fuentes (si no están, di "revisar en bases" y sugiere subirlas con el botón "Subir bases (PDF)"); montos con separador de miles; máximo 900 palabras.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const t0 = Date.now();
  try {
    const body = await req.json();
    const modo: "chat" | "informe" = body.modo === "informe" ? "informe" : "chat";
    const pregunta: string = String(body.pregunta ?? "").trim();
    const huella: string = String(body.huella ?? "").slice(0, 80);
    const historial: { role: string; content: string }[] = Array.isArray(body.historial) ? body.historial.slice(-6) : [];
    let codigo: string | null = body.codigo ? String(body.codigo).trim().toUpperCase() : null;

    const { role, sub } = rolYSub(req.headers.get("Authorization") ?? "");
    const userId = role === "authenticated" ? sub : null;
    const ip = ipCliente(req);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Límites
    const { data: uso } = await sb.rpc("experto_uso_mes", { p_user_id: userId, p_huella: huella || "anon" });
    const u = uso?.[0] ?? { consultas: 0, informes: 0, plan: "free" };
    const esPro = u.plan && u.plan !== "free";
    if (!esPro) {
      // Topes que el cliente no puede reiniciar (IP y global). Fail-open si la consulta falla.
      try {
        const { data: cq, error: cqErr } = await sb.rpc("experto_cuota", { p_ip: ip });
        const c = cq?.[0];
        if (!cqErr && c) {
          if (ip && c.ip_hora >= MAX_IP_HORA) {
            return new Response(JSON.stringify({ error: "ritmo", mensaje: "Demasiadas preguntas seguidas desde tu conexión. Espera un rato e intenta de nuevo.", uso: u }), { status: 429, headers: { ...cors, "Content-Type": "application/json", "Retry-After": "900" } });
          }
          if (!userId && ip && (c.ip_anon_24h ?? 0) >= MAX_IP_ANON_24H) {
            return new Response(JSON.stringify({ error: "comodin_usado", registro: true, mensaje: "El comodín gratis ya se usó desde esta conexión. Crea tu cuenta gratis en FirmaVB y tienes 3 preguntas y 1 informe al mes.", uso: u }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
          }
          if (c.anon_24h >= MAX_ANON_24H) {
            return new Response(JSON.stringify({ error: "cupo_diario", mensaje: "El cupo gratuito de hoy ya se agotó. Vuelve mañana, o con el plan Pro de FirmaVB no hay límite.", plan: u.plan, uso: u }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
          }
        } else if (cqErr) console.error("experto_cuota", cqErr.message);
      } catch (e) { console.error("experto_cuota", String(e)); }

      const usado = modo === "chat" ? u.consultas : u.informes;
      const lim = (userId ? LIMITES_FREE : LIMITES_ANON)[modo];
      if (usado >= lim) {
        if (!userId) return new Response(JSON.stringify({ error: "comodin_usado", registro: true, mensaje: modo === "chat" ? "Usaste tu comodín telefónico. Crea tu cuenta gratis en FirmaVB: 3 preguntas y 1 informe al mes." : "El informe de una licitación es para usuarios con cuenta. Créala gratis: incluye 1 informe al mes.", plan: u.plan, uso: u }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "limite", mensaje: `Llegaste al límite gratuito de ${lim} ${modo === "chat" ? "preguntas" : "informe"} al mes. Con el plan Pro de FirmaVB es ilimitado.`, plan: u.plan, uso: u }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    // Detección de código de licitación en la pregunta
    const m = (pregunta + " " + (codigo ?? "")).match(/\b\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2}\b/i);
    if (m) codigo = m[0].toUpperCase();
    if (modo === "informe" && !codigo) {
      return new Response(JSON.stringify({ error: "falta_codigo", mensaje: "Indica el ID de la licitación (ej. 2699-35-LE26)." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Recolección en paralelo
    const kws = palabrasClave(modo === "chat" ? pregunta : "");
    const kd = palabrasDatos(modo === "chat" ? pregunta : "");
    const qOr = (kd.length ? kd : kws.slice(0, 3)).join(" or ");
    const qDatos = kd.length > 1 ? kd.slice(0, 2).join(" ") + (kd[2] ? " or " + kd[2] : "") : (kd[0] ?? "");
    const tareas: Record<string, Promise<any>> = {};
    if (codigo) tareas.ficha = sb.rpc("experto_ficha_licitacion", { p_codigo: codigo }).then((r) => r.data);
    if (codigo) tareas.bases = sb.rpc("experto_bases_texto", { p_codigo: codigo }).then((r) => r.data ?? []);
    if (modo === "chat") {
      if (kws.length) {
        tareas.normOr = sb.rpc("experto_buscar_or", { consulta: qOr, cantidad: 8 }).then((r) => r.data ?? []);
        tareas.normAnd = sb.rpc("experto_buscar_texto", { consulta: (kd.length ? kd : kws).slice(0, 3).join(" "), cantidad: 4 }).then((r) => r.data ?? []);
      }
      const p = pregunta.toLowerCase();
      if (/licitaci|compra|oportunidad|abiert|postular|hay .* (de|para)/.test(p) && qDatos) {
        tareas.lic = sb.rpc("experto_licitaciones", { texto: qDatos, dias: 60, solo_abiertas: true, p_region: null, cantidad: 8 }).then((r) => r.data ?? []);
        tareas.ca = sb.rpc("experto_compras_agiles", { texto: qDatos, dias: 30, solo_abiertas: true, p_region: null, cantidad: 6 }).then((r) => r.data ?? []);
      }
      if (/competencia|qui[eé]n (le )?vende|precio|proveedor/.test(p) && qDatos) {
        tareas.comp = sb.rpc("experto_competencia", { texto: qDatos, meses: 12, cantidad: 8 }).then((r) => r.data ?? []);
      }
      if (/cu[aá]nt[ao]s|panorama|mercado|demanda/.test(p) && qDatos) {
        tareas.pan = sb.rpc("experto_panorama", { texto: qDatos, dias: 90 }).then((r) => r.data?.[0]);
      }
      if (/adjudic|qui[eé]n (se )?gan|ganador|ganan|competidor|compet[ií]|precio/.test(p) && qDatos) {
        tareas.adj = sb.rpc("experto_adjudicaciones", { texto: qDatos, p_rut: null, meses: 12, cantidad: 8 }).then((r) => r.data ?? []);
      }
      // Organismo: "municipalidad de X" o, si viene desordenado ("puerto montt la municipalidad"),
      // se busca por las palabras de contenido (sin las de pago/riesgo) vía experto_buscar_organismo.
      const org = pregunta.match(/((?:i\.?\s*)?municipalidad|hospital|ministerio|servicio de salud|servicio local|universidad|gobierno regional|subsecretar[ií]a|direcci[oó]n|instituto|carabineros|ej[eé]rcito|armada|junaeb|junji|sename|cenabast|serviu|corfo|sence|fonasa)\s+(?:de\s+)?([a-záéíóúñ\s]{3,40})/i);
      const tipoOrg = /municipalidad|hospital|ministerio|servicio de|universidad|gobierno regional|subsecretar|direcci[oó]n de|instituto|carabineros|ej[eé]rcito|armada|junaeb|junji|sename|cenabast|serviu|corfo|sence|fonasa/i.test(pregunta);
      const hablaDePago = /paga[nr]?\b|pago|reclamo|riesgo|conducta/i.test(pregunta);
      if (org || tipoOrg || hablaDePago) {
        const palabras = palabrasClave(pregunta).filter((w) => !GENERICAS.has(w) && !/^(pag\w*|reclam\w*|riesg\w*|conduct\w*|demor\w*|atras\w*|cumpl\w*|deud\w*|vender\w*|organismo)$/.test(w)).slice(0, 5);
        // Sin "municipalidad de X" explícito se exige un tipo de organismo o al menos dos palabras (evita buscar "garantía" como organismo).
        const texto = org ? org[0].replace(/[?¿.,]/g, "").trim().slice(0, 60) : (tipoOrg || palabras.length >= 2) ? palabras.join(" ") : "";
        if (texto) tareas.org = sb.rpc("experto_buscar_organismo", { p_texto: texto }).then(async (r) => r.data ? (await sb.rpc("experto_organismo", { nombre_o_rut: r.data })).data?.[0] : null);
      }
    } else {
      // Informe: fuentes por temas fijos + el organismo
      const temas = ["inadmisibilidad oferta requisitos bases", "garantia seriedad oferta", "criterios evaluacion puntaje precio experiencia", "foro inverso subsanacion errores formales", "pago oportuno proveedores 30 dias", "inhabilidades articulo 4 ley 19886"];
      temas.forEach((t, i) => tareas["tema" + i] = sb.rpc("experto_buscar_texto", { consulta: t, cantidad: 3 }).then((r) => r.data ?? []));
    }
    // Perfil del usuario (qué vende, rubro, región) y memoria (lo que pidió mejorar antes): personalizan la respuesta.
    if (userId) tareas.perfil = sb.from("clientes").select("empresa_nombre, categoria_negocio, industrias, palabras_clave_busqueda, region").eq("user_id", userId).maybeSingle().then((r) => r.data);
    tareas.memoria = sb.rpc("experto_memoria", { p_user_id: userId, p_huella: huella || "anon" }).then((r) => r.data ?? []);
    const res: Record<string, any> = {};
    const tiempos: Record<string, number> = {};
    await Promise.all(Object.entries(tareas).map(async ([k, p]) => { const ti = Date.now(); try { res[k] = await p; } catch { res[k] = null; } tiempos[k] = Date.now() - ti; }));

    // Adjudicaciones: quién le gana al organismo (chat e informe) y licitaciones parecidas ya adjudicadas (informe)
    const rutOrg = res.org?.rut ?? res.ficha?.organismo?.rut ?? null;
    if (rutOrg) { try { res.topadj = (await sb.rpc("experto_top_adjudicatarios", { p_rut: rutOrg, meses: 12, cantidad: 6 })).data ?? []; } catch { res.topadj = []; } }
    if (modo === "informe" && res.ficha?.nombre) { try { res.adj = (await sb.rpc("experto_adjudicaciones", { texto: String(res.ficha.nombre).slice(0, 120), p_rut: null, meses: 12, cantidad: 6 })).data ?? []; } catch { res.adj = []; } }

    // Ensamblar contexto
    let fragmentos: any[] = [];
    if (modo === "chat") {
      const vistos = new Set<number>();
      for (const f of [...(res.normAnd ?? []), ...(res.normOr ?? [])]) if (!vistos.has(f.id)) { vistos.add(f.id); fragmentos.push(f); }
      fragmentos = fragmentos.slice(0, 8);
    } else {
      const vistos = new Set<number>();
      for (let i = 0; i < 6; i++) for (const f of (res["tema" + i] ?? [])) if (!vistos.has(f.id)) { vistos.add(f.id); fragmentos.push(f); }
      if (res.ficha?.institucion) {
        const { data } = await sb.rpc("experto_buscar_texto", { consulta: String(res.ficha.institucion).replace(/[^a-záéíóúñ ]/gi, " ").split(/\s+/).filter((w: string) => w.length > 3).slice(0, 3).join(" "), cantidad: 3 });
        for (const f of (data ?? [])) if (!vistos.has(f.id)) { vistos.add(f.id); fragmentos.push(f); }
      }
    }
    const tBusq = Date.now() - t0;
    const partes: string[] = [];
    if (fragmentos.length) partes.push("FUENTES:\n" + textoFragmentos(fragmentos));
    if (res.ficha) partes.push("FICHA DE LICITACIÓN (Datos Mercado Público vía FirmaVB):\n" + textoFicha(res.ficha));
    else if (codigo) partes.push(`No encontré la licitación ${codigo} en la base (puede ser antigua o el código estar mal).`);
    const bases: any[] = Array.isArray(res.bases) ? res.bases : [];
    let pedirBases: string | null = null;
    if (codigo && bases.length) partes.push(textoBases(bases, modo === "chat" ? pregunta : "criterios evaluacion ponderacion garantia plazo multa admisibilidad anexos pago", modo === "chat" ? 14000 : 24000, fragmentos.length, codigo));
    else if (codigo && (modo === "informe" || /ponder|criterio|evalua|puntaj|garant|cl[aá]usul|multa|anexo|requisit|admisib|plazo de entrega|forma de pago|bases|pliego|t[eé]cnic/i.test(pregunta))) {
      pedirBases = codigo;
      partes.push(`NO HAY BASES CARGADAS para ${codigo}. Si la respuesta requiere las bases (criterios, ponderación, garantías, multas, cláusulas, anexos), dile al usuario que las suba con el botón "Subir bases (PDF)" que aparece bajo esta respuesta: las leerás al instante y quedarán disponibles para todos.`);
    }
    if (res.perfil) partes.push(`PERFIL DEL USUARIO (personaliza con esto, sin repetirlo): empresa ${res.perfil.empresa_nombre ?? "s/i"}; rubro ${res.perfil.categoria_negocio ?? "s/i"}; industrias ${(res.perfil.industrias ?? []).join(", ") || "s/i"}; vende/busca: ${(res.perfil.palabras_clave_busqueda ?? []).slice(0, 12).join(", ") || "s/i"}; región ${res.perfil.region ?? "s/i"}.`);
    if (res.memoria?.length) partes.push("LO QUE ESTE USUARIO PIDIÓ MEJORAR EN RESPUESTAS ANTERIORES (tenlo en cuenta):\n" + res.memoria.map((m: any) => `- ${m.util === false ? "No le sirvió" : "Comentó"} en "${String(m.pregunta ?? "").slice(0, 80)}": ${m.comentario}`).join("\n"));
    if (tareas.lic && !res.lic?.length) partes.push(`BÚSQUEDA DE LICITACIONES ABIERTAS para "${qDatos}": sin resultados en títulos, descripciones ni ítems de los últimos 60 días (Datos Mercado Público vía FirmaVB). Dilo así (no digas que no tienes fuente) y sugiere otras palabras o el rubro.`);
    if (res.lic?.length) partes.push("LICITACIONES ABIERTAS (Datos Mercado Público vía FirmaVB):\n" + res.lic.map((l: any) => `${l.codigo} | ${l.nombre} | ${l.institucion} | ${l.region ?? ""} | ${fmt(l.presupuesto)} | cierra ${fecha(l.cierra)} | ${l.url}`).join("\n"));
    if (res.ca?.length) partes.push("COMPRAS ÁGILES ABIERTAS:\n" + res.ca.map((l: any) => `${l.codigo} | ${l.nombre} | ${l.organismo} | ${fmt(l.monto)} | cierra ${fecha(l.cierra)} | pago: ${l.conducta_pago ?? "s/i"} ${l.pago_dias ? l.pago_dias + " días" : ""} | ${l.url ?? ""}`).join("\n"));
    if (res.comp?.length) partes.push(`COMPETENCIA para "${qDatos}" (proveedores que le vendieron exactamente ese producto al Estado en los últimos 12 meses, según los ítems de sus órdenes de compra; son datos confirmados, úsalos con confianza):\n` + res.comp.map((c: any) => `${c.proveedor} (${c.rut ?? ""}): ${c.ordenes} OC, ${fmt(c.monto)}, precio unitario mediano ${fmt(c.precio_unit_mediano)}, ${c.compradores} compradores`).join("\n"));
    if (res.pan) partes.push("PANORAMA (90 días): " + JSON.stringify(res.pan));
    if (res.adj?.length) partes.push("LICITACIONES PARECIDAS YA ADJUDICADAS (API OCDS de Mercado Público, 12 meses; quién ganó y con cuánto):\n" + res.adj.map((a: any) => `${a.codigo} | ${a.titulo} | ${a.comprador} | adjudicada ${fecha(a.fecha_adjudicacion)} a ${a.adjudicatario ?? "s/i"} por ${fmt(a.monto_adjudicado)} (presupuesto ${fmt(a.monto_estimado)}) | ${a.num_oferentes ?? "s/i"} oferentes: ${a.oferentes ?? "s/i"}`).join("\n"));
    if (res.topadj?.length) partes.push("QUIÉN LE GANA A ESTE ORGANISMO (API OCDS, 12 meses):\n" + res.topadj.map((t: any) => `${t.adjudicatario} (${t.rut ?? "s/i"}): ${t.licitaciones} licitaciones ganadas por ${fmt(t.monto)}, participó en ${t.participaciones}`).join("\n"));
    if (res.org) partes.push("FICHA ORGANISMO (Datos Mercado Público vía FirmaVB):\n" + textoOrganismo(res.org));
    const contexto = partes.join("\n\n") || "(sin fuentes ni datos para esta pregunta)";

    const userMsg = modo === "chat" ? `${contexto}\n\nPREGUNTA: ${pregunta}` : `${contexto}\n\nGenera el informe de trabajo para la licitación ${codigo}.${pregunta ? " Contexto del proveedor: " + pregunta : ""}`;
    const messages = [
      { role: "system", content: modo === "chat" ? SYS_CHAT : SYS_INFORME },
      ...historial.filter((h) => h && (h.role === "user" || h.role === "assistant") && h.content).map((h) => ({ role: h.role, content: String(h.content).slice(0, 2000) })),
      { role: "user", content: userMsg },
    ];

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return new Response(JSON.stringify({ error: "sin_ia" }), { status: 500, headers: cors });

    // Llamada a Gemini con streaming; probamos modelos en orden
    let upstream: Response | null = null; let modelo = "";
    for (const mdl of (modo === "chat" ? MODELOS_CHAT : MODELOS_INFORME)) {
      const r = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: mdl, messages, temperature: 0.3, max_tokens: modo === "chat" ? 1200 : 3000, stream: true, reasoning_effort: "low" }),
      });
      if (r.ok && r.body) { upstream = r; modelo = mdl; break; }
      console.error("gemini", mdl, r.status, (await r.text()).slice(0, 200));
    }
    if (!upstream) return new Response(JSON.stringify({ error: "ia_no_disponible" }), { status: 502, headers: cors });

    const fuentesMeta = [
      ...fragmentos.map((f, i) => ({ n: i + 1, fuente: f.fuente, seccion: f.seccion, url: f.url })),
      ...bases.map((b, i) => ({ n: fragmentos.length + i + 1, fuente: `Bases de la licitación ${codigo}: ${b.archivo}`, seccion: `${b.paginas ?? "?"} páginas, PDF subido por un usuario de FirmaVB el ${fecha(b.creado_en)}`, url: null })),
    ];
    const enc = new TextEncoder(); const dec = new TextDecoder();
    let respuesta = "";
    const stream = new ReadableStream({
      async start(ctrl) {
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ meta: { modelo, fuentes: fuentesMeta, codigo, pedir_bases: pedirBases, bases: bases.map((b) => ({ archivo: b.archivo, paginas: b.paginas })), uso: u, ms_busqueda: tBusq, ms_ia_inicio: Date.now() - t0, tiempos, kws, kd } })}\n\n`));
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
                const fr = j.choices?.[0]?.finish_reason; if (fr) ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ finish: fr })}\n\n`));
              } catch { /* ignorar */ }
            }
          }
        } catch (e) { ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`)); }
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ done: true, ms: Date.now() - t0 })}\n\n`));
        ctrl.close();
        try { await sb.rpc("experto_registrar_uso", { p_user_id: userId, p_huella: huella || "anon", p_modo: modo, p_pregunta: pregunta || `informe ${codigo}`, p_respuesta: respuesta, p_fuentes: fuentesMeta, p_licitacion: codigo, p_ms: Date.now() - t0, p_ip: ip }); } catch { /* no bloquear */ }
      },
    });
    return new Response(stream, { headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
