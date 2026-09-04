// Experto FirmaVB — completa un ANEXO WORD OFICIAL (subido como fuente) con los datos de la
// empresa conservando el formato del documento (tablas, estilos, numeración). Lo que la empresa
// debe validar o decidir queda en AMARILLO. Nunca firma ni marca declaraciones.
//   POST   {codigo, documento_id} -> BORRADOR_<nombre>.docx en el bucket + link de descarga (Plus o ERP)
//   GET    ?codigo=XXXX           -> anexos completados con link de descarga (1 hora)
//   DELETE ?id=uuid               -> borra el anexo completado
import { createClient } from "jsr:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};
const BUCKET = "documentos-trabajo";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODELOS = [Deno.env.get("GEMINI_MODEL_INFORME"), "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite"].filter(Boolean) as string[];
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
function rolYSub(auth: string): { role: string; sub: string | null } {
  try { const p = JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return { role: p.role ?? "", sub: p.sub ?? null }; }
  catch { return { role: "", sub: null }; }
}
const decodeXml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const textoDe = (xml: string) => (xml.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g) ?? [])
  .map((t) => t === "<w:tab/>" ? " " : t === "<w:br/>" ? "\n" : decodeXml(t.replace(/^<w:t[^>]*>/, "").replace(/<\/w:t>$/, ""))).join("");
const rutFmt = (r: any) => { const s = String(r ?? "").replace(/[^0-9kK]/g, "").toUpperCase(); if (s.length < 2) return String(r ?? ""); const c = s.slice(0, -1), d = s.slice(-1); return c.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + d; };

// Párrafos de nivel superior (sin entrar a cuadros de texto): posición, texto y contexto de la fila si van en una tabla.
type Ranura = { i: number; ini: number; fin: number; texto: string; celda: boolean; fila: string };
function ranuras(doc: string): Ranura[] {
  const out: Ranura[] = []; const re = /<(\/?)w:p(?=[\s>\/])([^>]*)>/g; let m: RegExpExecArray | null; let prof = 0; let ini = -1;
  while ((m = re.exec(doc))) {
    const cierra = m[1] === "/"; const auto = m[2].endsWith("/");
    if (!cierra && auto) { if (prof === 0) out.push({ i: out.length, ini: m.index, fin: m.index + m[0].length, texto: "", celda: false, fila: "" }); continue; }
    if (!cierra) { if (prof === 0) ini = m.index; prof++; }
    else { prof--; if (prof === 0 && ini >= 0) { out.push({ i: out.length, ini, fin: m.index + m[0].length, texto: textoDe(doc.slice(ini, m.index)), celda: false, fila: "" }); ini = -1; } }
  }
  for (const r of out) {
    const tr = doc.lastIndexOf("<w:tr", r.ini), trFin = doc.indexOf("</w:tr>", r.ini), tbl = doc.lastIndexOf("</w:tbl>", r.ini);
    if (tr >= 0 && trFin >= 0 && tr > tbl) { r.celda = true; r.fila = textoDe(doc.slice(tr, trFin)).replace(/\s+/g, " ").slice(0, 240); }
  }
  return out;
}
// Reemplaza el texto de un párrafo conservando su formato (pPr y rPr del primer run).
function rellenar(xml: string, texto: string, validar: boolean): string {
  const auto = /\/>$/.test(xml) && !/<\/w:p>$/.test(xml);
  const open = auto ? xml.replace(/\/>$/, ">") : (xml.match(/^<w:p(?:\s[^>]*)?>/)?.[0] ?? "<w:p>");
  const pPr = auto ? "" : (xml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? "");
  let rPr = auto ? "" : (xml.match(/<w:r(?:\s[^>]*)?>\s*(<w:rPr>[\s\S]*?<\/w:rPr>)/)?.[1] ?? "");
  rPr = rPr.replace(/<w:highlight[^>]*\/>/g, "");
  if (validar) rPr = rPr ? rPr.replace("</w:rPr>", '<w:highlight w:val="yellow"/></w:rPr>') : '<w:rPr><w:highlight w:val="yellow"/></w:rPr>';
  const partes = texto.split("\n").map((t) => `<w:t xml:space="preserve">${escXml(t)}</w:t>`).join("<w:br/>");
  return `${open}${pPr}<w:r>${rPr}${partes}</w:r></w:p>`;
}

