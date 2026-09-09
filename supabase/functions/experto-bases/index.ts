// Experto FirmaVB — bases de licitación (PDF o Word) subidas por el cliente o bajadas por el robot.
// Aquí se extrae el texto, se resume con Gemini y queda guardado por código de licitación para
// que el Experto lo use como fuente y le sirva a los demás usuarios de la misma licitación.
//   GET  ?codigo=XXXX          -> estado (cuántos archivos hay)
//   POST cuerpo crudo (Content-Type application/pdf o docx + X-Codigo / X-Nombre) -> extrae, resume y guarda
//   POST {codigo, nombre, pdf_base64} -> igual, PDF en base64 (requiere sesión)
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getDocumentProxy } from "npm:unpdf";
import JSZip from "npm:jszip@3.10.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-codigo, x-nombre, x-ocr-ia",
};
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_TEXTO = 400_000;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_NATIVE = "https://generativelanguage.googleapis.com/v1beta/models";
// PDF escaneado: se manda entero a Gemini (lee las páginas como imágenes). Sobre 6 MB el base64 no cabe en el tiempo.
const MAX_OCR_BYTES = 6 * 1024 * 1024;
const MODELOS = [Deno.env.get("GEMINI_MODEL_INFORME"), "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite"].filter(Boolean) as string[];

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

function rolYSub(auth: string): { role: string; sub: string | null } {
  // La clave de servicio del runtime puede no ser un JWT (formato sb_secret_...): si la cabecera trae
  // exactamente esa clave, es una llamada interna (licitacion-adjuntos, extension-adjuntos).
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (sk && token === sk) return { role: "service_role", sub: null };
  try {
    const p = JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { role: p.role ?? "", sub: p.sub ?? null };
  } catch { return { role: "", sub: null }; }
}

// Sin \u0000 (Postgres lo rechaza dentro de jsonb: "unsupported Unicode escape sequence").
function limpiar(t: string): string {
  return t.replace(/\u0000/g, "").replace(/\r/g, "").replace(/[ \t\f\v]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
const desXml = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

// Word (.docx): texto de word/document.xml; párrafos como líneas y celdas separadas por " | ".
// Con control de cambios activo, el XML conserva el texto borrado (<w:del>, <w:moveFrom>): se quita
// antes de aplanar para no resucitar precios o plazos ya reemplazados.
async function textoDocx(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("docx_vacio");
  const vigente = xml.replace(/<w:del\b[\s\S]*?<\/w:del>/g, "").replace(/<w:moveFrom\b[\s\S]*?<\/w:moveFrom>/g, "").replace(/<w:delText\b[^>]*>[\s\S]*?<\/w:delText>/g, "");
  return limpiar(desXml(vigente.replace(/<\/w:p>/g, "\n").replace(/<w:tab\/>/g, "\t").replace(/<\/w:tc>/g, " | ").replace(/<w:br[^>]*\/>/g, "\n").replace(/<[^>]+>/g, "")));
}

// Secciones por encabezados típicos de bases chilenas; las largas se parten en trozos de ~3.500 caracteres.
function seccionar(texto: string): { titulo: string; texto: string }[] {
  const enc = /\n(?=(?:ART[ÍI]CULO|ART\.|T[ÍI]TULO|CAP[ÍI]TULO|SECCI[ÓO]N|NUMERAL|ANEXO|CL[ÁA]USULA)\s*(?:N[°º]\s*)?[\dIVXLC]+|\n\d{1,2}(?:\.\d{1,2}){0,2}[.)-]?\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s,]{4,})/g;
  const partes = texto.split(enc).map((p) => p.trim()).filter((p) => p.length > 40);
  const out: { titulo: string; texto: string }[] = [];
  const bloques = partes.length > 3 ? partes : [texto];
  for (const b of bloques) {
    const titulo = b.split("\n")[0].slice(0, 120);
    for (let i = 0; i < b.length; i += 3500) {
      out.push({ titulo: i ? `${titulo} (cont.)` : titulo, texto: b.slice(i, i + 3500) });
    }
  }
  return out.slice(0, 400);
}

