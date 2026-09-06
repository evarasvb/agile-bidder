// Experto FirmaVB — MODO BAJO EL AGUA. Con solo el ID de una licitación, mira lo que no se ve en la ficha:
// a quién le compra siempre el organismo y por qué vía (convenio marco, licitación, compra ágil, trato directo),
// compras ágiles y convenio marco del mismo producto, desiertas y revocadas, quién lleva el proceso y cuántas
// veces se repite, reclamos, precio real del producto en el Estado, noticias, normativa y dictámenes, bases y
// matriz de adjudicación, y si ya está adjudicada, por dónde se renueva. Gancho comercial: 1 informe gratis,
// después cuota por plan (tabla experto_bajo_agua_cuotas). Misma salida SSE que experto-estudio.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODELOS = [Deno.env.get("GEMINI_MODEL_INFORME"), "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite"].filter(Boolean) as string[];
const MP = "https://api.mercadopublico.cl/servicios/v1/publico";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fmt = (n: any) => n == null || n === "" ? "s/i" : "$" + Math.round(Number(n)).toLocaleString("es-CL");
const fecha = (d: any) => d ? new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "s/i";
const pct = (a: any, b: any) => a != null && b ? Math.round(Number(a) / Number(b) * 100) + "%" : "s/i";
const si = (x: any) => x == null || x === "" ? "s/i" : String(x);
function rolYSub(auth: string): { role: string; sub: string | null } {
  try { const p = JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return { role: p.role ?? "", sub: p.sub ?? null }; }
  catch { return { role: "", sub: null }; }
}
function ipCliente(req: Request): string | null {
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = xff.length ? xff[xff.length - 1] : (req.headers.get("x-real-ip") ?? "").trim();
  return ip ? ip.slice(0, 64) : null;
}
function resumenPlano(r: any): string {
  const v = (x: any): string => x == null || x === "" ? "no indicado" : Array.isArray(x) ? (x.length ? x.map(v).join("; ") : "ninguno indicado") : typeof x === "object" ? Object.entries(x).map(([k, y]) => `${k.replace(/_/g, " ")}: ${v(y)}`).join(", ") : String(x);
  return Object.entries(r).map(([k, y]) => `- ${k.replace(/_/g, " ")}: ${v(y)}`).join("\n");
}
// Noticias reales de Google News (RSS público, sin clave). Devuelve título, medio, fecha y link.
async function noticiasRss(q: string, max = 5): Promise<{ titulo: string; link: string; fecha: string; medio: string }[]> {
  try {
    const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es-419&gl=CL&ceid=CL:es-419`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return [];
    const xml = await r.text();
    const limpiar = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, max).map((m) => {
      const it = m[1];
      const g = (tag: string) => limpiar((it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)) ?? [])[1] ?? "");
      return { titulo: g("title"), link: g("link"), fecha: g("pubDate"), medio: g("source") };
    }).filter((n) => n.titulo);
  } catch { return []; }
}

// ---- Ley del Lobby (leylobby.gob.cl). No hay API pública vigente: se leen las páginas HTML públicas de audiencias.
const LOBBY = "https://www.leylobby.gob.cl";
const strip = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
async function getHtml(url: string, ms = 8000): Promise<string> {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { "User-Agent": "Mozilla/5.0 (compatible; FirmaVB-Experto/1.0)" } }); return r.ok ? await r.text() : ""; } catch { return ""; }
}
// Caché de fuentes externas (tabla experto_fuentes_cache): evita repetir descargas lentas.
async function cache<T>(sb: any, clave: string, dias: number, calc: () => Promise<T>): Promise<T> {
  try {
    const { data } = await sb.from("experto_fuentes_cache").select("datos, actualizado_en").eq("clave", clave).maybeSingle();
    if (data && Date.now() - new Date(data.actualizado_en).getTime() < dias * 86400000) return data.datos as T;
  } catch { /* sin caché */ }
  const v = await calc();
  try { await sb.from("experto_fuentes_cache").upsert({ clave, datos: v, actualizado_en: new Date().toISOString() }); } catch { /* no bloquear */ }
  return v;
}
async function lobbyInstitucion(nombre: string): Promise<{ id: string; nombre: string } | null> {
  const objetivo = normalizar(nombre);
  const base = objetivo.replace(/\b(i|ilustre|municipalidad|de|la|el|del|los|las|y|servicio|direccion|regional)\b/g, " ").replace(/\s+/g, " ").trim();
  const palabras = base.split(" ").filter(Boolean);
  const intentos = [base, palabras.slice(-2).join(" "), palabras.slice(0, 3).join(" "), palabras.slice(-1).join(" ")].filter((x, i, a) => x && a.indexOf(x) === i);
  const esMuni = /municipalidad/i.test(nombre);
  for (const q of intentos) {
    const html = await getHtml(`${LOBBY}/instituciones?search=${encodeURIComponent(q)}`);
    const filas = [...html.matchAll(/<tr>\s*<td>([^<]*)<\/td>\s*<td><a href="[^"]*\/instituciones\/([A-Z]{2}\d{3})"/g)].map((m) => ({ nombre: strip(m[1]), id: m[2] }));
    if (!filas.length) continue;
    const puntuar = (f: { nombre: string; id: string }) => {
      const a = new Set(normalizar(f.nombre).split(" ")); let p = 0;
      for (const w of objetivo.split(" ")) if (w.length > 2 && a.has(w)) p++;
      if (esMuni && f.id.startsWith("MU")) p += 2;
      if (/corporaci|fundaci/i.test(f.nombre) && !/corporaci|fundaci/i.test(nombre)) p -= 3;
      return p;
    };
    filas.sort((x, y) => puntuar(y) - puntuar(x));
    if (puntuar(filas[0]) > 0) return filas[0];
  }
  return null;
}
type Audiencia = { fecha: string; id: string; sujeto: string; cargo: string; asistentes: string; representados: string; materia: string; url: string };
async function lobbyAudiencias(inst: string, anios: number[], maxCargos = 8): Promise<{ cargos: { anio: number; nombre: string; cargo: string }[]; audiencias: Audiencia[] }> {
  const paginas = await Promise.all(anios.map((a) => getHtml(`${LOBBY}/instituciones/${inst}/audiencias/${a}`).then((h) => ({ a, h }))));
  const cargos: { anio: number; nombre: string; cargo: string; url: string }[] = [];
  for (const { a, h } of paginas) for (const m of h.matchAll(/<tr>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td><a href="([^"]*\/audiencias\/\d{4}\/\d+)"/g)) cargos.push({ anio: a, nombre: strip(m[1]), cargo: strip(m[2]), url: m[3] });
  // Primero quienes deciden compras; hasta maxCargos por año para no demorar el informe.
  const prio = (c: string) => /adquisic|abastec|compra|alcald|administrador|director|jefe|secretari|gerente|subsecret|ministr|delegad|rector|decano|superintend|presidente/i.test(c) ? 0 : 1;
  const elegidos = anios.flatMap((a) => cargos.filter((d) => d.anio === a).sort((x, y) => prio(x.cargo) - prio(y.cargo)).slice(0, maxCargos));
  const htmls = await Promise.all(elegidos.map((d) => getHtml(d.url).then((h) => ({ d, h }))));
  const audiencias: Audiencia[] = [];
  for (const { d, h } of htmls) {
    // Cada audiencia ocupa una o más filas: la primera trae fecha e identificador (rowspan); las siguientes, un asistente más.
    const filas = [...h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => strip(c[1])));
    let actual: Audiencia | null = null;
    for (const f of filas) {
      if (f.length >= 6 && /^\d{4}-\d{2}-\d{2}/.test(f[0])) { actual = { fecha: f[0].slice(0, 10), id: f[1], sujeto: d.nombre, cargo: d.cargo, asistentes: `${f[2]}: ${f[3]}`, representados: f[4], materia: f[5], url: d.url }; audiencias.push(actual); }
      else if (actual && f.length >= 2 && f.length <= 3 && f[1]) { actual.asistentes += ` | ${f[0]}: ${f[1]}`; if (f[2]) actual.representados += (actual.representados ? "; " : "") + f[2]; }
    }
  }
  return { cargos: cargos.map(({ anio, nombre, cargo }) => ({ anio, nombre, cargo })), audiencias };
}
// ---- Consultas al Mercado (RFI) de Mercado Público: API pública del portal consulta-mercado con token anónimo.
const CM_API = "https://servicios-consultas-prd.mercadopublico.cl";
const CM_FICHA = "https://consulta-mercado.mercadopublico.cl/detalle-consulta-mercado/";
async function cmToken(): Promise<string | null> {
  try { const r = await fetch("https://servicios-prd.mercadopublico.cl/v1/auth/publico", { signal: AbortSignal.timeout(6000) }); const j = await r.json(); return j?.payload?.access_token ?? null; } catch { return null; }
}
async function cmGet(path: string, tok: string): Promise<any> {
  try { const r = await fetch(CM_API + path, { headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" }, signal: AbortSignal.timeout(9000) }); const j = await r.json(); return j?.payload ?? null; } catch { return null; }
}
// Lista de consultas. La API exige fechas AAAA-MM-DD HH:MM:SS, pagina de 15 y ordena de la más antigua a la más nueva:
// se lee la primera página para saber cuántas hay y luego las últimas (las más recientes).
async function cmListar(tok: string, filtro: Record<string, string>, meses = 30, maxPaginas = 2): Promise<any[]> {
  const d = new Date(); d.setMonth(d.getMonth() - meses);
  const f = (x: Date) => x.toISOString().slice(0, 10);
  const q = (pagina: number) => new URLSearchParams({ desde: `${f(d)} 00:00:00`, hasta: `${f(new Date())} 23:59:59`, estado: "", ordenarPor: "", pagina: String(pagina), ...filtro }).toString();
  const p1 = await cmGet(`/v1/consulta-mercado?${q(1)}`, tok);
  const lista = (p: any) => Array.isArray(p) ? p : (p?.resultados ?? p?.content ?? p?.items ?? []);
  const total = Number(p1?.pageCount ?? 1);
  if (total <= 1) return lista(p1);
  const paginas = Array.from({ length: Math.min(maxPaginas, total) }, (_, i) => total - i);
  const resto = await Promise.all(paginas.map((n) => cmGet(`/v1/consulta-mercado?${q(n)}`, tok)));
  return [...resto.flatMap(lista), ...lista(p1)].reverse();
}
const cmResumen = (c: any) => ({ codigo: c.codigoConsulta ?? c.codigo ?? c.id, nombre: c.nombre ?? c.titulo, organismo: c.nombreInstitucion ?? c.organismo ?? c.nombreOrganismo, rut: c.rutOrganismo, publicada: c.fechaPublicacion, cierre: c.fechaCierre, estado: c.estado ?? c.nombreEstado, motivo: c.motivo, encargado: c.nombreUsuario, descripcion: String(c.descripcion ?? "").slice(0, 400), preguntas: Array.isArray(c.preguntas) ? c.preguntas.length : c.cantidadPreguntas, adjuntos: Array.isArray(c.adjuntos) ? c.adjuntos.map((a: any) => a.nombre).slice(0, 6) : undefined, reuniones: Array.isArray(c.reuniones) ? c.reuniones.length : undefined, url: CM_FICHA + (c.codigoConsulta ?? c.codigo ?? "") });

const SYS = `Eres el Experto FirmaVB en MODO BAJO EL AGUA: 17 años vendiéndole al Estado chileno. Un proveedor pyme te da el ID de una licitación y tú le muestras lo que NO se ve en la ficha. Usa SOLO los datos y fuentes entregados. Hablas como Evaristo Varas en su libro "Véndele al Estado y No Mueras en el Intento": de tú, directo, sin adornos, frases cortas, ejemplos de la calle, un empujón honesto cuando toca. Entra al grano en la primera línea. Siempre con cifras y con cita [n] tras cada afirmación que salga de una fuente numerada; para los datos de la base escribe (FirmaVB) al final de la frase. Si un dato no está, di "no consta en la base" y cómo verificarlo con el enlace que corresponda. NUNCA inventes procesos, montos, personas, reuniones de lobby, dictámenes ni noticias. Formato Markdown con estas secciones exactas:

## 0. En una mirada
Tres líneas: qué compra, quién, cuánto, cuándo cierra o cuándo se adjudicó, y la conclusión en una frase (postular, no postular, o preparar la renovación).
## 1. Lo que está debajo
Lista de 5 a 8 hallazgos, uno por línea, cada uno con el dato y la fuente: si la compra se repite y cada cuánto; si hay un proveedor de siempre y su cuota; si el organismo compra el mismo producto por convenio marco, compra ágil o trato directo y a qué precio; si hubo desiertas o revocadas y por qué; si el encargado se repite; reclamos; noticias.
## 2. Quién le vende siempre a este organismo
Tabla Markdown: Proveedor | OC en el rubro (36 meses) | Monto | Precio unitario mediano | Última compra | Vía (convenio marco, licitación, compra ágil, trato directo). Luego la cuota del dominante y qué significa para ti. Si no hay OC en el rubro, dilo.
## 3. Compras ágiles y convenio marco del mismo producto
Qué compró el organismo por compra ágil (cantidad, monto, ofertas recibidas) y por convenio marco; el precio que aceptó sin licitar (techo) y el precio de convenio marco (piso). Si licita habiendo convenio marco disponible, plantea por qué.
## 4. Antes de licitar: consultas al mercado (RFI), desiertas, revocadas y reclamos
Consultas al mercado (RFI, código terminado en -RFI) del organismo o del mismo producto (de las CONSULTAS AL MERCADO): quién consultó, cuándo, qué pidió, cuántas preguntas y reuniones hubo, y si esta licitación nació de una de ellas (mismo organismo, mismo objeto, fechas previas). Quien participó en la RFI conoce las bases antes que tú: dilo. Luego procesos del organismo que quedaron desiertos, revocados o suspendidos (mismo rubro primero) y la oportunidad que abre cada uno. Reclamos contra el organismo por tipo y sobre este proceso.
## 5. Las personas y el lobby (Ley 20.730)
Quién lleva la licitación (nombre y cargo, dato público de la ficha), responsable del contrato y del pago, cuántos procesos ha llevado la misma persona en este organismo y cuántos del mismo rubro. Audiencias de lobby registradas del organismo (de las AUDIENCIAS DE LOBBY): tabla Fecha | Autoridad y cargo | Con quién (asistentes y a quién representan) | Materia, primero las relacionadas con el rubro, con el proveedor de siempre o con compras; luego el total de audiencias por año y cuáles autoridades reciben más. Si no se encontró el organismo en la plataforma o no tiene audiencias, dilo y entrega el enlace. Solo hechos de registros públicos, nada de juicios sobre las personas.
## 6. El precio que gana
Tabla Markdown con el precio unitario del producto en el Estado (24 meses): Mínimo | P25 | Mediana | P75 | Máximo | Compradores. Luego el precio por vía (convenio marco vs licitación vs compra ágil) y el historial adjudicado/presupuesto del organismo. Tres escenarios en tabla: Escenario | % del tope | Neto | Con IVA (×1,19) | Puntaje precio simulado | Riesgo. Filas: conservador 98%, recomendado 95%, agresivo 90%, más el piso de referencia. El tope es el presupuesto; si no está, usa el tramo del código (L1 hasta 100 UTM, LE 100 a 1.000, LP 1.000 a 2.000, LQ 2.000 a 5.000, LR más de 5.000) con la UTM de hoy y dilo. Fórmula de precio en texto (precio mínimo / precio ofertado × 100) salvo que las bases fijen otra.
## 7. Bases y matriz de adjudicación
Si hay BASES: criterios y ponderación reales con su sección, admisibilidad, garantías, plazos, multas; luego la MATRIZ: tabla Criterio | Ponderación | Cómo se puntúa | Puntaje máximo | Tu puntaje estimado (supuesto) | Puntaje estimado del proveedor dominante | Brecha. Cierra con la simulación: a qué precio le ganas al dominante en cada escenario y el punto donde bajar más ya no cambia el resultado. Si NO hay bases: dilo, arma la matriz con lo que la ficha permite y pide subirlas con el botón "Subir bases (PDF)". Ofrece completar los anexos.
## 8. Errores y palancas
Errores o ambigüedades de las bases (contradicciones, fechas, criterios sin fórmula, marcas, exigencias desproporcionadas), qué preguntar en el foro, y qué dictámenes o sentencias de las FUENTES sirven de argumento. Si no hay bases ni fuentes aplicables, dilo en una línea.
## 9. Si ya está adjudicada: por dónde se renueva
Solo si el estado es adjudicada, cerrada o con orden de compra. Quién ganó y con cuánto, duración del contrato, si es renovable y por cuánto, la ventana de acción (3 a 6 meses antes del término), qué compró el organismo fuera del contrato después (compras ágiles o trato directo = demanda no cubierta), y el plan: fecha objetivo, contacto por cargo, oferta diferencial, precio de entrada. Si no aplica, escribe "No aplica: la licitación sigue abierta." y nada más.
## 10. Noticias, resoluciones y dictámenes
Noticias reales de las FUENTES (título, medio, fecha, link) que afecten al organismo o al producto; resoluciones modificatorias de las bases si constan; dictámenes y normativa de las FUENTES aplicables. Lo que no consta, con su enlace de verificación (dictámenes, transparencia, prensa).
## 11. Recomendación y próximos 3 pasos
Postular o no, con qué línea, a qué precio, qué diferenciar, y los 3 pasos concretos que darías hoy con fecha.
## 12. Pendientes que debe validar la empresa
Lista numerada con [VALIDAR]: precio final, líneas, certificaciones y experiencia acreditable, datos de la empresa, firmas y declaraciones juradas, verificación de lobby y dictámenes.
## Fuentes
Lista numerada de lo citado (fuentes numeradas, bases, noticias) y al final los enlaces de verificación.

Reglas: máximo 2.800 palabras; montos con separador de miles; nada de LaTeX, "null" ni "JSON"; si el historial es corto, dilo (la base OCDS parte en julio de 2026 y crece a diario; las órdenes de compra cubren desde 2019).`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const t0 = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const { role, sub } = rolYSub(req.headers.get("Authorization") ?? "");
    const userId = role === "authenticated" ? sub : role === "service_role" ? (body.user_id ?? null) : null;
    if (!userId) return json({ error: "login", mensaje: "Inicia sesión en FirmaVB para mirar bajo el agua." }, 401);
    const codigo = String(body.codigo ?? "").trim().toUpperCase();
    if (!/^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2,3}$/.test(codigo)) return json({ error: "falta_codigo", mensaje: "Indica el ID de la licitación (ej. 2699-35-LE26)." }, 400);
    const contextoProv = String(body.pregunta ?? "").trim().slice(0, 500);
    const huella = String(body.huella ?? "").slice(0, 80);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Cuota: 1 gratis de por vida como gancho; después según plan (tabla experto_bajo_agua_cuotas).
    const { data: cuotaRows } = await sb.rpc("experto_bajo_agua_cuota", { p_user_id: userId });
    const cuota = cuotaRows?.[0] ?? { plan: "free", usados: 0, maximo: 1, periodo: "total" };
    if (cuota.maximo != null && Number(cuota.usados) >= Number(cuota.maximo)) {
      const mensaje = cuota.plan === "free"
        ? "Ya usaste tu informe Bajo el Agua gratis. Con Experto Pro tienes 10 al mes y con Experto Plus 30; el ERP no tiene límite."
        : `Llegaste al tope de ${cuota.maximo} informes Bajo el Agua de tu plan ${cuota.periodo === "mes" ? "este mes" : ""}. Sube de plan o espera al próximo mes.`;
      return json({ error: cuota.plan === "free" ? "pro" : "cuota", mensaje, cuota }, 402);
    }

    const ficha = (await sb.rpc("experto_ficha_licitacion", { p_codigo: codigo })).data;
    if (!ficha) return json({ error: "sin_ficha", mensaje: `No encontré la licitación ${codigo} en la base. Si es nueva, vuelve a intentar en unos minutos.` }, 404);
    const rut: string | null = ficha.organismo?.rut ?? ficha.rut_institucion ?? null;
    const nombre = String(ficha.nombre ?? "");
    const institucion = String(ficha.institucion ?? "");
    const adjudicada = /adjudic|cerrad|orden/i.test(String(ficha.estado ?? ""));
    const ticket = Deno.env.get("MERCADOPUBLICO_API_KEY");

    const t: Record<string, Promise<any>> = {
      datos: sb.rpc("experto_bajo_agua_datos", { p_codigo: codigo }).then((r) => r.data),
      hist: rut ? sb.rpc("experto_estudio_organismo", { p_rut: rut, p_texto: nombre, p_meses: 36, p_cantidad: 40 }).then((r) => r.data ?? []) : Promise.resolve([]),
      topadj: rut ? sb.rpc("experto_top_adjudicatarios", { p_rut: rut, meses: 24, cantidad: 8 }).then((r) => r.data ?? []) : Promise.resolve([]),
      adj: sb.rpc("experto_adjudicaciones", { texto: nombre.slice(0, 120), p_rut: null, meses: 24, cantidad: 10 }).then((r) => r.data ?? []),
      comp: sb.rpc("experto_competencia_licitacion", { p_codigo: codigo, meses: 12, cantidad: 8 }).then((r) => r.data ?? []),
      org: rut ? sb.rpc("experto_organismo", { nombre_o_rut: rut }).then((r) => r.data?.[0]) : Promise.resolve(null),
      bases: sb.rpc("experto_bases_texto", { p_codigo: codigo }).then((r) => r.data ?? []),
      docs: sb.rpc("experto_documentos_texto", { p_user_id: userId, p_codigo: codigo, p_max: 8000 }).then((r) => r.data ?? []),
      n1: sb.rpc("experto_buscar_texto", { consulta: "criterios evaluacion puntaje precio experiencia", cantidad: 3 }).then((r) => r.data ?? []),
      n2: sb.rpc("experto_buscar_texto", { consulta: "licitacion desierta readjudicacion renovacion contrato dictamen", cantidad: 3 }).then((r) => r.data ?? []),
      n3: sb.rpc("experto_buscar_texto", { consulta: nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]/g, " ").split(/\s+/).filter((w: string) => w.length > 4).slice(0, 3).join(" "), cantidad: 3 }).then((r) => r.data ?? []),
      notiDb: sb.rpc("experto_noticias", { consulta: institucion.split(/\s+/).slice(0, 4).join(" "), cantidad: 4 }).then((r) => r.data ?? []),
      ind: fetch("https://mindicador.cl/api", { signal: AbortSignal.timeout(4000) }).then((r) => r.json()).then((j: any) => ({ utm: j?.utm?.valor ?? null, dolar: j?.dolar?.valor ?? null })),
      rss1: noticiasRss(`"${institucion}"`, 5),
      // Ficha viva de la API (adjudicación, encargado, renovación) por si la base está atrasada.
      api: ticket ? fetch(`${MP}/licitaciones.json?codigo=${encodeURIComponent(codigo)}&ticket=${ticket}`, { signal: AbortSignal.timeout(6000) }).then((r) => r.ok ? r.json() : null).then((j: any) => j?.Listado?.[0] ?? null) : Promise.resolve(null),
    };
    const anioHoy = new Date().getFullYear();
    t.lobby = cache(sb, `lobby:${normalizar(institucion)}:${anioHoy}`, 7, async () => {
      const inst = await lobbyInstitucion(institucion);
      if (!inst) return { institucion: null, cargos: [], audiencias: [] };
      const a = await lobbyAudiencias(inst.id, [anioHoy, anioHoy - 1], 8);
      return { institucion: inst, ...a };
    });
    const res: Record<string, any> = {};
    await Promise.all(Object.entries(t).map(async ([k, p]) => { try { res[k] = await p; } catch { res[k] = null; } }));
    const datos = res.datos ?? {};
    const kw: string[] = datos.keywords ?? [];
    // Consultas al mercado (RFI): las del organismo y las del mismo producto en todo el Estado. Dependen de las palabras clave.
    res.rfi = await cache(sb, `rfi:${normalizar(institucion)}:${kw.slice(0, 2).join("+")}`, 3, async () => {
      const tok = await cmToken(); if (!tok) return { organismo: [], producto: [], sin_acceso: true };
      // Del organismo: por RUT si el filtro lo acepta; si no, por su palabra más distintiva y filtrando por RUT o nombre.
      const rutOrg = String(rut ?? "").replace(/\./g, "");
      const mismoOrg = (c: any) => (rutOrg && String(c.rutOrganismo ?? "").replace(/\./g, "") === rutOrg) || (normalizar(String(c.nombreInstitucion ?? "")) === normalizar(institucion));
      const palabrasOrg = normalizar(institucion).replace(/\b(i|ilustre|municipalidad|de|la|el|del|los|las|y|servicio|direccion|regional|hospital|salud|nacional)\b/g, " ").split(" ").filter((w) => w.length > 3);
      let porOrg: any[] = rut ? await cmListar(tok, { organismoComprador: String(rut) }) : [];
      if (!porOrg.length && palabrasOrg.length) porOrg = (await cmListar(tok, { palabraClave: palabrasOrg[palabrasOrg.length - 1] }, 36, 3)).filter(mismoOrg);
      const porProd: any[] = kw.length ? await cmListar(tok, { palabraClave: kw[0] }) : [];
      const vistos = new Set<string>();
      const dedup = (l: any[]) => l.map(cmResumen).filter((x) => x.codigo && !vistos.has(String(x.codigo)) && vistos.add(String(x.codigo)));
      const organismo = dedup(porOrg).slice(0, 8); const producto = dedup(porProd).slice(0, 8);
      // Detalle de las 3 más relevantes (preguntas, reuniones, adjuntos) para saber quién ya participó.
      const det = await Promise.all([...organismo.slice(0, 2), ...producto.slice(0, 1)].map((c) => cmGet(`/v1/consulta-mercado/codigo/${encodeURIComponent(String(c.codigo))}`, tok)));
      const detalles = det.filter(Boolean).map(cmResumen);
      return { organismo, producto, detalles };
    });
    res.rss2 = kw.length ? await noticiasRss(`${institucion.split(/\s+/).slice(0, 3).join(" ")} ${kw.slice(0, 2).join(" ")}`, 4) : [];

    // Fuentes numeradas: normativa/dictámenes, noticias (RSS + base), bases.
    const vistos = new Set<number>();
    const frag: any[] = [...(res.n1 ?? []), ...(res.n2 ?? []), ...(res.n3 ?? [])].filter((f) => !vistos.has(f.id) && vistos.add(f.id));
    const noticias = [...(res.rss1 ?? []), ...(res.rss2 ?? [])].filter((n, i, a) => a.findIndex((x) => x.titulo === n.titulo) === i).slice(0, 8);
    const notiDb: any[] = res.notiDb ?? [];
    const bases: any[] = res.bases ?? [];
    const partes: string[] = [];
    let n = 0;
    const fuentesMeta: { n: number; fuente: string; seccion: string | null; url: string | null }[] = [];
    if (frag.length) partes.push("FUENTES NORMATIVAS Y DICTÁMENES (base del Experto):\n" + frag.map((f) => { n++; fuentesMeta.push({ n, fuente: f.fuente, seccion: f.seccion ?? null, url: f.url ?? null }); return `[${n}] ${f.fuente}${f.seccion ? " — " + f.seccion : ""}\n${String(f.texto).slice(0, 1200)}`; }).join("\n\n"));
    if (noticias.length || notiDb.length) partes.push("NOTICIAS (Google News RSS y base del Experto; cita solo estas, no inventes otras):\n" +
      [...noticias.map((x) => { n++; fuentesMeta.push({ n, fuente: `Noticia: ${x.titulo}`, seccion: x.medio || null, url: x.link || null }); return `[${n}] ${x.titulo} — ${x.medio || "medio s/i"}, ${fecha(x.fecha)} — ${x.link}`; }),
       ...notiDb.map((x: any) => { n++; fuentesMeta.push({ n, fuente: x.fuente, seccion: x.seccion ?? null, url: x.url ?? null }); return `[${n}] ${x.fuente}${x.seccion ? " — " + x.seccion : ""} (${fecha(x.fecha)})\n${String(x.texto).slice(0, 600)}`; })].join("\n"));

    const o = ficha.organismo ?? {};
    const api = res.api;
    partes.push(`FICHA DE LA LICITACIÓN ${codigo} (Datos Mercado Público vía FirmaVB):\n${nombre}\nOrganismo: ${institucion} (RUT ${rut ?? "s/i"}) — ${ficha.comuna ?? ""}, ${ficha.region ?? ""}\nEstado: ${api?.Estado ?? ficha.estado} | Tipo: ${ficha.tipo ?? "s/i"} | Presupuesto: ${fmt(ficha.presupuesto)} | Modalidad: ${ficha.modalidad ?? "s/i"} | Pago: ${ficha.tipo_pago ?? "s/i"} | Contrato: ${ficha.duracion_contrato ?? "s/i"}\nPublicada ${fecha(ficha.fecha_publicacion)} | Cierre ${fecha(ficha.fecha_cierre)} | Adjudicación estimada ${fecha(ficha.fecha_adjudicacion)}\nDescripción: ${String(ficha.descripcion ?? "").slice(0, 1200)}\nÍtems: ${(ficha.items ?? []).slice(0, 20).map((i: any) => `${i.producto}${i.cantidad ? ` (${i.cantidad} ${i.unidad ?? ""})` : ""}`).join("; ") || "s/i"}\nPalabras clave usadas para buscar el producto en la base: ${kw.join(", ") || "s/i"}\nLink: ${ficha.url}`);
    if (res.ind?.utm || res.ind?.dolar) partes.push(`INDICADORES DE HOY (mindicador.cl, ${fecha(new Date())}): UTM ${fmt(res.ind.utm)} · dólar observado ${fmt(res.ind.dolar)}.`);

    const per = datos.personas ?? {};
    const con = datos.contrato ?? {};
    const comprador = api?.Comprador ?? {};
    partes.push(`PERSONAS DE LA FICHA (datos públicos de Mercado Público, FirmaVB):\nEncargado del proceso: ${si(comprador.NombreUsuario || per.encargado)} — cargo ${si(comprador.CargoUsuario || per.cargo)} — unidad ${si(comprador.NombreUnidad || per.unidad)}\nResponsable del contrato: ${si(api?.NombreResponsableContrato || per.responsable_contrato)} | Responsable del pago: ${si(api?.NombreResponsablePago || per.responsable_pago)}\nProcesos de este organismo llevados por el mismo encargado (base FirmaVB): ${si(per.procesos_mismo_encargado)}; de ellos del mismo rubro: ${si(per.mismo_encargado_mismo_rubro)}\n${(per.lista ?? []).map((x: any) => `- ${x.codigo} | ${fecha(x.fecha)} | ${x.estado} | ${x.nombre}`).join("\n") || "- sin otros procesos del mismo encargado en la base"}`);
    const adjApi = api?.Adjudicacion && typeof api.Adjudicacion === "object" ? api.Adjudicacion : con.adjudicacion;
    const adjudicados = (api?.Items?.Listado ?? []).filter((it: any) => it?.Adjudicacion && typeof it.Adjudicacion === "object").map((it: any) => ({ producto: it.NombreProducto, cantidad: it.Cantidad, proveedor: it.Adjudicacion.NombreProveedor, rut: it.Adjudicacion.RutProveedor, monto_unitario: it.Adjudicacion.MontoUnitario, cantidad_adjudicada: it.Adjudicacion.Cantidad }));
    const adjItems = adjudicados.length ? adjudicados : (con.adjudicados ?? []);
    partes.push(`CONTRATO Y ADJUDICACIÓN (ficha de la API de Mercado Público, FirmaVB):\nModalidad ${si(api?.Modalidad ?? con.modalidad)} | Pago ${si(api?.TipoPago ?? con.tipo_pago)} | Duración ${si(api?.TiempoDuracionContrato ? `${api.TiempoDuracionContrato} ${api.UnidadTiempoDuracionContrato ?? ""}` : con.duracion)} (${si(api?.TipoDuracionContrato ?? con.tipo_duracion)}) | Renovable: ${si(api?.EsRenovable ?? con.es_renovable)} por ${si(api?.ValorTiempoRenovacion ? `${api.ValorTiempoRenovacion} ${api.PeriodoTiempoRenovacion ?? ""}` : con.renovacion)} | Extensión de plazo: ${si(api?.ExtensionPlazo ?? con.extension_plazo)} | Toma de razón: ${si(api?.TomaRazon ?? con.toma_razon)} | Reclamos en ficha: ${si(api?.CantidadReclamos ?? con.reclamos_ficha)}\nAdjudicación: ${adjApi ? `${si(adjApi.Tipo)} | fecha ${fecha(adjApi.Fecha)} | resolución ${si(adjApi.Numero)} | oferentes ${si(adjApi.NumeroOferentes)} | acta ${si(adjApi.UrlActa)}` : "sin adjudicación registrada"}\n${adjItems.length ? "Ítems adjudicados:\n" + adjItems.map((x: any) => `- ${x.producto} (${si(x.cantidad)}): ${si(x.proveedor)} (${si(x.rut)}) a ${fmt(x.monto_unitario)} unitario × ${si(x.cantidad_adjudicada)}`).join("\n") : ""}`);

    const lb = res.lobby ?? {};
    const provs: string[] = [...(datos.oc_rubro?.proveedores ?? []).map((p: any) => normalizar(String(p.proveedor ?? ""))), ...(res.topadj ?? []).map((x: any) => normalizar(String(x.adjudicatario ?? "")))].filter((x) => x.length > 4);
    const relevante = (a: Audiencia) => { const txt = normalizar(`${a.materia} ${a.representados} ${a.asistentes}`); return kw.some((w) => txt.includes(w)) || /compra|licitaci|adquisic|proveedor|contrat|convenio|suministro|abastec/.test(txt) || provs.some((p) => txt.includes(p.split(" ").slice(0, 2).join(" "))); };
    if (lb.institucion) {
      const auds: Audiencia[] = lb.audiencias ?? [];
      const porAnio: Record<string, number> = {}; auds.forEach((a) => { const y = a.fecha.slice(0, 4); porAnio[y] = (porAnio[y] ?? 0) + 1; });
      const porAutoridad: Record<string, number> = {}; auds.forEach((a) => { const k = `${a.sujeto} (${a.cargo})`; porAutoridad[k] = (porAutoridad[k] ?? 0) + 1; });
      const ordenadas = [...auds].sort((x, y) => (relevante(y) ? 1 : 0) - (relevante(x) ? 1 : 0) || y.fecha.localeCompare(x.fecha)).slice(0, 14);
      partes.push(`AUDIENCIAS DE LOBBY (Ley 20.730, leylobby.gob.cl, institución "${lb.institucion.nombre}" ${lb.institucion.id}, revisadas ${(lb.cargos ?? []).length} autoridades de ${anioHoy} y ${anioHoy - 1}; ${auds.length} audiencias leídas; por año: ${Object.entries(porAnio).map(([y, n]) => `${y}: ${n}`).join(", ") || "ninguna"}):\nAutoridades con más audiencias: ${Object.entries(porAutoridad).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k} ${n}`).join("; ") || "s/i"}\n${ordenadas.map((a) => `- ${a.fecha} | ${a.sujeto} (${a.cargo}) | ${a.asistentes} | representan: ${a.representados || "s/i"} | materia: ${a.materia.slice(0, 260)} | ${relevante(a) ? "RELACIONADA con compras o el rubro" : "otra materia"} | ${a.url}`).join("\n") || "- sin audiencias registradas en esos años"}\nEnlace: ${LOBBY}/instituciones/${lb.institucion.id}/audiencias/${anioHoy}`);
    } else partes.push(`AUDIENCIAS DE LOBBY: no se encontró "${institucion}" en leylobby.gob.cl (búsqueda automática). Verificar a mano en ${LOBBY}/instituciones`);
    const rfi = res.rfi ?? {};
    const rfiTxt = (c: any) => `- ${c.codigo} | ${c.organismo ?? "s/i"} (${c.rut ?? "s/i"}) | publicada ${fecha(c.publicada)} | cierre ${fecha(c.cierre)} | estado ${si(c.estado)} | motivo ${si(c.motivo)} | encargado ${si(c.encargado)} | ${c.nombre} | ${c.descripcion ? c.descripcion.slice(0, 220) : ""}${c.preguntas != null ? ` | preguntas ${c.preguntas}` : ""}${c.reuniones != null ? ` | reuniones ${c.reuniones}` : ""}${c.adjuntos?.length ? ` | adjuntos: ${c.adjuntos.join(", ")}` : ""} | ${c.url}`;
    if (rfi.sin_acceso) partes.push("CONSULTAS AL MERCADO (RFI): el portal no respondió; verificar en https://consulta-mercado.mercadopublico.cl");
    else partes.push(`CONSULTAS AL MERCADO (RFI, portal consulta-mercado.mercadopublico.cl, últimos 30 meses):\nDel organismo (${(rfi.organismo ?? []).length}):\n${(rfi.organismo ?? []).map(rfiTxt).join("\n") || "- ninguna"}\nDel mismo producto en otros organismos (${(rfi.producto ?? []).length}):\n${(rfi.producto ?? []).map(rfiTxt).join("\n") || "- ninguna"}\n${(rfi.detalles ?? []).length ? "Detalle de las más relevantes:\n" + rfi.detalles.map(rfiTxt).join("\n") : ""}`);
    const oc = datos.oc_rubro ?? {};
    if (oc.ordenes) partes.push(`ÓRDENES DE COMPRA DEL ORGANISMO EN EL RUBRO, 36 meses (FirmaVB): ${oc.ordenes} OC por ${fmt(oc.monto)}, entre ${fecha(oc.desde)} y ${fecha(oc.hasta)}. Por vía: ${Object.entries(oc.por_origen ?? {}).map(([k, v]) => `${k} ${v}`).join(", ") || "s/i"}.\nProveedores:\n${(oc.proveedores ?? []).map((p: any) => `- ${p.proveedor} (${si(p.rut)}): ${p.ordenes} OC (${pct(p.ordenes, oc.ordenes)} del total), ${fmt(p.monto)}, precio unitario mediano ${fmt(p.precio_unit_mediano)}, última ${fecha(p.ultima)}, vía ${p.origenes}`).join("\n")}\nÚltimas líneas:\n${(oc.items ?? []).map((i: any) => `- ${i.oc} | ${fecha(i.fecha)} | ${i.proveedor} | ${i.producto} | ${si(i.cantidad)} × ${fmt(i.precio_unitario)} | ${i.origen}`).join("\n")}`);
    else partes.push("ÓRDENES DE COMPRA DEL ORGANISMO EN EL RUBRO: ninguna en la base FirmaVB en 36 meses con estas palabras clave.");
    const ca = datos.compras_agiles ?? {};
    if (ca.total) partes.push(`COMPRAS ÁGILES DEL ORGANISMO CON EL MISMO PRODUCTO, 18 meses (FirmaVB): ${ca.total} por ${fmt(ca.monto)}.\n${(ca.lista ?? []).map((x: any) => `- ${x.codigo} | ${fecha(x.fecha)} | ${fmt(x.monto)} | ${si(x.estado)} | ofertas ${si(x.ofertas)} | ${x.nombre}`).join("\n")}`);
    else partes.push("COMPRAS ÁGILES DEL ORGANISMO CON EL MISMO PRODUCTO: ninguna en la base en 18 meses.");
    const pp = datos.precio_producto ?? {};
    if (pp.items) partes.push(`PRECIO DEL PRODUCTO EN TODO EL ESTADO, 24 meses (${pp.items} líneas de OC, ${pp.compradores} compradores, FirmaVB): mínimo ${fmt(pp.minimo)} | P25 ${fmt(pp.p25)} | mediana ${fmt(pp.mediana)} | P75 ${fmt(pp.p75)} | máximo ${fmt(pp.maximo)}.\nPor vía: ${(pp.por_origen ?? []).map((x: any) => `${x.origen} ${x.items} líneas, mediana ${fmt(x.mediana)}`).join("; ")}\nQuién lo vende: ${(pp.proveedores ?? []).map((x: any) => `${x.proveedor} (${x.ordenes} OC, ${x.compradores} compradores, mediana ${fmt(x.precio_unit_mediano)})`).join("; ")}\nEjemplos: ${(pp.ejemplos ?? []).map((x: any) => `${x.producto} ${fmt(x.precio_unitario)} (${x.proveedor}, ${fecha(x.fecha)}, ${x.origen})`).join("; ")}`);
    else partes.push("PRECIO DEL PRODUCTO EN EL ESTADO: sin líneas de OC con estas palabras clave en 24 meses.");
    const de = datos.desiertas ?? {};
    if (de.total) partes.push(`DESIERTAS, REVOCADAS O SUSPENDIDAS DEL ORGANISMO (FirmaVB): ${de.total} en total, ${de.mismo_rubro} del mismo rubro.\n${(de.lista ?? []).map((x: any) => `- ${x.codigo} | ${fecha(x.fecha)} | ${x.estado} | presupuesto ${fmt(x.presupuesto)} | oferentes ${si(x.oferentes)} | ${x.mismo_rubro ? "MISMO RUBRO" : "otro rubro"} | ${x.titulo}`).join("\n")}`);
    else partes.push("DESIERTAS, REVOCADAS O SUSPENDIDAS DEL ORGANISMO: ninguna en la base.");
    const rc = datos.reclamos ?? {};
    partes.push(`RECLAMOS CONTRA EL ORGANISMO, 24 meses (Mercado Público vía FirmaVB): por tipo ${Object.entries(rc.por_tipo ?? {}).map(([k, v]) => `tipo ${k}: ${v}`).join(", ") || "ninguno"}. Sobre este proceso: ${(rc.este_proceso ?? []).length ? rc.este_proceso.map((x: any) => `${fecha(x.fecha)} ${si(x.reclamante)} (${si(x.estado)})`).join("; ") : "ninguno"}. Sobre procesos del mismo rubro: ${(rc.mismo_rubro ?? []).map((x: any) => `${x.proceso} ${fecha(x.fecha)} ${si(x.reclamante)}`).join("; ") || "ninguno"}. (Tipos de reclamo: 1 pago no oportuno, 2 irregularidad del proceso, según codificación de Mercado Público; si el tipo no calza, di "tipo s/i".)`);

    const hist: any[] = res.hist ?? [];
    if (hist.length) {
      const conAdj = hist.filter((h) => h.monto_adjudicado && h.monto_estimado);
      const prom = conAdj.length ? Math.round(conAdj.reduce((a, h) => a + Number(h.monto_adjudicado) / Number(h.monto_estimado), 0) / conAdj.length * 100) : null;
      partes.push(`HISTORIAL DE PROCESOS PARECIDOS DEL MISMO ORGANISMO, 36 meses (OCDS vía FirmaVB; ${hist.length} procesos, promedio adjudicado/presupuesto ${prom != null ? prom + "%" : "s/i"}):\n` +
        hist.slice(0, 30).map((h) => `${h.codigo} | ${fecha(h.fecha)} | ${h.estado ?? "s/i"} | ${String(h.titulo ?? "").slice(0, 90)} | presupuesto ${fmt(h.monto_estimado)} | ganó ${h.adjudicatario ?? "s/i"} por ${fmt(h.monto_adjudicado)} (${pct(h.monto_adjudicado, h.monto_estimado)}) | ${h.num_oferentes ?? "s/i"} oferentes: ${String(h.oferentes ?? "s/i").slice(0, 160)}`).join("\n"));
    } else partes.push("HISTORIAL DEL ORGANISMO: sin procesos parecidos en la base OCDS todavía (cubre desde julio de 2026).");
    if (res.topadj?.length) partes.push("QUIÉN LE GANA A ESTE ORGANISMO (OCDS, 24 meses):\n" + res.topadj.map((x: any) => `${x.adjudicatario} (${x.rut ?? "s/i"}): ${x.licitaciones} ganadas por ${fmt(x.monto)}, participó en ${x.participaciones}`).join("\n"));
    if (res.adj?.length) partes.push("LICITACIONES PARECIDAS EN OTROS ORGANISMOS (OCDS, 24 meses):\n" + res.adj.map((a: any) => `${a.codigo} | ${a.comprador} | ${fecha(a.fecha_adjudicacion)} | ganó ${a.adjudicatario ?? "s/i"} por ${fmt(a.monto_adjudicado)} (${pct(a.monto_adjudicado, a.monto_estimado)}) | ${a.num_oferentes ?? "s/i"} oferentes`).join("\n"));
    if (res.comp?.length) partes.push("QUIÉN VENDE ESTOS PRODUCTOS AL ESTADO (OC, 12 meses):\n" + res.comp.map((c: any) => `${c.proveedor} (${c.rut ?? ""}): ${c.ordenes} OC, ${fmt(c.monto)}, precio unitario mediano ${fmt(c.precio_unit_mediano)}, ${c.compradores} compradores`).join("\n"));
    if (res.org) { const g = res.org; partes.push(`PAGO DEL ORGANISMO (FirmaVB): reclamos por pago no oportuno 12 meses: ${g.reclamos_pago_12m ?? g.reclamos ?? "s/i"}; por irregularidad: ${g.reclamos_proceso_12m ?? "s/i"}; procesos 12 meses: ${g.procesos_12m ?? "s/i"} → ${g.reclamos_pago_por_100_procesos ?? "s/i"} reclamos de pago por cada 100 procesos; plazo declarado: ${g.plazo_pago ?? "s/i"}; conducta: ${g.conducta_pago ?? "s/i"} (${g.pago_promedio_dias ?? "s/i"} días)`); }
    else partes.push(`PAGO DEL ORGANISMO: conducta ${o.conducta_pago ?? "s/i"}, ${o.pago_promedio_dias ?? "s/i"} días promedio; reclamos: ${o.reclamos ?? "s/i"}`);
    bases.forEach((b) => {
      n++; fuentesMeta.push({ n, fuente: `Bases de la licitación ${codigo}: ${b.archivo}`, seccion: `${b.paginas ?? "?"} páginas`, url: null });
      const secs = (Array.isArray(b.secciones) ? b.secciones : []).filter((s: any) => /evalua|criterio|puntaj|ponder|garant|multa|plazo|pago|admisib|anexo|renov|vigencia|duraci/i.test(String(s.texto))).slice(0, 14);
      partes.push(`[${n}] BASES DE LA LICITACIÓN ${codigo} — "${b.archivo}" (${b.paginas ?? "?"} páginas)\nRESUMEN:\n${b.resumen ? resumenPlano(b.resumen) : "(sin resumen)"}\n${secs.map((s: any) => `## ${s.titulo}\n${String(s.texto).slice(0, 2500)}`).join("\n\n")}`);
    });
    if (!bases.length) partes.push("NO HAY BASES CARGADAS para esta licitación: la matriz se arma con la ficha y hay que pedir subir el PDF.");
    if (res.docs?.length) partes.push("DOCUMENTOS DE TRABAJO DEL PROVEEDOR (subidos por el usuario):\n" + res.docs.map((d: any) => `### ${d.nombre} (${d.tipo})\n${d.texto}`).join("\n\n"));
    const en = datos.enlaces ?? {};
    partes.push(`ENLACES DE VERIFICACIÓN (lo que no está en la base se verifica aquí; entrégalos tal cual en la sección que corresponda):\nFicha: ${en.ficha ?? ficha.url}\nLobby (infolobby.cl): ${en.lobby ?? "s/i"}\nDictámenes Contraloría: ${en.dictamenes ?? "https://www.contraloria.cl"}\nPrensa: ${en.noticias ?? "s/i"}\nTransparencia activa: ${en.transparencia ?? "s/i"}\nAnaliza Mercado Público: ${en.analiza ?? "s/i"}`);

    const userMsg = `${partes.join("\n\n")}\n\nEstado del caso: ${adjudicada ? "ADJUDICADA O CERRADA (la sección 9 aplica)" : "ABIERTA O EN EVALUACIÓN (la sección 9 no aplica)"}.\nGenera el informe Bajo el Agua de la licitación ${codigo}.${contextoProv ? " Contexto del proveedor: " + contextoProv : ""}`;

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "sin_ia" }, 500);
    let upstream: Response | null = null; let modelo = "";
    for (const mdl of MODELOS) {
      const r = await fetch(GEMINI_URL, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: mdl, messages: [{ role: "system", content: SYS }, { role: "user", content: userMsg }], temperature: 0.3, max_tokens: 9000, stream: true, reasoning_effort: "low" }) });
      if (r.ok && r.body) { upstream = r; modelo = mdl; break; }
      console.error("gemini", mdl, r.status, (await r.text()).slice(0, 200));
    }
    if (!upstream) return json({ error: "ia_no_disponible" }, 502);

    const cuotaDespues = { ...cuota, usados: Number(cuota.usados) + 1 };
    const enc = new TextEncoder(); const dec = new TextDecoder(); let respuesta = "";
    const stream = new ReadableStream({
      async start(ctrl) {
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ meta: { modelo, fuentes: fuentesMeta, codigo, cuota: cuotaDespues, historial: hist.length, oc_rubro: oc.ordenes ?? 0, noticias: noticias.length, lobby: (res.lobby?.audiencias ?? []).length, rfi: ((res.rfi?.organismo ?? []).length + (res.rfi?.producto ?? []).length), pedir_bases: bases.length ? null : codigo } })}\n\n`));
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
        // Se registra solo si hubo respuesta: un fallo de la IA no gasta la cuota.
        if (respuesta.length > 200) {
          try { await sb.rpc("experto_registrar_uso", { p_user_id: userId, p_huella: huella || "anon", p_modo: "bajo_agua", p_pregunta: `bajo el agua ${codigo}`, p_respuesta: respuesta, p_fuentes: fuentesMeta, p_licitacion: codigo, p_ms: Date.now() - t0, p_ip: ipCliente(req) }); } catch { /* no bloquear */ }
        }
      },
    });
    return new Response(stream, { headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) { return json({ error: String((e as Error)?.message ?? e) }, 500); }
});
