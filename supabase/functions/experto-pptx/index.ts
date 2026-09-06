// Experto FirmaVB — genera un PowerPoint (.pptx) real con la matriz de postulación de una
// licitación: portada, resumen y fechas, admisibilidad, evaluación, tareas por fase, garantías
// y pendientes que debe validar la empresa. Mismo criterio que "Extraer anexos de las bases":
// reutiliza experto-matriz (reenviando el mismo Authorization) para no duplicar el prompt ni la
// lectura de bases, y guarda el resultado en "Mis documentos de trabajo" (experto_documentos).
//   POST {codigo} -> { ok, documento_id, nombre }
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
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------------------------------------------------------------------------------------
// Constructor mínimo de .pptx (OOXML) a mano con jszip, mismo espíritu que el de experto-anexo-word
// para .docx: sin librerías de PowerPoint. Un solo slideMaster + un solo slideLayout ("Blank",
// boilerplate estándar de PowerPoint) y slides con formas de texto/tablas posicionadas a mano.
// Validado localmente: se generó un archivo de prueba con esta misma estructura y se abrió sin
// errores con python-pptx (lectura de texto y tablas), igual que se validó el .docx con
// zipfile/minidom cuando LibreOffice no está disponible para render en este entorno.
// ---------------------------------------------------------------------------------------------
const EMU_IN = 914400;
const IN = (n: number) => Math.round(n * EMU_IN);
const SLIDE_W = IN(13.333);
const SLIDE_H = IN(7.5);
const AZUL = "1E40AF";
const AZUL_OSC = "0F2A6B";
const GRIS_CLARO = "F2F5FB";

let shapeId = 1;
function nextId() { return ++shapeId; }

function rect(x: number, y: number, w: number, h: number, fill: string): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${nextId()}" name="rect"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;
}

interface Run { text: string; size?: number; bold?: boolean; color?: string; }
function textBox(x: number, y: number, w: number, h: number, runs: Run[], opts: { align?: "l" | "ctr"; anchor?: "t" | "ctr"; bullets?: boolean } = {}): string {
  const align = opts.align ?? "l";
  const anchor = opts.anchor ?? "t";
  const paras = runs.map((r) => {
    const sz = (r.size ?? 14) * 100;
    const bold = r.bold ? ' b="1"' : "";
    const color = r.color ?? "1A1A1A";
    const pPr = opts.bullets
      ? `<a:pPr marL="228600" indent="-228600" algn="${align}"><a:buFont typeface="Arial"/><a:buChar char="&#8226;"/></a:pPr>`
      : `<a:pPr algn="${align}"><a:buNone/></a:pPr>`;
    return `<a:p>${pPr}<a:r><a:rPr lang="es-CL" sz="${sz}"${bold} dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${esc(r.text)}</a:t></a:r></a:p>`;
  }).join("");
  return `<p:sp><p:nvSpPr><p:cNvPr id="${nextId()}" name="tx"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" anchor="${anchor}"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`;
}