// Cada llamada a Gemini espera como máximo GEMINI_TIMEOUT_MS y el conjunto no pasa de `plazo`:
// sin tope, una pasada por todos los modelos con Google saturado (503) dejaba la petición colgada
// hasta el 504 del gateway y el PDF quedaba como "no leído" aunque el texto ya estaba extraído.
const GEMINI_TIMEOUT_MS = 45_000;
// Queda en true cuando la última pasada de resumir() recibió 429 (sin cuota) de todos los modelos.
let sinCuota = false;
async function resumir(texto: string, plazo = Date.now() + 100_000): Promise<Record<string, unknown> | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return null;
  let hubo429 = false, huboOtro = false;
  const sys = `Eres un experto en licitaciones públicas chilenas (Ley 19.886 y su reglamento). Lee las bases y extrae SOLO lo que diga el documento. Responde únicamente con JSON válido, sin markdown, con esta forma:
{"objeto":"qué se compra, en una línea",
 "presupuesto":"monto y si es con o sin impuestos, o null",
 "criterios_evaluacion":[{"criterio":"nombre","ponderacion":"porcentaje o puntaje","como_se_puntua":"fórmula o escala resumida"}],
 "requisitos_admisibilidad":["cada requisito o documento cuya falta deja fuera la oferta"],
 "anexos_obligatorios":["Anexo N° y nombre"],
 "garantias":{"seriedad":"monto/porcentaje, vigencia o null","fiel_cumplimiento":"monto/porcentaje, vigencia o null"},
 "plazos":[{"hito":"consultas, respuestas, cierre, apertura, adjudicación, entrega, vigencia contrato","valor":"fecha o plazo tal como está escrito"}],
 "forma_de_pago":"plazo y condiciones de pago, o null",
 "multas_y_clausulas_riesgosas":["multa o cláusula con su monto/porcentaje y por qué es riesgosa"],
 "advertencias":["cualquier cosa rara: criterios subjetivos, experiencia imposible de acreditar, plazos de entrega irreales, exclusividad, etc."]}
Si algo no está en el texto, usa null o lista vacía. No inventes.`;
  // Primero el modelo lite (cuota gratis amplia); los grandes solo si falla. Google devuelve 503 por
  // alta demanda a ratos: segunda pasada por todos los modelos tras una pausa.
  const orden = [...new Set(["gemini-3.5-flash-lite", ...MODELOS])];
  for (const model of [...orden, "espera", ...orden]) {
    if (model === "espera") { await new Promise((ok) => setTimeout(ok, 2500)); continue; }
    if (Date.now() > plazo - 10_000) break;
    try {
      const r = await fetch(GEMINI_URL, {
        method: "POST",
        signal: AbortSignal.timeout(Math.min(GEMINI_TIMEOUT_MS, Math.max(5_000, plazo - Date.now()))),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0.1, max_tokens: 3000, response_format: { type: "json_object" }, messages: [
          { role: "system", content: sys },
          { role: "user", content: "BASES:\n\n" + texto.slice(0, 90_000) },
        ] }),
      });
      if (!r.ok) { console.error("gemini", model, r.status, (await r.text()).slice(0, 200)); if (r.status === 429) hubo429 = true; else huboOtro = true; continue; }
      const j = await r.json();
      let c = String(j.choices?.[0]?.message?.content ?? "").trim();
      c = c.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const a = c.indexOf("{"), z = c.lastIndexOf("}");
      if (a >= 0 && z > a) c = c.slice(a, z + 1);
      sinCuota = false;
      return JSON.parse(c);
    } catch (e) { console.error("resumen", model, String(e)); huboOtro = true; }
  }
  sinCuota = hubo429 && !huboOtro;
  return null;
}

