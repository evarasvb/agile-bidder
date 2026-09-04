// PDF con marca FirmaVB de un análisis del Experto (informe, estudio, anexos, respuesta del chat).
// Se usa para mandarlo por WhatsApp como archivo: en celular se comparte directo, en escritorio se descarga.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoBlanco from '@/assets/logo-firmavb-blanco.png';

export interface DatosPdfExperto { titulo: string; subtitulo?: string | null; empresa?: string | null; contenido: string; url?: string; fecha?: string | null; kpis?: { k: string; v: string }[]; veredicto?: { t: string; tono: 'ok' | 'warn' | 'bad' | 'neutral' } | null }

async function aDataUrl(url: string): Promise<string | null> {
  try {
    const b = await (await fetch(url)).blob();
    return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => ok(null); r.readAsDataURL(b); });
  } catch { return null; }
}

type Linea = { tipo: 'h1' | 'h2' | 'p' | 'li' | 'sep' | 'tabla'; t: string; filas?: string[][] };
// Helvetica no trae flechas ni símbolos: se reemplazan por texto.
const ascii = (s: string) => s.replace(/→/g, '->').replace(/←/g, '<-').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/Σ/g, 'suma').replace(/✓|✔/g, 'OK').replace(/✗|✘/g, 'X').replace(/[\u2192\u2713]/g, '');
// Markdown mínimo del Experto a líneas planas (sin negritas, links ni tablas).
function aLineas(md: string): Linea[] {
  const limpio = (s: string) => s.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
  const out: Linea[] = [];
  const lineas = md.replace(/\r/g, '').split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i].trim();
    if (!l) continue;
    if (/^\|?\s*:?-{2,}/.test(l)) continue;                       // separador de tabla suelto
    if (/^(-{3,}|\*{3,})$/.test(l)) { out.push({ tipo: 'sep', t: '' }); continue; }
    if (l.startsWith('|')) {
      const celdas = (x: string) => x.trim().replace(/^\||\|$/g, '').split('|').map((c) => ascii(limpio(c)));
      const filas: string[][] = [celdas(l)];
      while (i + 1 < lineas.length && lineas[i + 1].trim().startsWith('|')) { i++; const f = lineas[i].trim(); if (!/^\|?\s*:?-{2,}/.test(f)) filas.push(celdas(f)); }
      out.push({ tipo: 'tabla', t: '', filas }); continue;
    }
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
  const W = 210, M = 16, ANCHO = W - 2 * M, PIE = 283;
  const NAVY: [number, number, number] = [27, 37, 64], GRIS: [number, number, number] = [110, 110, 110], TEXTO: [number, number, number] = [45, 45, 45], SUAVE: [number, number, number] = [243, 244, 248];
  const empresa = d.empresa || 'un proveedor';
  const logo = await aDataUrl(logoBlanco);
  let y = 0, pagina = 1;
  const conPie = new Set<number>();
  const cabecera = () => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 24, 'F');
    if (logo) { try { doc.addImage(logo, 'PNG', M, 5, 30, 14); } catch { /* sin logo */ } }
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Experto FirmaVB', W - M, 11, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text('Ley 19.886 · dictámenes CGR · datos vivos de Mercado Público', W - M, 17, { align: 'right' });
    y = 33;
  };
  const pie = () => {
    if (conPie.has(pagina)) return; conPie.add(pagina);
    doc.setDrawColor(225); doc.line(M, PIE - 5, W - M, PIE - 5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRIS);
    doc.text(`firmavb.cl · Hecho por ${empresa} con el Experto FirmaVB`, M, PIE);
    doc.text(`${pagina}`, W - M, PIE, { align: 'right' });
    doc.setFontSize(6.5); doc.text('Generado con fuentes públicas y datos de Mercado Público; no reemplaza la lectura de las bases.', M, PIE + 4);
  };
  const salto = () => { pie(); doc.addPage(); pagina++; cabecera(); };
  const espacio = (h: number) => { if (y + h > PIE - 10) salto(); };
  const parrafo = (t: string, size: number, color: [number, number, number], estilo: 'normal' | 'bold' = 'normal', sangria = 0, alto = 5) => {
    doc.setFont('helvetica', estilo); doc.setFontSize(size); doc.setTextColor(...color);
    const lineas = doc.splitTextToSize(ascii(t), ANCHO - sangria) as string[];
    for (const l of lineas) { espacio(alto); doc.text(l, M + sangria, y); y += alto; }
  };

  // Portada compacta: título, subtítulo, autor y tarjetas con las cifras clave
  cabecera();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...NAVY);
  for (const t of doc.splitTextToSize(ascii(d.titulo), ANCHO) as string[]) { doc.text(t, M, y); y += 7.5; }
  if (d.subtitulo) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...GRIS); for (const t of doc.splitTextToSize(ascii(d.subtitulo), ANCHO) as string[]) { doc.text(t, M, y); y += 5; } }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
  doc.text(`Hecho por ${empresa} con el Experto FirmaVB · ${new Date(d.fecha ?? Date.now()).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}`, M, y); y += 7;
  const tiles = [...(d.kpis ?? [])].slice(0, 4);
  if (d.veredicto) tiles.unshift({ k: 'Veredicto', v: d.veredicto.t });
  if (tiles.length) {
    const n = Math.min(tiles.length, 4); const g = 3; const w = (ANCHO - g * (n - 1)) / n; const h = 17;
    tiles.slice(0, n).forEach((t, i) => {
      const x = M + i * (w + g);
      const esV = t.k === 'Veredicto';
      const fill: [number, number, number] = esV ? (d.veredicto?.tono === 'ok' ? [209, 231, 221] : d.veredicto?.tono === 'bad' ? [248, 215, 218] : d.veredicto?.tono === 'warn' ? [255, 243, 205] : SUAVE) : SUAVE;
      doc.setFillColor(...fill); doc.roundedRect(x, y, w, h, 2, 2, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...GRIS); doc.text(t.k.toUpperCase(), x + 3, y + 5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(esV ? 10 : 11); doc.setTextColor(...NAVY);
      const v = doc.splitTextToSize(ascii(t.v), w - 6) as string[]; doc.text(v.slice(0, 2), x + 3, y + 11);
    });
    y += h + 7;
  } else y += 2;

  for (const l of aLineas(d.contenido)) {
    if (l.tipo === 'tabla' && l.filas?.length) {
      espacio(26);
      autoTable(doc, {
        startY: y, head: [l.filas[0]], body: l.filas.slice(1), margin: { left: M, right: M, top: 30, bottom: 26 }, theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.8, overflow: 'linebreak', lineColor: [225, 225, 225], lineWidth: 0.2, textColor: TEXTO },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [247, 248, 251] },
        didDrawPage: () => { const n = doc.getNumberOfPages(); if (n > pagina) { pagina = n; cabecera(); } pie(); },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? y) + 6; continue;
    }
    if (l.tipo === 'sep') { espacio(6); y += 4; continue; }
    if (l.tipo === 'h1') {
      espacio(14); y += 3;
      doc.setFillColor(...NAVY); doc.rect(M, y - 4.2, 1.4, 5.6, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...NAVY);
      const t = doc.splitTextToSize(ascii(l.t), ANCHO - 5) as string[]; doc.text(t, M + 4, y); y += t.length * 6 + 1.5; continue;
    }
    if (l.tipo === 'h2') { espacio(10); y += 2; parrafo(l.t, 11, NAVY, 'bold', 0, 5.5); y += 0.5; continue; }
    if (l.tipo === 'li') {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const lineas = doc.splitTextToSize(ascii(l.t), ANCHO - 6) as string[];
      espacio(lineas.length * 5 + 1);
      doc.setFillColor(...NAVY); doc.circle(M + 1.6, y - 1.4, 0.9, 'F');
      doc.setTextColor(...TEXTO); doc.text(lineas, M + 6, y); y += lineas.length * 5 + 1.2; continue;
    }
    // Párrafos destacados (veredicto, paso concreto, recomendación) en caja
    if (/^(veredicto|el paso concreto|paso a dar hoy|hoy tu paso|recomendaci[oó]n|mi consejo|estrategia)/i.test(l.t)) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const lineas = doc.splitTextToSize(ascii(l.t), ANCHO - 10) as string[]; const h = lineas.length * 5 + 6;
      espacio(h + 2);
      doc.setFillColor(232, 238, 250); doc.roundedRect(M, y - 4, ANCHO, h, 1.5, 1.5, 'F'); doc.setFillColor(...NAVY); doc.rect(M, y - 4, 1.4, h, 'F');
      doc.setTextColor(...NAVY); doc.text(lineas, M + 6, y + 1); y += h + 2; continue;
    }
    parrafo(l.t, 10, TEXTO, 'normal', 0, 5); y += 1.5;
  }

  // Cierre: invitación a usar el Experto (marketing al compartir)
  espacio(26); y += 4;
  doc.setFillColor(...NAVY); doc.roundedRect(M, y, ANCHO, 20, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255); doc.text('¿Tienes una licitación entre manos?', M + 5, y + 8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text('Pregúntale al Experto FirmaVB: 17 años vendiéndole al Estado, la ley y los datos de quién gana y cómo paga cada organismo. Tu primera pregunta es gratis en www.firmavb.cl', M + 5, y + 13.5, { maxWidth: ANCHO - 10 });
  y += 26;
  if (d.url) { doc.setFontSize(7.5); doc.setTextColor(...GRIS); doc.text(`Versión en línea: ${d.url}`, M, y); }
  pie();
  return doc.output('blob');
}

/** Comparte el PDF como archivo (celular: hoja de compartir, sale WhatsApp) o lo descarga (escritorio). */
export async function compartirPdfExperto(d: DatosPdfExperto, archivo: string): Promise<'compartido' | 'descargado'> {
  const blob = await crearPdfExperto(d);
  const file = new File([blob], archivo, { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (x: { files: File[] }) => boolean };
  // Solo en celular se abre la hoja de compartir (ahí sale WhatsApp); en escritorio se descarga directo.
  const movil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth < 1024);
  if (movil && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: d.titulo, text: d.url ? `${d.titulo}\n${d.url}` : d.titulo }); return 'compartido'; } catch { /* cancelado: cae a descarga */ }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = archivo; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return 'descargado';
}