function tableShape(x: number, y: number, w: number, rowH: number, header: string[], rows: string[][]): string {
  const ncols = header.length;
  const colw = Math.floor(w / ncols);
  const cell = (text: string, bold: boolean, color: string, fill: string | null) =>
    `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="es-CL" sz="1100"${bold ? ' b="1"' : ""}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${esc(text)}</a:t></a:r></a:p></a:txBody>` +
    `<a:tcPr marL="45720" marR="45720" marT="22860" marB="22860" anchor="ctr">${fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : ""}</a:tcPr></a:tc>`;
  const trHeader = `<a:tr h="${rowH}">${header.map((h) => cell(h, true, "FFFFFF", AZUL)).join("")}</a:tr>`;
  const trRows = rows.map((row, i) => `<a:tr h="${rowH}">${row.map((c) => cell(c, false, "1A1A1A", i % 2 === 0 ? GRIS_CLARO : "FFFFFF")).join("")}</a:tr>`).join("");
  const gridCols = header.map(() => `<a:gridCol w="${colw}"/>`).join("");
  const tblH = rowH * (rows.length + 1);
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${nextId()}" name="tabla"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>` +
    `<p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${tblH}"/></p:xfrm>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>` +
    `<a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId></a:tblPr>` +
    `<a:tblGrid>${gridCols}</a:tblGrid>${trHeader}${trRows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

function slideXml(shapes: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
    shapes + `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

// Encabezado azul + título, común a todas las slides de contenido (no portada).
function encabezado(titulo: string): string {
  return rect(0, 0, SLIDE_W, IN(0.9), AZUL_OSC) +
    textBox(IN(0.5), IN(0.12), SLIDE_W - IN(1), IN(0.7), [{ text: titulo, size: 24, bold: true, color: "FFFFFF" }], { anchor: "ctr" });
}
function pie(texto: string): string {
  return textBox(IN(0.5), SLIDE_H - IN(0.4), SLIDE_W - IN(1), IN(0.3), [{ text: texto, size: 9, color: "94A3B8" }]);
}

// ---- Partes estáticas del paquete OOXML (theme/master/layout: boilerplate estándar de
// PowerPoint, un solo layout "Blank" — verificado con python-pptx). ----
const THEME_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="FirmaVB"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2><a:accent1><a:srgbClr val="1E40AF"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2><a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="8064A2"/></a:accent4><a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6><a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="35000"><a:schemeClr val="phClr"><a:tint val="37000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="15000"/><a:satMod val="350000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="1"/></a:gradFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="100000"/><a:shade val="100000"/><a:satMod val="130000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="50000"/><a:shade val="100000"/><a:satMod val="350000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="0"/></a:gradFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"><a:shade val="95000"/><a:satMod val="105000"/></a:schemeClr></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="25400" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="38100" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;

const MASTER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;
const MASTER_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`;

const LAYOUT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
const LAYOUT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;

const PRES_PROPS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`;
const VIEW_PROPS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:normalViewPr/></p:viewPr>`;
const TABLE_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`;
const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
const CORE_XML = (titulo: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(titulo)}</dc:title><dc:creator>Experto FirmaVB</dc:creator><cp:revision>1</cp:revision><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified></cp:coreProperties>`;
const APP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>FirmaVB</Application></Properties>`;

async function construirPptx(slides: string[], titulo: string): Promise<Uint8Array> {
  const zip = new JSZip();
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("") +
    `</Types>`;
  const presentation = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst><p:sldIdLst>` +
    slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rIdSlide${i + 1}"/>`).join("") +
    `</p:sldIdLst><p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  const presRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rIdTheme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rIdPresProps" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/><Relationship Id="rIdViewProps" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/><Relationship Id="rIdTableStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/>` +
    slides.map((_, i) => `<Relationship Id="rIdSlide${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join("") +
    `</Relationships>`;
  const slideRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;

  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", ROOT_RELS);
  zip.file("docProps/core.xml", CORE_XML(titulo));
  zip.file("docProps/app.xml", APP_XML);
  zip.file("ppt/presentation.xml", presentation);
  zip.file("ppt/_rels/presentation.xml.rels", presRels);
  zip.file("ppt/presProps.xml", PRES_PROPS);
  zip.file("ppt/viewProps.xml", VIEW_PROPS);
  zip.file("ppt/tableStyles.xml", TABLE_STYLES);
  zip.file("ppt/theme/theme1.xml", THEME_XML);
  zip.file("ppt/slideMasters/slideMaster1.xml", MASTER_XML);
  zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", MASTER_RELS);
  zip.file("ppt/slideLayouts/slideLayout1.xml", LAYOUT_XML);
  zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", LAYOUT_RELS);
  slides.forEach((s, i) => {
    zip.file(`ppt/slides/slide${i + 1}.xml`, slideXml(s));
    zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, slideRels);
  });
  return await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

// ---------------------------------------------------------------------------------------------
// Contenido: arma las slides a partir de la matriz de postulación (JSON estructurado que ya
// genera experto-matriz) y la ficha de la licitación.
// ---------------------------------------------------------------------------------------------
const MX = SLIDE_W - IN(1); // ancho de contenido (márgenes de 0.5in a cada lado)

function slidePortada(m: any, codigo: string, ficha: any): string {
  let s = rect(0, 0, SLIDE_W, SLIDE_H, AZUL_OSC);
  s += rect(0, IN(4.3), SLIDE_W, IN(0.06), "34D399");
  s += textBox(IN(0.8), IN(2.2), SLIDE_W - IN(1.6), IN(1.6), [{ text: m.titulo || `Matriz de postulación · ${codigo}`, size: 32, bold: true, color: "FFFFFF" }]);
  const inst = ficha?.institucion ? String(ficha.institucion) : "";
  s += textBox(IN(0.8), IN(3.5), SLIDE_W - IN(1.6), IN(0.6), [{ text: [codigo, inst].filter(Boolean).join(" · "), size: 16, color: "BFDBFE" }]);
  s += textBox(IN(0.8), IN(4.6), SLIDE_W - IN(1.6), IN(1.2), [{ text: String(m.resumen ?? ""), size: 14, color: "E5E7EB" }]);
  s += textBox(IN(0.8), SLIDE_H - IN(0.7), SLIDE_W - IN(1.6), IN(0.4), [{ text: `Generado por el Experto FirmaVB · ${new Date().toLocaleDateString("es-CL")} · Borrador, validar antes de postular`, size: 10, color: "94A3B8" }]);
  return s;
}

function slideResumenFechas(m: any, ficha: any): string {
  let s = encabezado("Resumen y fechas clave");
  const y0 = IN(1.2);
  s += textBox(IN(0.5), y0, MX, IN(1.3), [{ text: String(m.resumen ?? "Sin resumen."), size: 14 }]);
  const fechas: any[] = Array.isArray(m.fechas) ? m.fechas : [];
  if (ficha?.presupuesto) fechas.unshift({ hito: "Presupuesto estimado", fecha: String(ficha.presupuesto) });
  const rows = fechas.slice(0, 8).map((f) => [String(f.hito ?? ""), String(f.fecha ?? "")]);
  if (rows.length) s += tableShape(IN(0.5), IN(2.7), MX, IN(0.42), ["Hito", "Fecha"], rows);
  if (m.umbral_adjudicacion != null) s += textBox(IN(0.5), SLIDE_H - IN(1.0), MX, IN(0.4), [{ text: `Puntaje mínimo para adjudicar: ${m.umbral_adjudicacion}`, size: 12, bold: true, color: AZUL }]);
  s += pie("Experto FirmaVB");
  return s;
}

function tablaConTope(titulo: string, header: string[], rows: string[][], max: number): string {
  let s = encabezado(titulo);
  const usados = rows.slice(0, max);
  s += tableShape(IN(0.5), IN(1.2), MX, IN(0.45), header, usados);
  if (rows.length > max) s += textBox(IN(0.5), IN(1.2) + IN(0.45) * (usados.length + 1) + IN(0.1), MX, IN(0.4), [{ text: `+ ${rows.length - max} más — el detalle completo está en la Matriz dentro de FirmaVB.`, size: 11, color: "64748B" }]);
  s += pie("Experto FirmaVB");
  return s;
}

function slideAdmisibilidad(m: any): string {
  const rows = (Array.isArray(m.admisibilidad) ? m.admisibilidad : []).map((r: any) => [String(r.requisito ?? ""), String(r.regla ?? "").slice(0, 90), String(r.estado ?? "pendiente")]);
  return tablaConTope("Admisibilidad", ["Requisito", "Regla", "Estado"], rows, 9);
}

function slideEvaluacion(m: any): string {
  const rows = (Array.isArray(m.evaluacion) ? m.evaluacion : []).map((r: any) => [String(r.criterio ?? ""), String(r.ponderacion ?? ""), String(r.que_hacer ?? "").slice(0, 80)]);
  return tablaConTope("Evaluación y puntaje", ["Criterio", "Ponderación", "Qué hacer para el máximo"], rows, 8);
}

function slideTareas(m: any): string {
  const rows = (Array.isArray(m.tareas) ? m.tareas : []).map((r: any) => [String(r.fase ?? "").replace(/^\d+\.\s*/, ""), String(r.documento ?? "").slice(0, 40), String(r.accion ?? "").slice(0, 55), String(r.estado ?? "pendiente")]);
  return tablaConTope("Tareas por fase", ["Fase", "Documento", "Acción", "Estado"], rows, 9);
}

function slideGarantias(m: any): string {
  const rows = (Array.isArray(m.garantias) ? m.garantias : []).map((r: any) => [String(r.tipo ?? ""), String(r.monto_o_porcentaje ?? ""), String(r.vigencia ?? ""), String(r.beneficiario ?? "")]);
  if (!rows.length) return tablaConTope("Garantías", ["Tipo", "Monto/%", "Vigencia", "Beneficiario"], [["Sin garantías exigidas según las bases revisadas", "", "", ""]], 5);
  return tablaConTope("Garantías", ["Tipo", "Monto/%", "Vigencia", "Beneficiario"], rows, 6);
}

function slidePendientes(m: any): string {
  let s = encabezado("Pendientes que debe validar la empresa");
  const pend: string[] = Array.isArray(m.pendientes_humanos) ? m.pendientes_humanos : [];
  const runs: Run[] = (pend.length ? pend : ["Sin pendientes detectados."]).slice(0, 8).map((t) => ({ text: String(t), size: 15 }));
  s += textBox(IN(0.5), IN(1.2), MX, IN(3.5), runs, { bullets: true });
  const seq: any[] = Array.isArray(m.secuencia_carga) ? m.secuencia_carga : [];
  if (seq.length) {
    const texto = seq.slice(0, 6).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).map((x) => `${x.orden ?? ""}. ${x.documento ?? ""} (${x.donde ?? ""})`).join("\n");
    s += textBox(IN(0.5), IN(5.0), MX, IN(1.8), [{ text: "Orden de carga en el portal:", size: 13, bold: true, color: AZUL_OSC }, { text: texto, size: 12 }]);
  }
  s += pie("Experto FirmaVB · Borrador de apoyo, valida siempre contra las bases");
  return s;
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

    // 1. Matriz de postulación: reutiliza experto-matriz (mismo motor, mismo gate de plan Pro),
    // reenviando el Authorization que llegó (la clave de servicio nueva no es un JWT válido para
    // otra función — mismo gotcha ya resuelto en experto-extraer-anexos).
    const innerBody = role === "authenticated" ? { codigo } : { codigo, user_id: userId };
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/experto-matriz`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(innerBody),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return json(j, r.status);
    const matriz = j.matriz;
    if (!matriz) return json({ error: "sin_matriz", mensaje: "No se pudo generar la matriz para este PowerPoint." }, 422);
    const ficha = await sb.rpc("experto_ficha_licitacion", { p_codigo: codigo }).then((x) => x.data).catch(() => null);

    // 2. Arma las slides.
    const slides = [
      slidePortada(matriz, codigo, ficha),
      slideResumenFechas(matriz, ficha),
      slideAdmisibilidad(matriz),
      slideEvaluacion(matriz),
      slideTareas(matriz),
      slideGarantias(matriz),
      slidePendientes(matriz),
    ];
    const bytes = await construirPptx(slides, matriz.titulo || `Matriz ${codigo}`);

    // 3. Guarda en "Mis documentos de trabajo" (mismo cupo y convención que los Word extraídos).
    const nombre = `Matriz_${codigo}.pptx`;
    const { data: cupoData } = await sb.rpc("experto_documentos_cupo", { p_user_id: userId, p_codigo: codigo });
    const cupo = cupoData?.[0] ?? { plan: "free", usados: 0, maximo: 2 };
    const { data: existentes } = await sb.rpc("experto_documentos_listar", { p_user_id: userId, p_codigo: codigo });
    const previo = (existentes ?? []).find((d: any) => d.nombre === nombre);
    if (!previo && Number(cupo.usados) >= Number(cupo.maximo)) {
      return json({ error: "cupo", mensaje: "Tu plan no tiene más espacio en \"Mis documentos de trabajo\". Borra alguno para generar el PowerPoint." }, 422);
    }
    if (previo) { try { const { data: path } = await sb.rpc("experto_documento_borrar", { p_user_id: userId, p_id: previo.id }); if (path) await sb.storage.from(BUCKET).remove([String(path)]); } catch { /* sigue igual */ } }

    const storage_path = `${userId}/${codigo}/${nombre}`;
    const up = await sb.storage.from(BUCKET).upload(storage_path, bytes, { contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", upsert: true });
    if (up.error) return json({ error: "storage", mensaje: up.error.message }, 500);
    const { data: id } = await sb.rpc("experto_documento_insertar", { p_user_id: userId, p_codigo: codigo, p_nombre: nombre, p_tipo: "pptx", p_storage_path: storage_path, p_texto: String(matriz.resumen ?? "").slice(0, 4000) });

    return json({ ok: true, codigo, documento_id: String(id), nombre, slides: slides.length });
  } catch (e) { return json({ error: String((e as Error)?.message ?? e) }, 500); }
});