// OCR de un PDF sin capa de texto (escaneado): Gemini transcribe página por página. Primero el modelo
// lite (más cuota y más barato por token de salida); si falla, los demás. Devuelve "" si no se pudo.
async function ocrPdf(bytes: Uint8Array, plazo: number): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return "";
  let b64 = ""; for (let i = 0; i < bytes.length; i += 0x8000) b64 += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); b64 = btoa(b64);
  const prompts = [
    "Transcribe TODO el texto de este documento, página por página y en orden, tal como está escrito (español). Conserva títulos, numeración de artículos y tablas (filas separadas por ' | '). No resumas ni comentes.",
    // Google a veces corta la transcripción literal (finishReason RECITATION): se pide el contenido completo con otras palabras.
    "Lee este documento completo y entrega TODO su contenido en texto plano, sección por sección y en orden, con tus propias palabras pero sin omitir nada: cifras, fechas, plazos, montos, porcentajes, garantías, multas, criterios de evaluación con sus ponderaciones, requisitos, anexos exigidos y numeración de artículos. Las tablas como filas separadas por ' | '. Sin comentarios.",
  ];
  for (const model of [...new Set(["gemini-3.5-flash-lite", ...MODELOS])]) {
    for (const prompt of prompts) {
      const restante = plazo - Date.now();
      if (restante < 20_000) return "";
      try {
        const r = await fetch(`${GEMINI_NATIVE}/${model}:generateContent`, {
          method: "POST", signal: AbortSignal.timeout(restante),
          headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ inline_data: { mime_type: "application/pdf", data: b64 } }, { text: prompt }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 60000 },
          }),
        });
        if (!r.ok) { console.error("ocr", model, r.status, (await r.text()).slice(0, 200)); break; } // sin cuota o caído: siguiente modelo
        const j = await r.json();
        const t = ((j.candidates?.[0]?.content?.parts ?? []) as { text?: string }[]).map((p) => p.text ?? "").join("\n");
        if (t.trim().length >= 200) return limpiar(t);
        // Salida vacía o mínima (RECITATION, o el modelo contestó en vez de transcribir): se prueba el otro pedido.
        console.error("ocr", model, "corto", String(j.candidates?.[0]?.finishReason ?? ""), JSON.stringify(t.slice(0, 160)));
      } catch (e) { console.error("ocr", model, String(e)); break; }
    }
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const t0 = Date.now();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    if (req.method === "GET") {
      const codigo = (new URL(req.url).searchParams.get("codigo") ?? "").trim().toUpperCase();
      if (!codigo) return json({ error: "falta_codigo" }, 400);
      const { data, error } = await sb.rpc("experto_bases_estado", { p_codigo: codigo });
      if (error) return json({ error: error.message }, 500);
      return json({ codigo, ...(data?.[0] ?? { archivos: 0, paginas: 0, ultimo: null }) });
    }

    const { role, sub } = rolYSub(req.headers.get("Authorization") ?? "");
    if (role !== "authenticated" && role !== "service_role") {
      return json({ error: "login", mensaje: "Inicia sesión en FirmaVB (es gratis) para subir las bases." }, 401);
    }
    const ct = req.headers.get("content-type") ?? "";
    // El cuerpo JSON se lee una sola vez: sirve al cron y a la carga en base64.
    const bodyJson = ct.includes("application/json") ? await req.json().catch(() => ({})) : null;
    // Cron (service_role): bases guardadas sin resumen porque Gemini no tenía cuota en ese momento.
    // Se resumen de a pocas, de la más antigua a la más nueva y con tope de 3 intentos por base; si la
    // falla es por cuota (429 en todos los modelos) la pasada termina para no gastar llamadas.
    if (role === "service_role" && bodyJson?.resumir_pendientes) {
      const limite = Math.min(Number(bodyJson.limit ?? 5), 20);
      const { data: filas } = await sb.from("bases_licitacion").select("id, texto, resumen_intentos").is("resumen", null).gt("caracteres", 200).lt("resumen_intentos", 3).order("creado_en", { ascending: true }).limit(limite);
      let hechas = 0, fallidas = 0;
      for (const f of (filas ?? []) as { id: string; texto: string; resumen_intentos: number | null }[]) {
        if (Date.now() - t0 > 150_000) break;
        const resumen = await resumir(f.texto, Date.now() + 60_000);
        if (resumen) { await sb.from("bases_licitacion").update({ resumen }).eq("id", f.id); hechas++; continue; }
        if (sinCuota) break;
        await sb.from("bases_licitacion").update({ resumen_intentos: (f.resumen_intentos ?? 0) + 1 }).eq("id", f.id);
        fallidas++;
      }
      return json({ hechas, fallidas, sin_cuota: sinCuota, candidatas: (filas ?? []).length, ms: Date.now() - t0 });
    }
    // El PDF llega crudo (Content-Type application/pdf + cabeceras X-Codigo / X-Nombre): sin base64
    // se usa la mitad de memoria y no se cae el worker con bases grandes.
    let codigo = "", nombre = "", bytes: Uint8Array;
    if (ct.includes("application/pdf") || ct.includes("wordprocessingml") || ct.includes("application/octet-stream")) {
      codigo = decodeURIComponent(req.headers.get("x-codigo") ?? "").trim().toUpperCase();
      nombre = decodeURIComponent(req.headers.get("x-nombre") ?? "bases.pdf");
      const len = Number(req.headers.get("content-length") ?? 0);
      if (len > MAX_PDF_BYTES) return json({ error: "tamano", mensaje: "El archivo supera los 20 MB." }, 413);
      bytes = new Uint8Array(await req.arrayBuffer());
    } else {
      const body = bodyJson ?? await req.json();
      codigo = String(body.codigo ?? "").trim().toUpperCase();
      nombre = String(body.nombre ?? "bases.pdf");
      const b64 = String(body.pdf_base64 ?? "").replace(/^data:[^,]*,/, "");
      if (!b64) return json({ error: "sin_archivo", mensaje: "Adjunta el PDF de las bases." }, 400);
      if (b64.length > MAX_PDF_BYTES * 1.4) return json({ error: "tamano", mensaje: "El PDF supera los 20 MB." }, 413);
      bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    }
    if (!/^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2,3}$/.test(codigo)) return json({ error: "codigo", mensaje: "Indica el ID de la licitación (ej. 2699-35-LE26)." }, 400);
    nombre = nombre.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]/g, "_").slice(0, 120);
    if (bytes.length > MAX_PDF_BYTES) return json({ error: "tamano", mensaje: "El archivo supera los 20 MB." }, 413);
    const esPdf = bytes.length >= 100 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
    // .docx es un zip (cabecera "PK"); también se acepta por nombre o Content-Type.
    const esDocx = !esPdf && bytes.length >= 100 && bytes[0] === 0x50 && bytes[1] === 0x4b && (/\.docx$/i.test(nombre) || ct.includes("wordprocessingml") || ct.includes("octet-stream"));
    if (!esPdf && !esDocx) return json({ error: "no_pdf", mensaje: "El archivo no es un PDF ni un Word (.docx)." }, 400);

    // 1. Texto: PDF página por página (tope de páginas y caracteres para no agotar memoria) o Word completo
    let texto = "", paginas = 0;
    try {
      if (esDocx) {
        texto = await textoDocx(bytes);
        paginas = Math.max(1, Math.round(texto.length / 3000));
      } else {
        const pdf = await getDocumentProxy(bytes);
        paginas = pdf.numPages;
        const partes: string[] = []; let total = 0;
        for (let i = 1; i <= Math.min(pdf.numPages, 400) && total < MAX_TEXTO; i++) {
          const page = await pdf.getPage(i);
          const tc = await page.getTextContent();
          const t = (tc.items as any[]).map((it) => it.str ?? "").join(" ");
          partes.push(t); total += t.length;
          page.cleanup?.();
        }
        texto = limpiar(partes.join("\n"));
      }
    } catch (e) {
      console.error("extract", String(e));
      return json({ error: "lectura", mensaje: "No pude leer ese archivo. Prueba con otro archivo o con la versión con texto." }, 422);
    }
    // PDF escaneado (1 de cada 4 en Mercado Público): el OCR normal lo hace Tesseract en GitHub Actions
    // (workflow ocr-bases, gratis e ilimitado) y reencola el PDF con capa de texto. El OCR con Gemini
    // queda como último recurso y solo si quien llama lo pide (cabecera X-OCR-IA).
    let ocr = false;
    if (texto.length < 200 && esPdf && bytes.length <= MAX_OCR_BYTES && req.headers.get("x-ocr-ia") === "1") {
      texto = await ocrPdf(bytes, t0 + 170_000);
      ocr = texto.length >= 200;
    }
    if (texto.length < 200) return json({ error: "sin_texto", mensaje: esDocx ? "El Word viene casi vacío: no trae texto para leer." : `El PDF (${paginas} páginas) parece escaneado y no pude transcribirlo. Sube la versión con texto seleccionable.` }, 422);
    texto = texto.slice(0, MAX_TEXTO);
    const secciones = seccionar(texto);

    // 2. Resumen estructurado (si hubo OCR, se le da su propio tiempo)
    const resumen = await resumir(texto, Math.max(t0 + 120_000, Date.now() + 90_000));

    // 3. Archivo original (mejor esfuerzo) y fila
    // Storage rechaza claves con tildes o símbolos: la ruta va sin ellos (el nombre original queda en la fila).
    let storage_path: string | null = `${codigo}/${Date.now()}_${nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.\-]/g, "_").replace(/_+/g, "_")}`;
    const up = await sb.storage.from("bases-licitacion").upload(storage_path, bytes, { contentType: esDocx ? DOCX_MIME : "application/pdf", upsert: false });
    if (up.error) { console.error("storage", up.error.message); storage_path = null; }
    const { data: fila, error } = await sb.from("bases_licitacion").insert({
      codigo, archivo: nombre, storage_path, paginas, caracteres: texto.length, texto, secciones, resumen,
      subido_por: role === "authenticated" ? sub : null,
    }).select("id").single();
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, id: fila.id, codigo, archivo: nombre, paginas, caracteres: texto.length, secciones: secciones.length, ocr, resumen, ms: Date.now() - t0 });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
