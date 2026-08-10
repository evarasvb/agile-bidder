// @ts-nocheck
/**
 * Generacion de PDF para Ordenes de Compra: detalle individual y ranking Top OC.
 * Reutiliza jsPDF y jspdf-autotable, ya usados en pdfGenerator.ts (cotizaciones).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { OrdenCompra } from '@/hooks/useOrdenesCompra';
import { esTratoDirecto, getTipoOCLabel } from '@/utils/tipoOrdenCompra';

const COLORS = {
    primary: '#1e40af',
    secondary: '#475569',
    danger: '#dc2626',
    text: '#1f2937',
};

function formatMonto(n) {
    if (n === null || n === undefined) return 'N/A';
    return '$' + Math.round(n).toLocaleString('es-CL');
}

function formatFecha(fecha) {
    if (!fecha) return 'N/A';
    try {
          return format(new Date(fecha), 'dd MMM yyyy', { locale: es });
    } catch {
          return 'N/A';
    }
}

function encabezado(doc, titulo, subtitulo) {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(COLORS.primary);
    doc.rect(0, 0, pageWidth, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('FirmaVB', 15, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Inteligencia para Ganar Mas / firmavb.cl', 15, 24);

  doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo, pageWidth - 15, 16, { align: 'right' });
    if (subtitulo) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.text(subtitulo, pageWidth - 15, 24, { align: 'right' });
    }
    doc.setTextColor(COLORS.text);
}

function piePagina(doc, margin) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(COLORS.secondary);
          doc.text('Generado por FirmaVB / firmavb.cl', margin, doc.internal.pageSize.getHeight() - 8);
    }
}

/** PDF de detalle de una Orden de Compra individual */
export function generarOrdenCompraPDF(orden) {
    const doc = new jsPDF();
    const margin = 15;
    let y = 42;

  encabezado(doc, 'OC ' + orden.codigo, orden.estado || undefined);

  doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(orden.nombre || 'Sin nombre', margin, y);
    y += 8;

  if (esTratoDirecto(orden.tipo)) {
        doc.setTextColor(COLORS.danger);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('TRATO DIRECTO', margin, y);
        doc.setTextColor(COLORS.text);
        y += 7;
  }

  doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Tipo: ' + getTipoOCLabel(orden.tipo), margin, y);
    y += 10;

  autoTable(doc, {
        startY: y,
        head: [['Campo', 'Valor']],
        body: [
                ['Institucion', orden.institucion_nombre || 'N/A'],
                ['RUT Institucion', orden.institucion_rut || 'N/A'],
                ['Proveedor', orden.proveedor_nombre || 'N/A'],
                ['RUT Proveedor', orden.proveedor_rut || 'N/A'],
                ['Total', formatMonto(orden.total)],
                ['Fecha creacion', formatFecha(orden.fecha_creacion)],
                ['Fecha envio', formatFecha(orden.fecha_envio)],
              ],
        theme: 'striped',
        headStyles: { fillColor: COLORS.primary },
        margin: { left: margin, right: margin },
  });

  const afterInfoY = doc.lastAutoTable.finalY + 8;

  if (orden.items && orden.items.length > 0) {
        autoTable(doc, {
                startY: afterInfoY,
                head: [['#', 'Producto', 'Cant.', 'Unidad', 'P. Unit.', 'Total']],
                body: orden.items.map(function (it) {
                          return [
                                      it.correlativo || '-',
                                      it.nombre_producto,
                                      it.cantidad,
                                      it.unidad || '-',
                                      formatMonto(it.precio_unitario_neto),
                                      formatMonto(it.total_neto),
                                    ];
                }),
                theme: 'grid',
                headStyles: { fillColor: COLORS.secondary },
                margin: { left: margin, right: margin },
        });
  }

  piePagina(doc, margin);

  return doc;
}

export function descargarOrdenCompraPDF(orden) {
    const doc = generarOrdenCompraPDF(orden);
    doc.save('OC-' + orden.codigo + '.pdf');
}

/** PDF de ranking (Top N Ordenes de Compra por monto) */
export function generarTopOrdenesCompraPDF(ordenes, titulo) {
    const doc = new jsPDF();
    const margin = 15;

  encabezado(doc, titulo || 'Top Ordenes de Compra', formatFecha(new Date()));

  autoTable(doc, {
        startY: 40,
        head: [['#', 'Codigo', 'Institucion', 'Proveedor', 'Monto', 'Tipo', 'Trato Directo']],
        body: ordenes.map(function (o, i) {
                return [
                          i + 1,
                          o.codigo,
                          o.institucion_nombre || 'N/A',
                          o.proveedor_nombre || 'N/A',
                          formatMonto(o.total),
                          getTipoOCLabel(o.tipo),
                          esTratoDirecto(o.tipo) ? 'Si' : '',
                        ];
        }),
        theme: 'striped',
        headStyles: { fillColor: COLORS.primary },
        margin: { left: margin, right: margin },
        styles: { fontSize: 8 },
  });

  piePagina(doc, margin);

  return doc;
}

export function descargarTopOrdenesCompraPDF(ordenes, titulo) {
    const doc = generarTopOrdenesCompraPDF(ordenes, titulo);
    doc.save('top-oc-' + format(new Date(), 'yyyy-MM-dd') + '.pdf');
}
