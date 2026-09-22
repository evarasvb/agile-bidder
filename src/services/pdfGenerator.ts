// @ts-nocheck
/**
 * Servicio de generación de PDF para cotizaciones
 * Usa jsPDF y jspdf-autotable para crear documentos profesionales
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { IVA_RATE } from '@/lib/constants';

// Datos mínimos del proceso (compra ágil o licitación) que necesita el
// encabezado "REFERENCIA DE COMPRA" del PDF: código, organismo y nombre.
export interface ReferenciaProcesoCotizacion {
  codigo: string;
  organismo: string;
  nombre: string;
}

export interface ItemCotizacion {
  itemRequerido: string;
  productoOfertado: string;
  sku: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  total: number;
  matchScore?: number;
  imagenUrl?: string | null;
}

interface ImagenCargada {
  dataUrl: string;
  format: string;
  w: number;
  h: number;
}

// Descarga una foto de producto (URL pública del bucket) y la convierte a data
// URL + sus dimensiones reales (para no deformarla al dibujarla). Nunca lanza:
// si falla (sin foto, 404, CORS), la fila sale sin imagen, no rompe el PDF.
async function cargarImagenProducto(url?: string | null): Promise<ImagenCargada | null> {
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
    const format = blob.type.includes('png') ? 'PNG' : blob.type.includes('webp') ? 'WEBP' : 'JPEG';
    return { dataUrl, format, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

export interface DatosEmpresa {
  nombre: string;
  rut: string;
  direccion: string;
  telefono: string;
  email: string;
  logo?: string; // Base64 o URL
}

export interface DatosCotizacion {
  numero: string;
  fecha: Date;
  validezDias: number;
  compra: ReferenciaProcesoCotizacion;
  items: ItemCotizacion[];
  empresa: DatosEmpresa;
  observaciones?: string;
  condicionesPago?: string;
  tiempoEntrega?: string;
}

const COLORS = {
  primary: '#1e40af', // blue-800
  secondary: '#475569', // slate-600
  accent: '#059669', // emerald-600
  text: '#1f2937', // gray-800
  lightGray: '#f3f4f6', // gray-100
  mediumGray: '#e5e7eb', // gray-200
};

/**
 * Genera PDF de cotización profesional
 */
