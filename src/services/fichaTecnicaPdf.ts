// @ts-nocheck
/**
 * Generación del PDF de FICHA TÉCNICA de los productos ofertados en una compra
 * ágil. El contenido de cada ficha lo redacta la Edge Function `ficha-tecnica-ia`
 * (IA + inventario); aquí sólo lo maquetamos en un documento profesional.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface FichaProducto {
  nombre: string;
  resumen: string;
  caracteristicas: Array<{ campo: string; valor: string }>;
  condiciones: string[];
  garantia: string;
  notas?: string;
  sku?: string;
  cantidad?: number;
  unidad?: string;
}

export interface DatosFichaTecnica {
  compra: { codigo: string; nombre: string; organismo: string };
  empresa: { nombre: string; rut?: string; telefono?: string; email?: string };
  fecha: Date;
  fichas: FichaProducto[];
}

const COLORS = {
  primary: '#1e40af',
  secondary: '#475569',
  text: '#1f2937',
  lightGray: '#f3f4f6',
  mediumGray: '#e5e7eb',
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function generarFichaTecnicaPDF(datos: DatosFichaTecnica): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const dibujarEncabezado = () => {
    doc.setFillColor(COLORS.primary);
    doc.rect(0, 0, pageWidth, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('FICHA TÉCNICA', margin, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(datos.empresa.nombre, margin, 23);
    doc.setFontSize(8);
    doc.text(
      `${datos.compra.codigo}  ·  ${datos.compra.organismo}`.substring(0, 90),
      margin,
      28
    );
    doc.setFontSize(8);
    doc.text(`Fecha: ${formatDate(datos.fecha)}`, pageWidth - margin, 15, { align: 'right' });
  };

  const dibujarPie = () => {
    doc.setFillColor(COLORS.secondary);
    doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const contacto = [datos.empresa.email, datos.empresa.telefono].filter(Boolean).join('  ·  ');
    doc.text(
      `${datos.empresa.nombre}${contacto ? '  ·  ' + contacto : ''}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  };

  dibujarEncabezado();
  let yPos = 42;

  datos.fichas.forEach((ficha, index) => {
    // Salto de página si no queda espacio para el título + algo de contenido.
    if (yPos > pageHeight - 60) {
      dibujarPie();
      doc.addPage();
      dibujarEncabezado();
      yPos = 42;
    }

    // Título del producto
    doc.setFillColor(COLORS.lightGray);
    doc.roundedRect(margin, yPos - 5, pageWidth - margin * 2, 10, 2, 2, 'F');
    doc.setTextColor(COLORS.primary);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const titulo = `${index + 1}. ${ficha.nombre}`;
    doc.text(doc.splitTextToSize(titulo, pageWidth - margin * 2 - 6)[0], margin + 3, yPos + 2);
    yPos += 12;

    const meta = [
      ficha.sku ? `SKU: ${ficha.sku}` : null,
      typeof ficha.cantidad === 'number' ? `Cantidad: ${ficha.cantidad} ${ficha.unidad || ''}`.trim() : null,
    ].filter(Boolean).join('   ·   ');
    if (meta) {
      doc.setTextColor(COLORS.secondary);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(meta, margin + 3, yPos);
      yPos += 6;
    }

    // Resumen
    if (ficha.resumen) {
      doc.setTextColor(COLORS.text);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const lineas = doc.splitTextToSize(ficha.resumen, pageWidth - margin * 2 - 6);
      doc.text(lineas, margin + 3, yPos);
      yPos += lineas.length * 4.5 + 3;
    }

    // Tabla de características
    if (ficha.caracteristicas?.length) {
      autoTable(doc, {
        startY: yPos,
        head: [['Característica', 'Detalle']],
        body: ficha.caracteristicas.map((c) => [c.campo, c.valor]),
        theme: 'grid',
        headStyles: { fillColor: COLORS.primary, textColor: '#ffffff', fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, textColor: COLORS.text },
        columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' }, 1: { cellWidth: pageWidth - margin * 2 - 55 } },
        alternateRowStyles: { fillColor: COLORS.lightGray },
        margin: { left: margin, right: margin },
      });
      // @ts-ignore - autoTable agrega finalY
      yPos = doc.lastAutoTable.finalY + 6;
    }

    // Condiciones
    if (ficha.condiciones?.length) {
      if (yPos > pageHeight - 40) {
        dibujarPie();
        doc.addPage();
        dibujarEncabezado();
        yPos = 42;
      }
      doc.setTextColor(COLORS.text);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Condiciones', margin + 3, yPos);
      yPos += 5;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(COLORS.secondary);
      ficha.condiciones.forEach((cond) => {
        const lineas = doc.splitTextToSize(`• ${cond}`, pageWidth - margin * 2 - 6);
        doc.text(lineas, margin + 3, yPos);
        yPos += lineas.length * 4.2;
      });
      yPos += 2;
    }

    // Garantía
    if (ficha.garantia) {
      doc.setTextColor(COLORS.text);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Garantía: ', margin + 3, yPos);
      const anchoLabel = doc.getTextWidth('Garantía: ');
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(COLORS.secondary);
      const lineas = doc.splitTextToSize(ficha.garantia, pageWidth - margin * 2 - 6 - anchoLabel);
      doc.text(lineas, margin + 3 + anchoLabel, yPos);
      yPos += lineas.length * 4.5 + 4;
    }

    // Separador
    doc.setDrawColor(COLORS.mediumGray);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
  });

  dibujarPie();
  return doc;
}

export function descargarFichaTecnicaPDF(datos: DatosFichaTecnica): void {
  const doc = generarFichaTecnicaPDF(datos);
  const codigo = (datos.compra.codigo || 'compra').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`ficha_tecnica_${codigo}.pdf`);
}
