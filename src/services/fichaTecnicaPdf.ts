// @ts-nocheck
/**
 * Generación del PDF de FICHA TÉCNICA de los productos ofertados en una compra
 * ágil. El texto lo redacta la Edge Function `ficha-tecnica-ia` (IA + inventario)
 * y aquí lo maquetamos en un documento profesional, con el LOGO de la empresa y
 * la FOTO, CÓDIGO y descripción de cada producto.
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
  codigo?: string;
  imagen_url?: string | null;
  cantidad?: number;
  unidad?: string;
}

export interface EmpresaFichaPdf {
  nombre: string;
  rut?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  logoUrl?: string | null;
}

export interface DatosFichaTecnica {
  compra: { codigo: string; nombre: string; organismo: string };
  empresa: EmpresaFichaPdf;
  fecha: Date;
  fichas: FichaProducto[];
}

interface ImagenCargada {
  dataUrl: string;
  format: string;
  w: number;
  h: number;
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

// Descarga una imagen (URL pública) y la convierte a dataURL. Usamos fetch +
// FileReader (no canvas) para no “ensuciar” el canvas por CORS; el bucket es
// público, así que el fetch está permitido. Nunca lanza: si falla, devuelve null.
async function cargarImagen(url?: string | null): Promise<ImagenCargada | null> {
  if (!url) return null;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const dataUrl: string = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
    const dims: { w: number; h: number } = await new Promise((res) => {
      const img = new Image();
      img.onload = () => res({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
      img.onerror = () => res({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    const format = blob.type.includes('png')
      ? 'PNG'
      : blob.type.includes('webp')
      ? 'WEBP'
      : 'JPEG';
    return { dataUrl, format, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

function generarPDF(
  datos: DatosFichaTecnica,
  imgs: { logo: ImagenCargada | null; productos: Array<ImagenCargada | null> }
): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const dibujarEncabezado = () => {
    doc.setFillColor(COLORS.primary);
    doc.rect(0, 0, pageWidth, 32, 'F');

    // Logo (si existe) arriba a la derecha, con caja blanca para que se lea.
    if (imgs.logo) {
      try {
        const maxH = 16;
        const maxW = 40;
        const ratio = imgs.logo.w / imgs.logo.h || 1;
        let h = maxH;
        let w = h * ratio;
        if (w > maxW) {
          w = maxW;
          h = w / ratio;
        }
        const x = pageWidth - margin - w;
        const y = 16 - h / 2;
        doc.setFillColor('#ffffff');
        doc.roundedRect(x - 2, y - 2, w + 4, h + 4, 2, 2, 'F');
        doc.addImage(imgs.logo.dataUrl, imgs.logo.format, x, y, w, h);
      } catch {
        /* si el logo no se puede pintar, seguimos sin él */
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('FICHA TÉCNICA', margin, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(datos.empresa.nombre, margin, 21);
    doc.setFontSize(8);
    doc.text(`${datos.compra.codigo}  ·  ${datos.compra.organismo}`.substring(0, 80), margin, 27);
  };

  const dibujarPie = () => {
    doc.setFillColor(COLORS.secondary);
    doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const contacto = [datos.empresa.rut ? `RUT ${datos.empresa.rut}` : null, datos.empresa.direccion, datos.empresa.telefono, datos.empresa.email]
      .filter(Boolean)
      .join('  ·  ');
    doc.text(
      `${datos.empresa.nombre}${contacto ? '  ·  ' + contacto : ''}  ·  ${formatDate(datos.fecha)}`.substring(0, 140),
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  };

  dibujarEncabezado();
  let yPos = 42;

  datos.fichas.forEach((ficha, index) => {
    const imagen = imgs.productos[index];

    if (yPos > pageHeight - 65) {
      dibujarPie();
      doc.addPage();
      dibujarEncabezado();
      yPos = 42;
    }

    // Barra de título del producto
    doc.setFillColor(COLORS.lightGray);
    doc.roundedRect(margin, yPos - 5, pageWidth - margin * 2, 10, 2, 2, 'F');
    doc.setTextColor(COLORS.primary);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(`${index + 1}. ${ficha.nombre}`, pageWidth - margin * 2 - 6)[0], margin + 3, yPos + 2);
    yPos += 12;

    const metaBits = [
      ficha.codigo ? `Código: ${ficha.codigo}` : (ficha.sku ? `SKU: ${ficha.sku}` : null),
      ficha.codigo && ficha.sku && ficha.codigo !== ficha.sku ? `SKU: ${ficha.sku}` : null,
      typeof ficha.cantidad === 'number' ? `Cantidad: ${ficha.cantidad} ${ficha.unidad || ''}`.trim() : null,
    ].filter(Boolean);
    if (metaBits.length) {
      doc.setTextColor(COLORS.secondary);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(metaBits.join('   ·   '), margin + 3, yPos);
      yPos += 6;
    }

    // Bloque imagen (izquierda) + resumen (derecha).
    const bloqueTop = yPos;
    let textoX = margin + 3;
    let anchoTexto = pageWidth - margin * 2 - 6;
    let imagenBottom = bloqueTop;

    if (imagen) {
      try {
        const boxW = 34;
        const ratio = imagen.w / imagen.h || 1;
        let w = boxW;
        let h = w / ratio;
        if (h > 34) {
          h = 34;
          w = h * ratio;
        }
        doc.setDrawColor(COLORS.mediumGray);
        doc.rect(margin + 3, bloqueTop, boxW, Math.max(h, 20));
        doc.addImage(imagen.dataUrl, imagen.format, margin + 3 + (boxW - w) / 2, bloqueTop + 1, w, h);
        imagenBottom = bloqueTop + Math.max(h, 20);
        textoX = margin + 3 + boxW + 5;
        anchoTexto = pageWidth - margin - textoX;
      } catch {
        /* sin imagen si falla */
      }
    }

    let textoBottom = bloqueTop;
    if (ficha.resumen) {
      doc.setTextColor(COLORS.text);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const lineas = doc.splitTextToSize(ficha.resumen, anchoTexto);
      doc.text(lineas, textoX, bloqueTop + 3);
      textoBottom = bloqueTop + 3 + lineas.length * 4.5;
    }

    yPos = Math.max(imagenBottom, textoBottom) + 5;

    // Tabla de características (ancho completo)
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
      // @ts-ignore
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

    doc.setDrawColor(COLORS.mediumGray);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
  });

  dibujarPie();
  return doc;
}

/**
 * Precarga logo + fotos y descarga el PDF de ficha técnica. Es async porque
 * baja las imágenes desde el storage antes de construir el documento.
 */
export async function descargarFichaTecnicaPDF(datos: DatosFichaTecnica): Promise<void> {
  const [logo, ...productos] = await Promise.all([
    cargarImagen(datos.empresa.logoUrl),
    ...datos.fichas.map((f) => cargarImagen(f.imagen_url)),
  ]);
  const doc = generarPDF(datos, { logo, productos });
  const codigo = (datos.compra.codigo || 'compra').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`ficha_tecnica_${codigo}.pdf`);
}