const SYS = `Eres el Experto FirmaVB, asesor con 17 años vendiéndole al Estado chileno. Completas un ANEXO OFICIAL de una licitación (documento Word) con los DATOS DE LA EMPRESA, sin cambiar el formato ni el texto legal. Recibes: datos de la empresa, la ficha de la licitación con sus ítems, lo que las BASES dicen de ese anexo, la matriz de postulación del proveedor (si existe) y las ranuras del documento numeradas (i), con su texto actual, si están en una celda de tabla y el texto completo de su fila.
Primero entiende QUÉ anexo es (identificación, declaración jurada, pacto de integridad, oferta económica, oferta técnica, experiencia, UTP, otro) y si APLICA a este proveedor según las bases (p. ej. un anexo solo para Unión Temporal de Proveedores no aplica si postula solo; un anexo por categoría solo si oferta esa categoría).
Responde SOLO con JSON válido: {"tipo":"identificacion|declaracion_jurada|pacto_integridad|oferta_economica|oferta_tecnica|experiencia|utp|otro","aplica":true|false,"motivo":"1 frase: por qué aplica o no","resumen":"1 frase: qué completaste y qué queda pendiente","cambios":[{"i":número,"texto":"texto completo nuevo de la ranura","validar":true|false}]}.
Reglas:
- Oferta económica: usa los ÍTEMS de la ficha (producto, cantidad, unidad) para llenar las filas de la tabla si el anexo las pide y están vacías; precios y totales siempre [[PRECIO NETO]], [[TOTAL]] con "validar": true. Si el proveedor no oferta todas las líneas, deja N/A en las que no (según la matriz o los documentos).
- Oferta técnica: responde con las palabras de las bases técnicas (plazo de entrega, garantía, soporte) solo si las bases fijan el valor exigido; el compromiso concreto del proveedor va como [[PLAZO DE ENTREGA]], [[GARANTÍA EN MESES]] con "validar": true. Nunca prometas por él.
- Experiencia: no inventes contratos ni clientes; filas como [[CLIENTE]] | [[CONTRATO]] | [[MONTO]] | [[AÑO]] con "validar": true, o lo que digan sus documentos.
- "aplica": false SOLO si el propio anexo dice que es exclusivo para Unión Temporal de Proveedores, que lo completa la entidad compradora, o es un formato de contrato que se firma después de adjudicar; en ese caso cambios vacío. Ante la duda, aplica y se completa.
- Rellena solo lo que sabes con certeza por los datos entregados: razón social, RUT, domicilio, comuna y región, correo, teléfono, nombre y RUT del representante legal, ID y nombre de la licitación, organismo comprador. Si el anexo pide marcar persona natural o jurídica, marca con "X" la opción persona jurídica.
- Celda vacía junto a una etiqueta (fila "Razón social | "): pon solo el valor. Etiqueta y valor en la misma ranura ("Razón social: ________"): devuelve la etiqueta con el valor ("Razón social: FIRMAVB SPA"). Conserva los dos puntos, numeración y el resto del texto de la ranura.
- Lo que NO sabes (precio, plazo de entrega, garantía, experiencia, montos, cantidades, fecha y lugar de firma, nombre del contacto técnico, certificaciones) va como marcador [[EN MAYÚSCULAS]] con "validar": true. Nunca inventes cifras, experiencia ni certificaciones.
- Declaraciones juradas y pacto de integridad: NO marques opciones A/B/C ni casillas de sí/no; déjalas con [[MARCAR]] y "validar": true. No escribas firmas. No toques títulos, instrucciones, textos legales ni pies de página.
- Oferta económica: montos como [[PRECIO NETO]] / [[PRECIO CON IVA]] con "validar": true, salvo que el dato venga entregado.
- Fecha de firma: "[[FECHA]]" con "validar": true. Lugar: la comuna de la empresa si se conoce.
- Solo devuelve ranuras que cambian. Máximo 80 cambios. Español chileno, mayúsculas donde el formato las use.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const t0 = Date.now();
  try {
    const { role, sub } = rolYSub(req.headers.get("Authorization") ?? "");
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const userId = role === "authenticated" ? sub : role === "service_role" ? (body.user_id ?? url.searchParams.get("user_id") ?? null) : null;
    if (!userId) return json({ error: "login", mensaje: "Inicia sesión en FirmaVB." }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const firmar = async (path: string) => (await sb.storage.from(BUCKET).createSignedUrl(path, 3600)).data?.signedUrl ?? null;

    if (req.method === "GET") {
      const codigo = String(url.searchParams.get("codigo") ?? "").trim().toUpperCase();
      const { data } = await sb.rpc("experto_anexos_word_listar", { p_user_id: userId, p_codigo: codigo });
      const anexos = await Promise.all(((data ?? []) as any[]).map(async (a) => ({ ...a, url: await firmar(a.storage_path) })));
      return json({ anexos });
    }
    if (req.method === "DELETE") {
      const id = String(url.searchParams.get("id") ?? "");
      const { data: path } = await sb.rpc("experto_anexo_word_borrar", { p_user_id: userId, p_id: id });
      if (path) await sb.storage.from(BUCKET).remove([String(path)]);
      return json({ ok: true });
    }

    const codigo = String(body.codigo ?? "").trim().toUpperCase();
    const documentoId = String(body.documento_id ?? "");
    if (!/^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2}$/.test(codigo) || !documentoId) return json({ error: "datos", mensaje: "Falta el código de la licitación o el documento." }, 400);

    // 1. Plan (Plus o FirmaVB ERP), datos de la empresa y documento
    const { data: uso } = await sb.rpc("experto_uso_mes", { p_user_id: userId, p_huella: "x" });
    const plan = String(uso?.[0]?.plan ?? "free");
    const { data: cli } = await sb.from("clientes").select("id, empresa_nombre, rut, direccion, telefono, email, region, giros, representante_nombre, representante_rut, plan, activo").eq("user_id", userId).maybeSingle();
    const conPlus = plan === "plus" || (cli?.activo && ["pro", "business", "enterprise"].includes(String(cli?.plan)));
    if (!conPlus) return json({ error: "plus", mensaje: "Completar anexos Word es parte del Experto Plus ($100.000 por 30 días) o del plan FirmaVB ERP.", plan }, 402);
    if (!cli?.empresa_nombre || !cli?.rut || !cli?.representante_nombre) return json({ error: "datos", mensaje: "Antes completa en Mi empresa: razón social, RUT y representante legal." }, 428);
    const { data: docs } = await sb.rpc("experto_documento_ruta", { p_user_id: userId, p_id: documentoId });
    const doc = docs?.[0];
    if (!doc?.storage_path) return json({ error: "documento", mensaje: "No encuentro ese documento entre tus fuentes." }, 404);
    if (doc.tipo !== "docx") return json({ error: "formato", mensaje: "Solo puedo completar archivos Word (.docx). Los PDF los lleno como texto en Anexos." }, 415);
    const bajado = await sb.storage.from(BUCKET).download(doc.storage_path);
    if (bajado.error || !bajado.data) return json({ error: "storage", mensaje: "No pude leer el archivo." }, 500);
    const zip = await JSZip.loadAsync(new Uint8Array(await bajado.data.arrayBuffer()));
    const xml = await zip.file("word/document.xml")?.async("string");
    if (!xml) return json({ error: "formato", mensaje: "El Word no trae contenido legible." }, 415);

    // 2. Ranuras del documento + contexto: ficha con ítems, lo que las bases dicen de ESTE anexo, matriz y documentos
    const rs = ranuras(xml);
    const lista = rs.map((r) => `${r.i}|${r.celda ? "celda" : "parrafo"}|${r.fila}|${r.texto.replace(/\s+/g, " ").slice(0, 300)}`).join("\n").slice(0, 60_000);
    const [fichaR, basesR, entregR, docsR] = await Promise.all([
      sb.rpc("experto_ficha_licitacion", { p_codigo: codigo }),
      sb.rpc("experto_bases_texto", { p_codigo: codigo }),
      sb.rpc("experto_entregables_texto", { p_user_id: userId, p_codigo: codigo }),
      sb.rpc("experto_documentos_texto", { p_user_id: userId, p_codigo: codigo, p_max: 3000 }),
    ]);
    const ficha = fichaR.data;
    const numAnexo = (String(doc.nombre).match(/anexo[\s_]*n?[°º]?[\s_]*(\d+)/i) ?? [])[1] ?? null;
    const titulo = textoDe(xml).replace(/\s+/g, " ").slice(0, 160);
    const reAnexo = numAnexo ? new RegExp(`anexo\\s*n?[°º.]?\\s*${numAnexo}\\b`, "i") : null;
    const secs = ((basesR.data ?? []) as any[]).flatMap((b) => Array.isArray(b.secciones) ? b.secciones : [])
      .filter((s: any) => reAnexo ? reAnexo.test(String(s.titulo) + " " + String(s.texto)) : /anexo|contenido de la oferta|admisib/i.test(String(s.titulo)))
      .slice(0, 6).map((s: any) => `## ${s.titulo}\n${String(s.texto).slice(0, 2500)}`).join("\n\n");
    const matrizTxt = ((entregR.data ?? []) as any[]).find((e) => e.modo === "matriz")?.respuesta;
    let matrizCtx = "";
    try { const m = JSON.parse(matrizTxt ?? "null"); if (m) matrizCtx = `MATRIZ DE POSTULACIÓN DEL PROVEEDOR (resumen): ${m.resumen ?? ""}\nAnexos según la matriz: ${(m.anexos ?? []).map((a: any) => `${a.anexo} (${a.cuando ?? "siempre"})`).join("; ")}\nAdmisibilidad con dato del proveedor: ${(m.admisibilidad ?? []).filter((a: any) => a.entrada).map((a: any) => `${a.requisito}: ${a.entrada}`).join("; ") || "sin datos"}`; } catch { /* sin matriz */ }
    const docsCtx = ((docsR.data ?? []) as any[]).filter((d) => d.id !== documentoId && d.tipo !== "docx").slice(0, 3).map((d) => `### ${d.nombre}\n${String(d.texto).slice(0, 1500)}`).join("\n\n");
    const items = (ficha?.items ?? []).slice(0, 40).map((i: any, n: number) => `${n + 1}. ${i.producto}${i.cantidad ? ` | cantidad ${i.cantidad} ${i.unidad ?? ""}` : ""}${i.descripcion ? ` | ${String(i.descripcion).slice(0, 120)}` : ""}`).join("\n");
    const datos = `DATOS DE LA EMPRESA (FirmaVB):
Razón social: ${cli.empresa_nombre} | RUT: ${rutFmt(cli.rut)} | Domicilio: ${cli.direccion ?? "[[DOMICILIO]]"} | Región: ${cli.region ?? "[[REGIÓN]]"}
Giros: ${Array.isArray(cli.giros) ? cli.giros.join(", ") : cli.giros ?? "s/i"} | Correo: ${cli.email ?? "[[CORREO]]"} | Teléfono: ${cli.telefono || "[[TELÉFONO]]"}
Representante legal: ${cli.representante_nombre} | RUT representante: ${rutFmt(cli.representante_rut)}
Postula solo (no en UTP) salvo que sus documentos digan lo contrario.

LICITACIÓN ${codigo}: ${ficha?.nombre ?? ""} | Organismo: ${ficha?.institucion ?? ""} | Tipo: ${ficha?.tipo ?? "s/i"} | Presupuesto: ${ficha?.presupuesto ?? "s/i"} | Cierre: ${ficha?.fecha_cierre ?? "s/i"}
ÍTEMS LICITADOS:
${items || "s/i"}

LO QUE DICEN LAS BASES DE ESTE ANEXO${numAnexo ? ` (N° ${numAnexo})` : ""}:
${secs || "(las bases no traen texto específico de este anexo)"}

${matrizCtx}

${docsCtx ? "OTROS DOCUMENTOS DEL PROVEEDOR:\n" + docsCtx : ""}

RANURAS DEL ANEXO "${doc.nombre}" (título: ${titulo}) (i|tipo|texto de la fila|texto actual):
${lista}`;
    const key = Deno.env.get("GEMINI_API_KEY"); if (!key) return json({ error: "sin_ia" }, 500);
    let cambios: any[] | null = null; let meta: any = {};
    for (const model of [...MODELOS, "espera", ...MODELOS]) {
      if (model === "espera") { await new Promise((ok) => setTimeout(ok, 2500)); continue; }
      const r = await fetch(GEMINI_URL, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0.1, max_tokens: 8000, messages: [{ role: "system", content: SYS }, { role: "user", content: datos + "\n\nCompleta el anexo." }] }) });
      if (!r.ok) { console.error("gemini", model, r.status); continue; }
      let c = String((await r.json()).choices?.[0]?.message?.content ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const a = c.indexOf("{"), z = c.lastIndexOf("}"); if (a >= 0 && z > a) c = c.slice(a, z + 1);
      try { const j = JSON.parse(c); if (Array.isArray(j.cambios)) { cambios = j.cambios; meta = { tipo: j.tipo ?? null, aplica: j.aplica !== false, motivo: j.motivo ?? "", resumen: j.resumen ?? "" }; break; } } catch { console.error("json", model); }
      // JSON cortado (anexos largos): se rescatan los cambios completos uno a uno.
      const rescatados = [...c.matchAll(/\{\s*"i"\s*:\s*(\d+)\s*,\s*"texto"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"validar"\s*:\s*(true|false)\s*\}/g)]
        .map((m) => { try { return { i: Number(m[1]), texto: JSON.parse(`"${m[2]}"`), validar: m[3] === "true" }; } catch { return null; } }).filter(Boolean);
      if (rescatados.length) {
        const campo = (k: string) => (c.match(new RegExp(`"${k}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`)) ?? [])[1] ?? "";
        cambios = rescatados as any[]; meta = { tipo: campo("tipo") || null, aplica: !/"aplica"\s*:\s*false/.test(c), motivo: campo("motivo"), resumen: campo("resumen") || "Respuesta larga: se aplicaron los cambios completos." }; break;
      }
    }
    if (!cambios) return json({ error: "ia_no_disponible", mensaje: "El modelo no respondió bien. Intenta de nuevo en un minuto." }, 502);
    // "No aplica" solo si el propio anexo lo dice (UTP, formulario del comprador); si no, se completa igual y se avisa.
    const textoDoc = textoDe(xml);
    const condicional = /uni[oó]n temporal|\bUTP\b|uso exclusivo|entidad compradora|para ser llenado por/i.test(textoDoc);
    if (!meta.aplica && (condicional || !cambios.length)) return json({ ok: true, aplica: false, tipo: meta.tipo, motivo: meta.motivo, nombre: doc.nombre, mensaje: `Este anexo no aplica: ${meta.motivo}` });
    if (!meta.aplica) meta.resumen = `Revisar si aplica (${meta.motivo}). ${meta.resumen}`;

    // 3. Aplicar de atrás hacia adelante para no mover posiciones
    const porIndice = new Map<number, { texto: string; validar: boolean }>();
    for (const c of cambios) { const i = Number(c?.i); const t = String(c?.texto ?? ""); if (Number.isInteger(i) && rs[i] && t.trim() && t !== rs[i].texto) porIndice.set(i, { texto: t, validar: !!c.validar || /\[\[[^\]]+\]\]/.test(t) }); }
    let nuevo = xml; let aplicados = 0; const campos: { texto: string; validar: boolean }[] = [];
    for (const r of [...rs].sort((a, b) => b.ini - a.ini)) {
      const c = porIndice.get(r.i); if (!c) continue;
      nuevo = nuevo.slice(0, r.ini) + rellenar(nuevo.slice(r.ini, r.fin), c.texto, c.validar) + nuevo.slice(r.fin);
      aplicados++; campos.push({ texto: c.texto.slice(0, 160), validar: c.validar });
    }
    if (!aplicados) return json({ error: "sin_cambios", mensaje: meta.resumen || "No encontré campos que completar en ese anexo." }, 422);
    zip.file("word/document.xml", nuevo);
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const nombre = "BORRADOR_" + String(doc.nombre).replace(/^BORRADOR_/i, "").replace(/\s+/g, "_");
    const storage_path = `${userId}/${codigo}/${nombre}`;
    const up = await sb.storage.from(BUCKET).upload(storage_path, bytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });
    if (up.error) return json({ error: "storage", mensaje: up.error.message }, 500);
    const validar = campos.filter((c) => c.validar).length;
    const { data: id } = await sb.rpc("experto_anexo_word_insertar", { p_user_id: userId, p_codigo: codigo, p_documento_id: documentoId, p_nombre: nombre, p_storage_path: storage_path, p_campos_validar: validar, p_campos: [{ tipo: meta.tipo, resumen: meta.resumen }, ...campos.reverse()] });
    return json({ ok: true, aplica: true, id, nombre, tipo: meta.tipo, resumen: meta.resumen, storage_path, url: await firmar(storage_path), cambios: aplicados, campos_validar: validar, campos, ms: Date.now() - t0 });
  } catch (e) { return json({ error: String((e as Error)?.message ?? e) }, 500); }
});
