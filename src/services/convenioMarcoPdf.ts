/**
 * PDF de "Carta de aviso" a un proveedor no autorizado en Convenio Marco.
 * Reutiliza jsPDF y jspdf-autotable, ya usados en el resto de los servicios PDF.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CmOrden } from '@/hooks/useConvenioMarcoGestion';

export interface CartaAvisoData {
  empresa?: string | null;
  marca: string;
  proveedor: string;
  rut?: string | null;
  texto: string;
  ordenes: CmOrden[];
}

const PRIMARY: [number, number, number] = [37, 99, 235]; // azul FirmaVB
const MARGIN = 15;

function fmtMonto(v: number | null): string {
  if (v == null) return '-';
  return '$' + Math.round(v).toLocaleString('es-CL');
}
function fmtFecha(v: string | null): string {
  if (!v) return '-';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('es-CL');
}

// Escribe una carta completa en el documento (empezando en una página nueva si
// se indica). Devuelve el doc para encadenar.
function renderCarta(doc: jsPDF, data: CartaAvisoData, nuevaPagina: boolean): jsPDF {
  if (nuevaPagina) doc.addPage();
  const anchoUtil = doc.internal.pageSize.getWidth() - MARGIN * 2;
  let y = 18;

  // Encabezado
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  doc.text('CARTA DE AVISO', MARGIN, y);
  y += 6;
  doc.setDrawColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  doc.line(MARGIN, y, MARGIN + anchoUtil, y);
  y += 8;

  // Cuerpo (texto de la plantilla, sin el placeholder de tabla)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  const cuerpo = data.texto.replace('[Ver detalle de órdenes de compra al pie de esta carta]', '').trim();
  const lineas = doc.splitTextToSize(cuerpo, anchoUtil);
  doc.text(lineas, MARGIN, y);
  y += lineas.length * 5 + 4;

  // Tabla de órdenes de compra (evidencia)
  if (data.ordenes.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Órdenes de compra detectadas', MARGIN, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'N° OC', 'Organismo', 'Producto', 'Cant.', 'P. Unit.', 'Total']],
      body: data.ordenes.map((o) => [
        fmtFecha(o.fecha),
        o.codigo,
        o.organismo || '-',
        o.producto || '-',
        o.cantidad != null ? String(o.cantidad) : '-',
        fmtMonto(o.precio_unitario),
        fmtMonto(o.valor_total),
      ]),
      theme: 'striped',
      headStyles: { fillColor: PRIMARY, fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: { 2: { cellWidth: 38 }, 3: { cellWidth: 46 } },
      margin: { left: MARGIN, right: MARGIN },
    });
  }

  // Pie
  const alto = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('Generado por FirmaVB / firmavb.cl', MARGIN, alto - 8);
  return doc;
}

function nombreArchivo(base: string): string {
  return base.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'carta';
}

// Descarga una carta individual.
export function descargarCartaAviso(data: CartaAvisoData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  renderCarta(doc, data, false);
  doc.save(`Carta-aviso-${nombreArchivo(data.proveedor)}.pdf`);
}

// Descarga un único PDF con una carta por proveedor (envío masivo).
export function descargarCartasMasivas(cartas: CartaAvisoData[], marca: string): void {
  if (cartas.length === 0) return;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  cartas.forEach((c, i) => renderCarta(doc, c, i > 0));
  doc.save(`Cartas-aviso-${nombreArchivo(marca)}.pdf`);
}
