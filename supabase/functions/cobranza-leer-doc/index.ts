// Lector IA de factura / guía de despacho para Cobranza. Recibe el PDF en base64,
// extrae el texto y con un modelo saca los campos (folio, monto, fechas) para
// prellenar el formulario. Requiere sesión (verify_jwt=true). No guarda nada:
// solo lee y devuelve los campos; el cliente decide si los usa.
import { getDocumentProxy } from "npm:unpdf";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_BYTES = 20 * 1024 * 1024;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODELOS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

const SYS = `Eres un asistente que lee facturas electrónicas y guías de despacho chilenas.
Del texto entregado extrae SOLO estos campos y responde en JSON estricto (sin texto extra):
{
  "numero_factura": string|null,   // folio / N° del documento
  "monto": number|null,            // monto TOTAL del documento, solo dígitos, sin puntos ni símbolos
  "fecha_emision": string|null,    // formato YYYY-MM-DD
  "fecha_recepcion": string|null,  // fecha de recepción conforme si aparece, formato YYYY-MM-DD
  "rut_emisor": string|null        // RUT de quien emite el documento
}
Si un dato no aparece con claridad, usa null. No inventes.`;

function limpiarJson(s: string): Record<string, unknown> | null {
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);

  try {
    const { pdf_base64 } = await req.json().catch(() => ({}));
    if (!pdf_base64 || typeof pdf_base64 !== "string") return json({ ok: false, error: "Falta el PDF" }, 400);

    const bytes = Uint8Array.from(atob(pdf_base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > MAX_BYTES) return json({ ok: false, error: "El archivo supera 20 MB" }, 413);

    // Extrae texto de las primeras páginas (una factura/guía rara vez pasa de 3).
    let texto = "";
    try {
      const pdf = await getDocumentProxy(bytes);
      const partes: string[] = [];
      for (let i = 1; i <= Math.min(pdf.numPages, 6) && texto.length < 60_000; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        const t = (tc.items as Array<{ str?: string }>).map((it) => it.str ?? "").join(" ");
        partes.push(t);
        texto = partes.join("\n");
        page.cleanup?.();
      }
    } catch (e) {
      return json({ ok: false, motivo: "no_pdf", error: "No se pudo leer el PDF: " + String(e) }, 200);
    }

    texto = texto.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").trim();
    if (texto.replace(/\s/g, "").length < 40) {
      // Sin capa de texto: probablemente escaneado. MVP no hace OCR.
      return json({ ok: false, motivo: "sin_texto", error: "El PDF parece escaneado; ingresa los datos a mano." }, 200);
    }

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ ok: false, motivo: "sin_modelo", error: "Lector no disponible por ahora." }, 200);

    for (const model of MODELOS) {
      try {
        const r = await fetch(GEMINI_URL, {
          method: "POST",
          signal: AbortSignal.timeout(25_000),
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model, temperature: 0, max_tokens: 500, response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYS },
              { role: "user", content: "DOCUMENTO:\n\n" + texto.slice(0, 40_000) },
            ],
          }),
        });
        if (!r.ok) { console.error("gemini", model, r.status); continue; }
        const j = await r.json();
        const campos = limpiarJson(String(j.choices?.[0]?.message?.content ?? ""));
        if (campos) {
          // Normaliza monto a número entero.
          if (campos.monto != null) {
            const n = Number(String(campos.monto).replace(/[^0-9]/g, ""));
            campos.monto = Number.isFinite(n) && n > 0 ? n : null;
          }
          return json({ ok: true, campos });
        }
      } catch (e) { console.error("leer", model, String(e)); }
    }
    return json({ ok: false, motivo: "error_modelo", error: "No se pudo leer el documento. Intenta de nuevo o ingresa a mano." }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
