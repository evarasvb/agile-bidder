// Experto FirmaVB — documentos de trabajo del usuario (Excel, Word, PDF, texto) por licitación.
// El cliente sube sus formatos (matriz de postulación, checklist, anexos a medio llenar) y el Experto
// los lee en el chat, el estudio profundo y la matriz para anotar y ayudar a completarlos.
//   GET    ?codigo=XXXX        -> lista (requiere sesión)
//   POST   cuerpo crudo + X-Codigo / X-Nombre -> extrae texto y guarda (requiere sesión)
//   DELETE ?id=uuid            -> borra archivo y fila
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getDocumentProxy } from "npm:unpdf";
import * as XLSX from "npm:xlsx@0.18.5";
import JSZip from "npm:jszip@3.10.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-codigo, x-nombre, x-user-id",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_TEXTO = 200_000;
const BUCKET = "documentos-trabajo";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

function rolYSub(auth: string): { role: string; sub: string | null } {
  try {
    const p = JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { role: p.role ?? "", sub: p.sub ?? null };
  } catch { return { role: "", sub: null }; }
}
const limpiar = (t: string) => t.replace(/\r/g, "").replace(/[ \t\f\v]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
const desXml = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

async function extraer(nombre: string, bytes: Uint8Array): Promise<{ tipo: string; texto: string }> {
  const ext = (nombre.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "");
  const cabecera = String.fromCharCode(...bytes.slice(0, 5));
  if (ext === "pdf" || cabecera === "%PDF-") {
    const pdf = await getDocumentProxy(bytes);
    const partes: string[] = []; let total = 0;
    for (let i = 1; i <= Math.min(pdf.numPages, 300) && total < MAX_TEXTO; i++) {
      const page = await pdf.getPage(i); const tc = await page.getTextContent();
      const t = (tc.items as any[]).map((it) => it.str ?? "").join(" "); partes.push(t); total += t.length; page.cleanup?.();
    }
    return { tipo: "pdf", texto: limpiar(partes.join("\n")) };
  }
  if (ext === "xlsx" || ext === "xlsm" || ext === "xls" || ext === "csv") {
    const wb = XLSX.read(bytes, { type: "array" });
    const hojas = wb.SheetNames.map((n) => `## Hoja: ${n}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n], { FS: " | ", blankrows: false }));
    return { tipo: ext === "csv" ? "csv" : "xlsx", texto: limpiar(hojas.join("\n\n")) };
  }
  if (ext === "docx") {
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("word/document.xml")?.async("string");
    if (!xml) throw new Error("docx sin contenido");
    const texto = xml.replace(/<\/w:p>/g, "\n").replace(/<w:tab\/>/g, "\t").replace(/<\/w:tc>/g, " | ").replace(/<[^>]+>/g, "");
    return { tipo: "docx", texto: limpiar(desXml(texto)) };
  }
  if (["txt", "md", "json", "html", "htm"].includes(ext)) {
    const t = new TextDecoder().decode(bytes);
    return { tipo: ext, texto: limpiar(ext.startsWith("htm") ? desXml(t.replace(/<[^>]+>/g, " ")) : t) };
  }
  throw new Error("formato");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const { role, sub } = rolYSub(req.headers.get("Authorization") ?? "");
    const userId = role === "authenticated" ? sub : role === "service_role" ? (req.headers.get("x-user-id") || null) : null;
    if (!userId) return json({ error: "login", mensaje: "Inicia sesión en FirmaVB para subir tus documentos de trabajo." }, 401);
    const url = new URL(req.url);

    if (req.method === "GET") {
      const codigo = (url.searchParams.get("codigo") ?? "").trim().toUpperCase();
      const { data, error } = await sb.rpc("experto_documentos_listar", { p_user_id: userId, p_codigo: codigo || null });
      if (error) return json({ error: error.message }, 500);
      return json({ documentos: data ?? [] });
    }
    if (req.method === "DELETE") {
      const id = url.searchParams.get("id") ?? "";
      const { data: path, error } = await sb.rpc("experto_documento_borrar", { p_user_id: userId, p_id: id });
      if (error) return json({ error: error.message }, 500);
      if (path) await sb.storage.from(BUCKET).remove([String(path)]);
      return json({ ok: true });
    }

    // POST: archivo crudo
    const codigo = decodeURIComponent(req.headers.get("x-codigo") ?? "").trim().toUpperCase();
    if (codigo && !/^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2}$/.test(codigo)) return json({ error: "codigo", mensaje: "ID de licitación inválido." }, 400);
    let nombre = decodeURIComponent(req.headers.get("x-nombre") ?? "documento").replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ()]/g, "_").slice(0, 120);
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return json({ error: "tamano", mensaje: "El archivo supera los 15 MB." }, 413);
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length > MAX_BYTES) return json({ error: "tamano", mensaje: "El archivo supera los 15 MB." }, 413);
    if (bytes.length < 10) return json({ error: "vacio", mensaje: "El archivo está vacío." }, 400);

    let tipo = "", texto = "";
    try { ({ tipo, texto } = await extraer(nombre, bytes)); }
    catch (e) {
      const m = String((e as Error)?.message ?? e);
      return json({ error: m === "formato" ? "formato" : "lectura", mensaje: m === "formato" ? "Formato no soportado. Sube PDF, Excel (xlsx/csv), Word (docx) o texto." : "No pude leer ese archivo. Prueba con otra versión (PDF con texto, xlsx, docx)." }, 422);
    }
    texto = texto.slice(0, MAX_TEXTO);
    if (texto.length < 20) return json({ error: "sin_texto", mensaje: "El archivo no trae texto legible (¿escaneado?)." }, 422);

    const storage_path = `${userId}/${codigo || "general"}/${Date.now()}_${nombre.replace(/\s+/g, "_")}`;
    const up = await sb.storage.from(BUCKET).upload(storage_path, bytes, { contentType: req.headers.get("content-type") || "application/octet-stream", upsert: false });
    const { data: id, error } = await sb.rpc("experto_documento_insertar", { p_user_id: userId, p_codigo: codigo || null, p_nombre: nombre, p_tipo: tipo, p_storage_path: up.error ? null : storage_path, p_texto: texto });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, id, nombre, tipo, caracteres: texto.length });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
