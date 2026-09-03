// Experto FirmaVB — bases de licitación subidas por el cliente.
// Mercado Público protege sus adjuntos con reCAPTCHA, así que las bases las aporta el
// usuario (PDF descargado del portal). Aquí se extrae el texto, se resume con Gemini y
// queda guardado por código de licitación para que el Experto lo use como fuente y
// para que le sirva a los demás usuarios que pregunten por la misma licitación.
//   GET  ?codigo=XXXX          -> estado (cuántos archivos hay)
//   POST {codigo, nombre, pdf_base64} -> extrae, resume y guarda (requiere sesión)
import { createClient } from "jsr:@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_TEXTO = 400_000;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODELOS = [Deno.env.get("GEMINI_MODEL_INFORME"), "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite"].filter(Boolean) as string[];

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

function rolYSub(auth: string): { role: string; sub: string | null } {
  try {
    const p = JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { role: p.role ?? "", sub: p.sub ?? null };
  } catch { return { role: "", sub: null }; }
}

function limpiar(t: string): string {
  return t.replace(/\r/g, "").replace(/[ \t\f\v]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
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

async function resumir(texto: string): Promise<Record<string, unknown> | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return null;
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
  for (const model of MODELOS) {
    try {
      const r = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0.1, max_tokens: 3000, messages: [
          { role: "system", content: sys },
          { role: "user", content: "BASES:\n\n" + texto.slice(0, 90_000) },
        ] }),
      });
      if (!r.ok) { console.error("gemini", model, r.status, (await r.text()).slice(0, 200)); continue; }
      const j = await r.json();
      let c = String(j.choices?.[0]?.message?.content ?? "").trim();
      c = c.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const a = c.indexOf("{"), z = c.lastIndexOf("}");
      if (a >= 0 && z > a) c = c.slice(a, z + 1);
      return JSON.parse(c);
    } catch (e) { console.error("resumen", model, String(e)); }
  }
  return null;
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
    const body = await req.json();
    const codigo = String(body.codigo ?? "").trim().toUpperCase();
    if (!/^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2}$/.test(codigo)) return json({ error: "codigo", mensaje: "Indica el ID de la licitación (ej. 2699-35-LE26)." }, 400);
    const nombre = String(body.nombre ?? "bases.pdf").replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]/g, "_").slice(0, 120);
    const b64 = String(body.pdf_base64 ?? "").replace(/^data:[^,]*,/, "");
    if (!b64) return json({ error: "sin_archivo", mensaje: "Adjunta el PDF de las bases." }, 400);
    if (b64.length > MAX_PDF_BYTES * 1.4) return json({ error: "tamano", mensaje: "El PDF supera los 20 MB." }, 413);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (bytes.length < 100 || String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") return json({ error: "no_pdf", mensaje: "El archivo no es un PDF." }, 400);

    // 1. Texto
    let texto = "", paginas = 0;
    try {
      const pdf = await getDocumentProxy(bytes);
      const r = await extractText(pdf, { mergePages: true });
      paginas = r.totalPages; texto = limpiar(String(r.text ?? ""));
    } catch (e) {
      console.error("extract", String(e));
      return json({ error: "lectura", mensaje: "No pude leer ese PDF. Prueba con otro archivo o con la versión con texto." }, 422);
    }
    if (texto.length < 200) return json({ error: "sin_texto", mensaje: `El PDF (${paginas} páginas) parece escaneado: no trae texto. Sube la versión con texto seleccionable.` }, 422);
    texto = texto.slice(0, MAX_TEXTO);
    const secciones = seccionar(texto);

    // 2. Resumen estructurado
    const resumen = await resumir(texto);

    // 3. Archivo original (mejor esfuerzo) y fila
    let storage_path: string | null = `${codigo}/${Date.now()}_${nombre.replace(/\s+/g, "_")}`;
    const up = await sb.storage.from("bases-licitacion").upload(storage_path, bytes, { contentType: "application/pdf", upsert: false });
    if (up.error) { console.error("storage", up.error.message); storage_path = null; }
    const { data: fila, error } = await sb.from("bases_licitacion").insert({
      codigo, archivo: nombre, storage_path, paginas, caracteres: texto.length, texto, secciones, resumen,
      subido_por: role === "authenticated" ? sub : null,
    }).select("id").single();
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, id: fila.id, codigo, archivo: nombre, paginas, caracteres: texto.length, secciones: secciones.length, resumen, ms: Date.now() - t0 });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
