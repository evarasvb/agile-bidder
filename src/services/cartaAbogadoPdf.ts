// @ts-nocheck
// PDF de documentos formales generados por Don Evaristo Abogado (cartas de
// apelación, reclamos, oficios): carta profesional lista para firmar e imprimir.
import jsPDF from 'jspdf';
import type { DatosEmpresa } from './pdfGenerator';

export interface DatosCartaAbogado {
  titulo: string; // ej. "Recurso de reconsideración — Licitación 1234-56-LE26"
  empresa: DatosEmpresa;
  cuerpo: string; // texto plano generado por Don Evaristo Abogado
}

const MARGEN = 20;
const ANCHO_UTIL = 210 - MARGEN * 2;

export function generarCartaAbogadoPDF(datos: DatosCartaAbogado): jsPDF {
  const doc = new jsPDF();
  let y = MARGEN;

  // Membrete: datos del proveedor que firma la carta.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor('#1e293b');
  doc.text(datos.empresa.nombre || 'FirmaVB', MARGEN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#475569');
  const membrete = [datos.empresa.rut ? `RUT ${datos.empresa.rut}` : null, datos.empresa.direccion, datos.empresa.telefono, datos.empresa.email]
    .filter(Boolean).join('  ·  ');
  if (membrete) { doc.text(membrete, MARGEN, y); y += 5; }
  y += 2;
  doc.setDrawColor('#cbd5e1');
  doc.line(MARGEN, y, 210 - MARGEN, y);
  y += 12;

  // Cuerpo: texto plano de Don Evaristo Abogado, respetando sus saltos de párrafo.
  doc.setFontSize(11);
  doc.setTextColor('#1f2937');
  const parrafos = datos.cuerpo.replace(/\r/g, '').split('\n');
  for (const parrafo of parrafos) {
    if (!parrafo.trim()) { y += 4; continue; }
    const lineas = doc.splitTextToSize(parrafo, ANCHO_UTIL);
    for (const linea of lineas) {
      if (y > 297 - MARGEN) { doc.addPage(); y = MARGEN; }
      doc.text(linea, MARGEN, y);
      y += 5.5;
    }
    y += 1.5;
  }

  // Pie con numeración si hay más de una página.
  const paginas = doc.getNumberOfPages();
  if (paginas > 1) {
    for (let i = 1; i <= paginas; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor('#94a3b8');
      doc.text(`Página ${i} de ${paginas}`, 210 - MARGEN, 297 - 10, { align: 'right' });
    }
  }

  return doc;
}

export function descargarCartaAbogadoPDF(datos: DatosCartaAbogado): void {
  const doc = generarCartaAbogadoPDF(datos);
  const slug = datos.titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').slice(0, 60);
  doc.save(`${slug || 'documento'}.pdf`);
}
