// Experto FirmaVB — "Extraer anexos de las bases": comodidad para el usuario. Cuando los
// anexos NO vienen como Word separados (están dentro del PDF de bases), este endpoint
// reutiliza experto-anexos (que ya reconstruye cada anexo con los datos de la empresa,
// separados por "---") y entrega cada uno como un .docx individual en "Mis documentos de
// trabajo", listo para descargar, imprimir o volver a pasar por "Completar".
//   POST {codigo} -> { ok, anexos:[{numero, nombre, documento_id}], omitidos_por_cupo }
import { createClient } from "jsr:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const BUCKET = "documentos-trabajo";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
function rolYSub(auth: string): { role: string; sub: string | null } {
  try { const p = JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return { role: p.role ?? "", sub: p.sub ?? null }; }
  catch { return { role: "", sub: null }; }
}
const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Constructor mínimo de .docx (OOXML) a partir de texto Markdown simple: tablas "| a | b |",
// títulos "#"/"##" en negrita, viñetas "- " y párrafos normales. Sin dependencias externas.
async function markdownADocx(texto: string): Promise<Uint8Array> {
  const lineas = texto.split("\n");
  const cuerpo: string[] = [];
  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i];
    if (/^\s*\|.*\|\s*$/.test(l)) {
      const filas: string[][] = [];
      while (i < lineas.length && /^\s*\|.*\|\s*$/.test(lineas[i])) {
        const celdas = lineas[i].trim().slice(1, -1).split("|").map((c) => c.trim());
        if (!/^:?-+:?$/.test(celdas.join(""))) filas.push(celdas);
        i++;
      }
      if (filas.length) {
        const ncols = filas[0].length;
        const tc = Math.floor(9350 / ncols);
        const filasXml = filas.map((f, fi) => `<w:tr>${Array.from({ length: ncols }, (_, c) =>
          `<w:tc><w:tcPr><w:tcW w:w="${tc}" w:type="dxa"/>${fi === 0 ? '<w:shd w:val="clear" w:fill="EDEFF5"/>' : ""}</w:tcPr><w:p><w:r>${fi === 0 ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${escXml(f[c] ?? "")}</w:t></w:r></w:p></w:tc>`
        ).join("")}</w:tr>`).join("");
        cuerpo.push(`<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="CCCCCC"/><w:left w:val="single" w:sz="4" w:color="CCCCCC"/><w:bottom w:val="single" w:sz="4" w:color="CCCCCC"/><w:right w:val="single" w:sz="4" w:color="CCCCCC"/><w:insideH w:val="single" w:sz="4" w:color="CCCCCC"/><w:insideV w:val="single" w:sz="4" w:color="CCCCCC"/></w:tblBorders></w:tblPr>${filasXml}</w:tbl><w:p/>`);
        continue;
      }
    }
    const titulo = /^#{1,3}\s*(.*)/.exec(l);
    const vinieta = /^\s*[-*]\s+(.*)/.exec(l);
    if (titulo) cuerpo.push(`<w:p><w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">${escXml(titulo[1])}</w:t></w:r></w:p>`);
    else if (vinieta) cuerpo.push(`<w:p><w:pPr><w:ind w:left="360"/></w:pPr><w:r><w:t xml:space="preserve">• ${escXml(vinieta[1])}</w:t></w:r></w:p>`);
    else if (l.trim() === "") cuerpo.push(`<w:p/>`);
    else {
      const negrita = l.replace(/\*\*(.*?)\*\*/g, "$1");
      cuerpo.push(`<w:p><w:r>${/\*\*/.test(l) ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${escXml(negrita)}</w:t></w:r></w:p>`);
    }
    i++;
  }
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${cuerpo.join("")}` +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417"/></w:sectPr></w:body></w:document>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const zip = new JSZip();
  zip.file("[Content_Types].xml", ct);
  zip.file("_rels/.rels", rels);
  zip.file("word/document.xml", doc);
  return await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const { role, sub } = rolYSub(auth);
    const body = await req.json().catch(() => ({}));
    const userId = role === "authenticated" ? sub : role === "service_role" ? (body.user_id ?? null) : null;
    if (!userId) return json({ error: "login", mensaje: "Inicia sesión en FirmaVB." }, 401);
    const codigo = String(body.codigo ?? "").trim().toUpperCase();
    if (!/^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2}$/.test(codigo)) return json({ error: "codigo", mensaje: "Indica el ID de la licitación (ej. 2699-35-LE26)." }, 400);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Reconstruye todos los anexos con los datos de la empresa (mismo motor de "Anexos
    // completados"): reutiliza experto-anexos para no duplicar el prompt ni la lectura de bases.
    // Se reenvía el MISMO Authorization que llegó (del usuario autenticado, o del llamador
    // service_role): la clave de servicio nueva (sb_secret_...) no es un JWT, así que no sirve
    // como token de otra función; el que ya llegó aquí sí fue validado por el gateway.
    const innerBody = role === "authenticated" ? { codigo } : { codigo, user_id: userId };
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/experto-anexos`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(innerBody),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return json(j, r.status); // mismo mensaje/estado que "Anexos completados" (Plus, datos, sin bases...)
    const contenido = String(j.contenido ?? "");
    if (!contenido.trim()) return json({ error: "sin_anexos", mensaje: "No se generó contenido para extraer." }, 422);

    // 2. Separa en anexos individuales (el prompt de experto-anexos ya los separa con "---").
    const bloques = contenido.split(/\n\s*-{3,}\s*\n/).map((b) => b.trim()).filter((b) => b.length > 40);
    if (!bloques.length) return json({ error: "sin_anexos", mensaje: "Las bases no traen anexos identificables para extraer." }, 422);

    // 3. Cupo de documentos del plan (mismo límite que "Mis documentos de trabajo").
    const { data: cupoData } = await sb.rpc("experto_documentos_cupo", { p_user_id: userId, p_codigo: codigo });
    const cupo = cupoData?.[0] ?? { plan: "free", usados: 0, maximo: 2, max_mb: 5 };
    const { data: existentes } = await sb.rpc("experto_documentos_listar", { p_user_id: userId, p_codigo: codigo });
    const porNombre = new Map<string, string>((existentes ?? []).map((d: any) => [d.nombre, d.id]));
    let usados = Number(cupo.usados);

    const resultado: { numero: string; nombre: string; documento_id: string }[] = [];
    let omitidos = 0;
    let n = 0;
    for (const bloque of bloques) {
      n++;
      const m = /^#{0,2}\s*ANEXO\s*N[°ºo.]?\s*(\d+)/i.exec(bloque);
      const numero = m ? m[1] : String(n);
      const nombre = `EXTRAIDO_Anexo_N_${numero}.docx`;
      const esNuevo = !porNombre.has(nombre);
      if (esNuevo && usados >= Number(cupo.maximo)) { omitidos++; continue; }

      const idViejo = porNombre.get(nombre);
      if (idViejo) { try { const { data: path } = await sb.rpc("experto_documento_borrar", { p_user_id: userId, p_id: idViejo }); if (path) await sb.storage.from(BUCKET).remove([String(path)]); } catch { /* sigue igual */ } }

      const bytes = await markdownADocx(bloque);
      const storage_path = `${userId}/${codigo}/${nombre}`;
      const up = await sb.storage.from(BUCKET).upload(storage_path, bytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });
      if (up.error) { omitidos++; continue; }
      const { data: id } = await sb.rpc("experto_documento_insertar", { p_user_id: userId, p_codigo: codigo, p_nombre: nombre, p_tipo: "docx", p_storage_path: storage_path, p_texto: bloque.slice(0, 20000) });
      if (esNuevo) usados++;
      resultado.push({ numero, nombre, documento_id: String(id) });
    }

    return json({ ok: true, codigo, anexos: resultado, omitidos_por_cupo: omitidos, faltantes: j.faltantes ?? [] });
  } catch (e) { return json({ error: String((e as Error)?.message ?? e) }, 500); }
});
