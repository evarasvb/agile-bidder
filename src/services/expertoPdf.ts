// PDF con marca FirmaVB de un análisis del Experto (informe, estudio, anexos, respuesta del chat).
// Se usa para mandarlo por WhatsApp como archivo: en celular se comparte directo, en escritorio se descarga.
import jsPDF from 'jspdf';
import logoBlanco from '@/assets/logo-firmavb-blanco.png';

export interface DatosPdfExperto { titulo: string; empresa?: string | null; contenido: string; url?: string; fecha?: string | null }

async function aDataUrl(url: string): Promise<string | null> {
  try {
    const b = await (await fetch(url)).blob();
    return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => ok(null); r.readAsDataURL(b); });
  } catch { return null; }
}

type Linea = { tipo: 'h1' | 'h2' | 'p' | 'li' | 'sep'; t: string };
// Markdown mínimo del Experto a líneas planas (sin negritas, links ni tablas).
function aLineas(md: string): Linea[] {
  const limpio = (s: string) => s.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
  const out: Linea[] = [];
  for (const raw of md.replace(/\r/g, '').split('\n')) {
    const l = raw.trim();
    if (!l) continue;
    if (/^\|?\s*:?-{2,}/.test(l)) continue;                       // separador de tabla
    if (/^(-{3,}|\*{3,})$/.test(l)) { out.push({ tipo: 'sep', t: '' }); continue; }
    if (l.startsWith('|')) { out.push({ tipo: 'li', t: l.split('|').map(limpio).filter(Boolean).join(' · ') }); continue; }
    const h = l.match(/^(#{1,6})\s+(.*)/);
    if (h) { out.push({ tipo: h[1].length <= 2 ? 'h1' : 'h2', t: limpio(h[2]) }); continue; }
    const li = l.match(/^(?:[-*•]|\d+[.)])\s+(.*)/);
    if (li) { out.push({ tipo: 'li', t: limpio(li[1]) }); continue; }
    out.push({ tipo: 'p', t: limpio(l) });
  }
  return out;
}

export async function crearPdfExperto(d: DatosPdfExperto): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 16, ANCHO = W - 2 * M, PIE = 282;
  const empresa = d.empresa || 'un proveedor';
  const logo = await aDataUrl(logoBlanco);
  let y = 0, pagina = 1;
  const cabecera = () => {
    doc.setFillColor(27, 37, 64); doc.rect(0, 0, W, 24, 'F');
    if (logo) { try { doc.addImage(logo, 'PNG', M, 5, 30, 14); } catch { /* sin logo */ } }
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Experto FirmaVB', W - M, 11, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text('Ley 19.886 · dictámenes CGR · datos vivos de Mercado Público', W - M, 17, { align: 'right' });
    y = 34;
  };
  const pie = () => {
    doc.setDrawColor(220); doc.line(M, PIE - 4, W - M, PIE - 4);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120);
    doc.text(`firmavb.cl · Hecho por ${empresa} con el Experto FirmaVB${d.url ? ' · ' + d.url : ''}`, M, PIE);
    doc.text(String(pagina), W - M, PIE, { align: 'right' });
    doc.setFontSize(6.5); doc.text('Generado con fuentes públicas y datos de Mercado Público; no reemplaza la lectura de las bases.', M, PIE + 4);
  };
  const espacio = (h: number) => { if (y + h > PIE - 8) { pie(); doc.addPage(); pagina++; cabecera(); } };

  cabecera();
  doc.setTextColor(27, 37, 64); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  for (const t of doc.splitTextToSize(d.titulo, ANCHO) as string[]) { espacio(7); doc.text(t, M, y); y += 7; }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110);
  doc.text(`Hecho por ${empresa} con el Experto FirmaVB · ${new Date(d.fecha ?? Date.now()).toLocaleDateString('es-CL')}`, M, y); y += 8;

  for (const l of aLineas(d.contenido)) {
    if (l.tipo === 'sep') { espacio(4); doc.setDrawColor(225); doc.line(M, y, W - M, y); y += 4; continue; }
    const esH = l.tipo === 'h1' || l.tipo === 'h2';
    doc.setFont('helvetica', esH ? 'bold' : 'normal'); doc.setFontSize(l.tipo === 'h1' ? 12.5 : l.tipo === 'h2' ? 11 : 10);
    doc.setTextColor(esH ? 27 : 40, esH ? 37 : 40, esH ? 64 : 40);
    const sangria = l.tipo === 'li' ? 5 : 0;
    const lineas = doc.splitTextToSize(l.t, ANCHO - sangria) as string[];
    const alto = lineas.length * (esH ? 6 : 5);
    espacio(alto + (esH ? 3 : 1));
    if (esH) y += 2;
    if (l.tipo === 'li') doc.text('•', M + 1, y);
    doc.text(lineas, M + sangria, y);
    y += alto + (esH ? 1.5 : 1.2);
  }
  pie();
  return doc.output('blob');
}

/** Comparte el PDF como archivo (celular: hoja de compartir, sale WhatsApp) o lo descarga (escritorio). */
export async function compartirPdfExperto(d: DatosPdfExperto, archivo: string): Promise<'compartido' | 'descargado'> {
  const blob = await crearPdfExperto(d);
  const file = new File([blob], archivo, { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (x: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: d.titulo, text: d.url ? `${d.titulo}\n${d.url}` : d.titulo }); return 'compartido'; } catch { /* cancelado: cae a descarga */ }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = archivo; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return 'descargado';
}