export function generarCotizacionPDF(datos: DatosCotizacion, fotos: Array<ImagenCargada | null> = []): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 15;

  // === ENCABEZADO ===
  // Logo y datos empresa
  doc.setFillColor(COLORS.primary);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Logo del cliente (si viene ya convertido a data URL). Si falla, seguimos sin él.
  let headerTextX = margin;
  if (datos.empresa.logo && datos.empresa.logo.startsWith('data:')) {
    try {
      doc.addImage(datos.empresa.logo, 'PNG', margin, 8, 18, 18);
      headerTextX = margin + 22;
    } catch { /* logo inválido: encabezado sin logo */ }
  }

  // Nombre empresa
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(datos.empresa.nombre, headerTextX, 20);

  // Datos de contacto (solo los que existen, para no imprimir "RUT: " vacío).
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (datos.empresa.rut) doc.text(`RUT: ${datos.empresa.rut}`, headerTextX, 28);
  const contacto = [datos.empresa.direccion, datos.empresa.telefono ? `Tel: ${datos.empresa.telefono}` : '']
    .filter(Boolean)
    .join(' | ');
  if (contacto) doc.text(contacto, headerTextX, 34);
  
  // Número de cotización (lado derecho)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('COTIZACIÓN', pageWidth - margin, 18, { align: 'right' });
  doc.setFontSize(14);
  doc.text(`N° ${datos.numero}`, pageWidth - margin, 26, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha: ${formatDate(datos.fecha)}`, pageWidth - margin, 34, { align: 'right' });
  
  yPos = 50;
  
  // === DATOS DE LA COMPRA ===
  doc.setTextColor(COLORS.text);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('REFERENCIA DE COMPRA', margin, yPos);
  
  yPos += 6;
  doc.setDrawColor(COLORS.mediumGray);
  doc.setFillColor(COLORS.lightGray);
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, 28, 2, 2, 'FD');
  
  yPos += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.secondary);
  doc.text('Código:', margin + 5, yPos);
  doc.text('Organismo:', pageWidth / 2, yPos);
  
  doc.setTextColor(COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text(datos.compra.codigo, margin + 25, yPos);
  doc.text(datos.compra.organismo, pageWidth / 2 + 25, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.secondary);
  doc.text('Nombre:', margin + 5, yPos);
  doc.setTextColor(COLORS.text);
  
  // Nombre con wrap
  const nombreLines = doc.splitTextToSize(datos.compra.nombre, pageWidth - margin * 2 - 30);
  doc.text(nombreLines[0], margin + 25, yPos);
  if (nombreLines.length > 1) {
    yPos += 5;
    doc.text(nombreLines[1], margin + 25, yPos);
  }
  
  yPos += 16;
  
  // === TABLA DE PRODUCTOS ===
  doc.setTextColor(COLORS.text);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DETALLE DE PRODUCTOS', margin, yPos);
  yPos += 4;
  
  // La foto va en su propia columna, dibujada con didDrawCell (autoTable no
  // pinta imágenes desde los datos de la celda). La celda queda con texto
  // vacío; si el producto no tiene foto, la columna simplemente queda en blanco.
  const tableData = datos.items.map((item) => [
    '',
    item.itemRequerido.substring(0, 32) + (item.itemRequerido.length > 32 ? '...' : ''),
    item.productoOfertado.substring(0, 28) + (item.productoOfertado.length > 28 ? '...' : ''),
    item.sku,
    item.cantidad.toString(),
    item.unidad,
    formatCurrency(item.precioUnitario),
    formatCurrency(item.total)
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [[
      'Foto',
      'Item Requerido',
      'Producto Ofertado',
      'SKU',
      'Cant.',
      'Unidad',
      'P. Unit.',
      'Total'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: '#ffffff',
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLORS.text,
      valign: 'middle',
      minCellHeight: 18,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 18 },
      1: { cellWidth: 32 },
      2: { cellWidth: 32 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 13, halign: 'center' },
      5: { cellWidth: 13, halign: 'center' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 22, halign: 'right' },
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
    margin: { left: margin, right: margin },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 0) return;
      const foto = fotos[data.row.index];
      if (!foto) return;
      try {
        const boxW = data.cell.width - 3;
        const boxH = data.cell.height - 3;
        const ratio = foto.w / foto.h || 1;
        let w = boxW;
        let h = w / ratio;
        if (h > boxH) { h = boxH; w = h * ratio; }
        const x = data.cell.x + (data.cell.width - w) / 2;
        const y = data.cell.y + (data.cell.height - h) / 2;
        doc.addImage(foto.dataUrl, foto.format, x, y, w, h);
      } catch { /* si la foto no se puede pintar, la fila sigue sin ella */ }
    },
  });
  
  // @ts-ignore - autoTable adds finalY
  yPos = doc.lastAutoTable.finalY + 10;
  
  // === TOTALES ===
  const subtotal = datos.items.reduce((sum, item) => sum + item.total, 0);
  const iva = subtotal * IVA_RATE;
  const total = subtotal + iva;
  
  const totalesX = pageWidth - margin - 70;
  
  doc.setFillColor(COLORS.lightGray);
  doc.roundedRect(totalesX - 5, yPos - 2, 75, 32, 2, 2, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.secondary);
  doc.text('Subtotal Neto:', totalesX, yPos + 5);
  doc.text('IVA (19%):', totalesX, yPos + 13);
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.text);
  doc.text(formatCurrency(subtotal), pageWidth - margin, yPos + 5, { align: 'right' });
  doc.text(formatCurrency(iva), pageWidth - margin, yPos + 13, { align: 'right' });
  
  doc.setFillColor(COLORS.primary);
  doc.roundedRect(totalesX - 5, yPos + 18, 75, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('TOTAL:', totalesX, yPos + 25);
  doc.text(formatCurrency(total), pageWidth - margin, yPos + 25, { align: 'right' });
  
  yPos += 42;
  
  // === CONDICIONES ===
  if (yPos < 240) {
    doc.setTextColor(COLORS.text);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('CONDICIONES', margin, yPos);
    
    yPos += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.secondary);
    
    const condiciones = [
      `• Validez de la cotización: ${datos.validezDias} días`,
      `• Tiempo de entrega: ${datos.tiempoEntrega || 'A convenir según orden de compra'}`,
      `• Condiciones de pago: ${datos.condicionesPago || '30 días contra factura'}`,
      '• Precios en pesos chilenos, IVA incluido en total',
    ];
    
    for (const cond of condiciones) {
      doc.text(cond, margin, yPos);
      yPos += 5;
    }
    
    if (datos.observaciones) {
      yPos += 3;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(COLORS.text);
      doc.text('Observaciones:', margin, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(COLORS.secondary);
      const obsLines = doc.splitTextToSize(datos.observaciones, pageWidth - margin * 2);
      doc.text(obsLines, margin, yPos);
    }
  }
  
  // === PIE DE PÁGINA ===
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(COLORS.secondary);
  doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${datos.empresa.nombre} | ${datos.empresa.email} | Cotización generada el ${formatDate(new Date())}`,
    pageWidth / 2,
    pageHeight - 7,
    { align: 'center' }
  );
  
  return doc;
}

/**
 * Descarga el PDF de cotización
 */
// Descarga la imagen del logo (URL http) y la convierte a data URL para jsPDF.
// Si falla (CORS, 404, etc.) devolvemos null y el PDF sale sin logo.
async function urlADataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(typeof fr.result === 'string' ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Si empresa.logo es una URL http, la convierte a data URL (para poder dibujarla).
async function conLogoResuelto(datos: DatosCotizacion): Promise<DatosCotizacion> {
  const logo = datos.empresa.logo;
  if (logo && /^https?:\/\//.test(logo)) {
    const dataUrl = await urlADataUrl(logo);
    return { ...datos, empresa: { ...datos.empresa, logo: dataUrl ?? undefined } };
  }
  return datos;
}

export async function descargarCotizacionPDF(datos: DatosCotizacion): Promise<void> {
  const [datosConLogo, fotos] = await Promise.all([
    conLogoResuelto(datos),
    Promise.all(datos.items.map((it) => cargarImagenProducto(it.imagenUrl))),
  ]);
  const doc = generarCotizacionPDF(datosConLogo, fotos);
  const filename = `cotizacion_${datos.numero}_${datos.compra.codigo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(filename);
}

/**
 * Abre el PDF en una nueva pestaña
 */
export async function previsualizarCotizacionPDF(datos: DatosCotizacion): Promise<void> {
  const [datosConLogo, fotos] = await Promise.all([
    conLogoResuelto(datos),
    Promise.all(datos.items.map((it) => cargarImagenProducto(it.imagenUrl))),
  ]);
  const doc = generarCotizacionPDF(datosConLogo, fotos);
  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
}

// Helpers
function formatDate(date: Date): string {
  return date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
