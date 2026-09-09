// Adjuntos de una licitación enviados desde la extensión "FirmaVB Postulador".
// La sección "Adjuntos" de Mercado Público exige reCAPTCHA, así que el robot no puede bajarla;
// la extensión, corriendo en el navegador del usuario (que ya pasó el captcha), toma cada archivo
// y lo manda aquí: queda en el bucket bases-licitacion, registrado en licitaciones_adjuntos y,
// si es un PDF de bases, marcado bases_pendiente para que el Experto lo lea (cron cada 10 min).
//   POST (cuerpo = archivo crudo) con cabeceras x-api-key, X-Codigo, X-Nombre, X-Descripcion, Content-Type
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-codigo, x-nombre, x-tipo, x-descripcion",
};
const BUCKET = "bases-licitacion";
const MAX_BYTES = 30 * 1024 * 1024;
const MAX_BASES_BYTES = 6 * 1024 * 1024;
const RE_CODIGO = /^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2,3}$/;
const RE_BASES = /bases|resol|administrativ|t[ée]cnic|licitaci|aprueba/i;
// Formularios para llenar ("Anexo 2 - Aceptación de Bases") no son bases aunque las nombren.
const RE_NO_BASES = /^\s*(anexo|formulario|formato|declaraci[oó]n|carta|acta)/i;
const MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
  rar: "application/vnd.rar",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const sanitizar = (n: string) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.\- ]/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_").slice(0, 140);
const decodificar = (v: string | null) => { try { return decodeURIComponent(v ?? ""); } catch { return v ?? ""; } };

// Misma validación que extension-api: prefijo + hash SHA-256 (y llave en texto plano heredada).
async function clientePorApiKey(sb: SupabaseClient, apiKey: string): Promise<{ clienteId: string; apiKeyId: string } | null> {
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiKey)))).map((b) => b.toString(16).padStart(2, "0")).join("");
  const { data: candidatas } = await sb.from("extension_api_keys").select("id, cliente_id, activa, api_key_hash").eq("api_key_prefix", apiKey.substring(0, 12));
  let fila = (candidatas ?? []).find((c: { api_key_hash: string }) => c.api_key_hash === hash) ?? null;
  if (!fila) {
    const { data: legado } = await sb.from("extension_api_keys").select("id, cliente_id, activa").eq("api_key", apiKey).maybeSingle();
    fila = legado ?? null;
  }
  if (!fila || !fila.activa) return null;
  await sb.from("extension_api_keys").update({ last_used: new Date().toISOString() }).eq("id", fila.id);
  return { clienteId: fila.cliente_id, apiKeyId: fila.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "metodo" }, 405);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return json({ error: "Falta x-api-key" }, 401);
    const cliente = await clientePorApiKey(sb, apiKey);
    if (!cliente) return json({ error: "API key inválida" }, 401);

    const codigo = decodificar(req.headers.get("x-codigo")).trim().toUpperCase();
    if (!RE_CODIGO.test(codigo)) return json({ error: "codigo", mensaje: "Código de licitación inválido" }, 400);
    const nombre = decodificar(req.headers.get("x-nombre")).trim().replace(/[\\/]/g, "_").slice(0, 200);
    if (!nombre) return json({ error: "nombre", mensaje: "Falta el nombre del archivo" }, 400);
    const descripcion = decodificar(req.headers.get("x-descripcion")).trim().slice(0, 300) || null;
    const tipo = decodificar(req.headers.get("x-tipo")).trim().slice(0, 120) || "Adjuntos de Mercado Público (vía extensión)";

    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length < 16) return json({ error: "vacio", mensaje: "Archivo vacío" }, 400);
    if (bytes.length > MAX_BYTES) return json({ error: "tamano", mensaje: "El archivo supera los 30 MB" }, 413);
    const esPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    const ext = (nombre.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "").toLowerCase();
    const contentType = esPdf ? "application/pdf" : (MIME[ext] ?? (req.headers.get("content-type")?.split(";")[0] || "application/octet-stream"));

    const storagePath = `${codigo}/mp/${sanitizar(nombre)}`;
    const up = await sb.storage.from(BUCKET).upload(storagePath, bytes, { contentType, upsert: true });
    if (up.error) return json({ error: "storage", mensaje: up.error.message }, 500);

    const { data: yaLeida } = await sb.from("bases_licitacion").select("id").eq("codigo", codigo).eq("archivo", nombre).limit(1);
    // En una compra ágil todo PDF adjunto son los términos de referencia: el Experto lo lee siempre.
    const esCompraAgil = /-COT\d{2}$/.test(codigo) || /compra\s*[áa]gil/i.test(tipo);
    const esDocx = !esPdf && ext === "docx" && bytes[0] === 0x50 && bytes[1] === 0x4b;
    const basesPendiente = (esPdf || esDocx) && bytes.length <= MAX_BASES_BYTES && !(yaLeida ?? []).length && (esCompraAgil || (RE_BASES.test(`${nombre} ${descripcion ?? ""}`) && !RE_NO_BASES.test(nombre)));
    const { error: errFila } = await sb.from("licitaciones_adjuntos").upsert({
      codigo, nombre, tipo, descripcion, fecha_adjunto: null, bytes: bytes.length, content_type: contentType, storage_path: storagePath,
      es_bases: false, bases_id: null, bases_pendiente: basesPendiente, bajado_en: new Date().toISOString(),
    }, { onConflict: "codigo,nombre" });
    if (errFila) return json({ error: "registro", mensaje: errFila.message }, 500);

    const { count } = await sb.from("licitaciones_adjuntos").select("id", { count: "exact", head: true }).eq("codigo", codigo);
    await sb.from("licitaciones_adjuntos_estado").upsert({ codigo, revisado_en: new Date().toISOString(), archivos: count ?? 0, pendientes: 0, error: null });
    await sb.from("extension_activity_log").insert({
      api_key_id: cliente.apiKeyId, cliente_id: cliente.clienteId, action: "adjunto_enviado", licitacion_id: codigo,
      detalles: { nombre, bytes: bytes.length, content_type: contentType, bases_pendiente: basesPendiente },
      user_agent: req.headers.get("user-agent"),
    });
    return json({ ok: true, codigo, nombre, bytes: bytes.length, bases_pendiente: basesPendiente });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
