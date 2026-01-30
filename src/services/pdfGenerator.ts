// @ts-nocheck
/**
 * Servicio de generación de PDF para cotizaciones
 * Usa jsPDF y jspdf-autotable para crear documentos profesionales
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CompraAgil } from '@/hooks/useComprasAgiles';

export interface ItemCotizacion {
  itemRequerido: string;
  productoOfertado: string;
  sku: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  total: number;
  matchScore?: number;
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
  compra: CompraAgil;
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
export function generarCotizacionPDF(datos: DatosCotizacion): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 15;

  // === ENCABEZADO ===
  // Logo y datos empresa
  doc.setFillColor(COLORS.primary);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  // Nombre empresa
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(datos.empresa.nombre, margin, 20);
  
  // Datos de contacto
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`RUT: ${datos.empresa.rut}`, margin, 28);
  doc.text(`${datos.empresa.direccion} | Tel: ${datos.empresa.telefono}`, margin, 34);
  
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
  
  const tableData = datos.items.map((item, index) => [
    (index + 1).toString(),
    item.itemRequerido.substring(0, 35) + (item.itemRequerido.length > 35 ? '...' : ''),
    item.productoOfertado.substring(0, 30) + (item.productoOfertado.length > 30 ? '...' : ''),
    item.sku,
    item.cantidad.toString(),
    item.unidad,
    formatCurrency(item.precioUnitario),
    formatCurrency(item.total)
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [[
      '#',
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
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 25, halign: 'right' },
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
    margin: { left: margin, right: margin },
  });
  
  // @ts-ignore - autoTable adds finalY
  yPos = doc.lastAutoTable.finalY + 10;
  
  // === TOTALES ===
  const subtotal = datos.items.reduce((sum, item) => sum + item.total, 0);
  const iva = subtotal * 0.19;
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
export function descargarCotizacionPDF(datos: DatosCotizacion): void {
  const doc = generarCotizacionPDF(datos);
  const filename = `cotizacion_${datos.numero}_${datos.compra.codigo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(filename);
}

/**
 * Abre el PDF en una nueva pestaña
 */
export function previsualizarCotizacionPDF(datos: DatosCotizacion): void {
  const doc = generarCotizacionPDF(datos);
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
