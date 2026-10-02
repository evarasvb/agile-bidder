// PDFs de cobranza: NOTA DE COBRO y NOTA DE DÉBITO EXENTA (borradores para que
// el cliente los emita en su ERP). Incluyen el detalle del interés moratorio
// calculado por tramos de la tasa máxima convencional (Ley 18.010) y la glosa
// técnica/legal que lo respalda. La misma glosa se reutiliza en el cuerpo del
// correo de cobro (Fase 3). Generación en el cliente con jsPDF (patrón del repo).
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DatosEmpresa } from './pdfGenerator';
import type { ResultadoInteres } from '@/lib/interesMora';

export interface DatosNotaCobranza {
  /** Acreedor que emite el cobro (empresa del usuario). */
  empresa: DatosEmpresa;
  /** Deudor al que se le cobra. */
  deudor: { nombre: string; rut?: string | null; email?: string | null; tipo: 'estado' | 'privado' };
  numeroFactura?: string | null;
  oc?: string | null;
  /** Capital adeudado (monto de la factura). */
  capital: number;
  fechaEmision?: string | null;      // 'YYYY-MM-DD'
  fechaRecepcion?: string | null;    // 'YYYY-MM-DD'
  /** Plazo legal de pago (vencimiento o recepción + 30). */
  fechaVencimiento: Date | null;
  /** Fecha de cálculo del interés: pago real o fecha de emisión del documento. */
  fechaCalculo: Date;
  interes: ResultadoInteres;
  ciudad?: string;
}

const MARGEN = 20;
const ANCHO = 210;
const ANCHO_UTIL = ANCHO - MARGEN * 2;

const CLP = (v: number) => '$' + Math.round(v || 0).toLocaleString('es-CL');
const fFecha = (d: Date | null) => (d ? d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : '—');
const fFechaCorta = (s: string | null | undefined) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('es-CL') : '—');
const fMes = (s: string | null) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }) : '—');

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').slice(0, 60);

// --- Glosa técnica/legal del interés moratorio (reutilizable en correo) --------
export function glosaInteresMora(d: DatosNotaCobranza): string[] {
  const r = d.interes;
  const lineas: string[] = [];
  lineas.push(
    `El presente cobro corresponde al interés por mora en el pago de la factura ${d.numeroFactura ? `N° ${d.numeroFactura}` : 'indicada'}` +
      `${d.oc ? `, asociada a la orden de compra ${d.oc}` : ''}, por un capital de ${CLP(d.capital)}.`,
  );
  lineas.push(
    `El plazo de pago venció el ${fFecha(d.fechaVencimiento)} y el cálculo se efectúa al ${fFecha(d.fechaCalculo)}, ` +
      `totalizando ${r.diasAtraso} días de mora.`,
  );
  lineas.push(
    'El interés se calcula conforme a la tasa de interés máxima convencional (artículos 6° y 6° bis de la Ley N° 18.010), ' +
      'para operaciones de crédito de dinero no reajustables en moneda nacional iguales o superiores a 90 días, vigente en cada ' +
      'periodo mensual de la mora. Como la tasa máxima convencional se actualiza periódicamente, se aplica de forma proporcional ' +
      'la tasa vigente en cada tramo del periodo (interés simple, base 360 días), según el siguiente detalle:',
  );
  for (const t of r.detalle) {
    lineas.push(
      `  • ${fMes(t.mes)}: ${t.dias} días a ${t.tasa_anual != null ? `${t.tasa_anual}% anual` : 'tasa no disponible'} = ${CLP(t.interes)}`,
    );
  }
  lineas.push(`Interés total por mora: ${CLP(r.interes)}. Total adeudado (capital + interés): ${CLP(d.capital + r.interes)}.`);
  if (!r.completo) {
    lineas.push(
      'NOTA: falta la tasa máxima convencional de uno o más meses del periodo; el interés indicado es parcial y debe completarse ' +
        'con la tasa oficial publicada por la CMF antes de su emisión definitiva.',
    );
  }
  lineas.push(
    'Fundamento: Ley N° 21.131 (pago dentro de 30 días corridos desde la recepción de la factura y devengo de intereses por mora); ' +
      'Ley N° 18.010, arts. 6° y 6° bis (tasa máxima convencional); Ley N° 19.983 (mérito ejecutivo de la factura recibida y no reclamada). ' +
      'Los intereses moratorios no constituyen una operación afecta a IVA, por lo que esta nota de débito se emite exenta.',
  );
  return lineas;
}

// Encabezado con membrete del acreedor.
function membrete(doc: jsPDF, empresa: DatosEmpresa, y: number): number {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor('#1e293b');
  doc.text(empresa.nombre || 'FirmaVB', MARGEN, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor('#475569');
  const linea = [empresa.rut ? `RUT ${empresa.rut}` : null, empresa.direccion, empresa.telefono, empresa.email].filter(Boolean).join('  ·  ');
  if (linea) { doc.text(linea, MARGEN, y); y += 5; }
  y += 2; doc.setDrawColor('#cbd5e1'); doc.line(MARGEN, y, ANCHO - MARGEN, y);
  return y + 10;
}

function sello(doc: jsPDF, texto: string) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor('#b45309');
  doc.text(texto, ANCHO - MARGEN, MARGEN - 8, { align: 'right' });
  doc.setTextColor('#1f2937');
}

function parrafos(doc: jsPDF, texto: string[], y: number, size = 10): number {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor('#1f2937');
  for (const p of texto) {
    const lineas = doc.splitTextToSize(p, ANCHO_UTIL);
    for (const l of lineas) {
      if (y > 297 - MARGEN) { doc.addPage(); y = MARGEN; }
      doc.text(l, MARGEN, y); y += 5.2;
    }
    y += 2;
  }
  return y;
}

// --- NOTA DE COBRO -------------------------------------------------------------
export function generarNotaCobroPDF(d: DatosNotaCobranza): jsPDF {
  const doc = new jsPDF();
  sello(doc, 'BORRADOR — emítala desde su ERP');
  let y = membrete(doc, d.empresa, MARGEN);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor('#1e293b');
  doc.text('NOTA DE COBRO', MARGEN, y); y += 8;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor('#475569');
  doc.text(`${d.ciudad || 'Santiago'}, ${fFecha(d.fechaCalculo)}`, ANCHO - MARGEN, y, { align: 'right' });
  y += 8;

  doc.setTextColor('#1f2937');
  y = parrafos(doc, [
    `Señores ${d.deudor.nombre}${d.deudor.rut ? ` (RUT ${d.deudor.rut})` : ''}`,
    `Referencia: Factura ${d.numeroFactura ? `N° ${d.numeroFactura}` : 's/n'}${d.oc ? ` · Orden de Compra ${d.oc}` : ''}.`,
    `Por medio de la presente, y habiendo transcurrido el plazo legal de pago, les comunicamos que la factura individualizada ` +
      `se encuentra impaga y en mora, por lo que procedemos a su cobro según el siguiente detalle:`,
  ], y);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN },
    head: [['Concepto', 'Monto']],
    body: [
      [`Capital — Factura ${d.numeroFactura ? `N° ${d.numeroFactura}` : 's/n'}`, CLP(d.capital)],
      [`Interés por mora (${d.interes.diasAtraso} días, tasa máx. convencional)`, CLP(d.interes.interes)],
      ['TOTAL A PAGAR', CLP(d.capital + d.interes.interes)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data) => { if (data.row.index === 2) data.cell.styles.fontStyle = 'bold'; },
  });
  // @ts-expect-error lastAutoTable lo agrega el plugin en runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  y = parrafos(doc, [
    `Les solicitamos regularizar el pago del total adeudado dentro de 5 días hábiles contados desde la recepción de esta nota. ` +
      `El atraso devenga intereses conforme a la tasa máxima convencional (Ley N° 18.010); el plazo de pago de 30 días corridos ` +
      `desde la recepción de la factura se rige por la Ley N° 21.131, y la factura recibida y no reclamada tiene mérito ejecutivo ` +
      `(Ley N° 19.983).`,
    d.deudor.tipo === 'estado'
      ? `Tratándose de un organismo del Estado, de mantenerse el no pago se podrá reclamar ante la propia institución, ChileCompra ` +
        `(gestión de pago / ProntoPago) y la Contraloría General de la República.`
      : `De mantenerse el no pago, se ejercerán las acciones de cobro que la ley franquea.`,
    `Agradecemos su pronta regularización.`,
    ``,
    `Atentamente,`,
    `${d.empresa.nombre}${d.empresa.rut ? ` — RUT ${d.empresa.rut}` : ''}`,
  ], y);

  numerarPaginas(doc);
  return doc;
}

// --- NOTA DE DÉBITO EXENTA -----------------------------------------------------
export function generarNotaDebitoExentaPDF(d: DatosNotaCobranza): jsPDF {
  const doc = new jsPDF();
  sello(doc, 'BORRADOR — emítala desde su ERP');
  let y = membrete(doc, d.empresa, MARGEN);

  // Recuadro de documento tributario.
  doc.setDrawColor('#b91c1c'); doc.setLineWidth(0.6);
  doc.rect(ANCHO - MARGEN - 70, y - 4, 70, 20);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor('#b91c1c');
  doc.text('NOTA DE DÉBITO', ANCHO - MARGEN - 35, y + 2, { align: 'center' });
  doc.setFontSize(9);
  doc.text('EXENTA', ANCHO - MARGEN - 35, y + 7, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor('#6b7280');
  doc.text('Folio: __________', ANCHO - MARGEN - 35, y + 12, { align: 'center' });
  doc.setLineWidth(0.2);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor('#1f2937');
  y = parrafos(doc, [
    `Fecha: ${fFecha(d.fechaCalculo)}`,
    `Receptor: ${d.deudor.nombre}${d.deudor.rut ? ` — RUT ${d.deudor.rut}` : ''}`,
    `Referencia: Factura ${d.numeroFactura ? `N° ${d.numeroFactura}` : 's/n'}${d.oc ? ` · OC ${d.oc}` : ''}` +
      `${d.fechaEmision ? ` · emitida ${fFechaCorta(d.fechaEmision)}` : ''}.`,
  ], y + 24);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN },
    head: [['Detalle', 'Valor exento']],
    body: [
      [`Intereses por mora en el pago de la Factura ${d.numeroFactura ? `N° ${d.numeroFactura}` : 's/n'} (${d.interes.diasAtraso} días)`, CLP(d.interes.interes)],
      ['TOTAL NOTA DE DÉBITO (exenta de IVA)', CLP(d.interes.interes)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [185, 28, 28], textColor: 255, fontStyle: 'bold' },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data) => { if (data.row.index === 1) data.cell.styles.fontStyle = 'bold'; },
  });
  // @ts-expect-error lastAutoTable lo agrega el plugin en runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor('#1e293b');
  if (y > 297 - MARGEN - 10) { doc.addPage(); y = MARGEN; }
  doc.text('Glosa técnica y fundamento legal', MARGEN, y); y += 6;

  // Tabla del prorrateo por tramos.
  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN },
    head: [['Periodo', 'Días', 'Tasa anual', 'Interés']],
    body: d.interes.detalle.map((t) => [
      fMes(t.mes), String(t.dias), t.tasa_anual != null ? `${t.tasa_anual}%` : 's/i', CLP(t.interes),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [71, 85, 105], textColor: 255 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });
  // @ts-expect-error lastAutoTable lo agrega el plugin en runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 6;

  y = parrafos(doc, glosaInteresMora(d), y, 9);

  numerarPaginas(doc);
  return doc;
}

function numerarPaginas(doc: jsPDF) {
  const paginas = doc.getNumberOfPages();
  if (paginas <= 1) return;
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor('#94a3b8');
    doc.text(`Página ${i} de ${paginas}`, ANCHO - MARGEN, 297 - 10, { align: 'right' });
  }
}

export function descargarNotaCobroPDF(d: DatosNotaCobranza): void {
  generarNotaCobroPDF(d).save(`nota_cobro_${slug(d.deudor.nombre)}_${d.numeroFactura || 's_n'}.pdf`);
}

export function descargarNotaDebitoExentaPDF(d: DatosNotaCobranza): void {
  generarNotaDebitoExentaPDF(d).save(`nota_debito_exenta_${slug(d.deudor.nombre)}_${d.numeroFactura || 's_n'}.pdf`);
}

// --- Para adjuntar al correo (Gmail): PDFs en base64 + cuerpo HTML -------------
function docBase64(doc: jsPDF): string {
  const buf = new Uint8Array(doc.output('arraybuffer'));
  let bin = ''; const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(bin);
}

export function notaCobroBase64(d: DatosNotaCobranza): { filename: string; base64: string } {
  return { filename: `nota_cobro_${slug(d.deudor.nombre)}_${d.numeroFactura || 's_n'}.pdf`, base64: docBase64(generarNotaCobroPDF(d)) };
}

export function notaDebitoExentaBase64(d: DatosNotaCobranza): { filename: string; base64: string } {
  return { filename: `nota_debito_exenta_${slug(d.deudor.nombre)}_${d.numeroFactura || 's_n'}.pdf`, base64: docBase64(generarNotaDebitoExentaPDF(d)) };
}

// Cuerpo HTML del correo de cobro con la base técnica/legal (respaldo del envío).
export function cuerpoCorreoCobroHtml(d: DatosNotaCobranza): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const glosa = glosaInteresMora(d).map((l) => `<p style="margin:0 0 8px">${esc(l)}</p>`).join('');
  const hayInteres = d.interes.interes > 0;
  return `<div style="font-family:Arial,sans-serif;max-width:640px;color:#1f2937">
    <p>Estimados ${esc(d.deudor.nombre)}:</p>
    <p>Junto con saludar, y habiendo transcurrido el plazo legal de pago, adjuntamos la <strong>nota de cobro</strong>${hayInteres ? ' y la <strong>nota de débito exenta</strong> por intereses de mora' : ''} correspondiente${d.numeroFactura ? ` a la factura N° ${esc(d.numeroFactura)}` : ''}${d.oc ? ` (OC ${esc(d.oc)})` : ''}.</p>
    <p><strong>Capital:</strong> ${CLP(d.capital)}${hayInteres ? ` &middot; <strong>Interés por mora:</strong> ${CLP(d.interes.interes)} &middot; <strong>Total:</strong> ${CLP(d.capital + d.interes.interes)}` : ''}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0">
    <p style="font-size:13px;color:#4b5563"><strong>Respaldo técnico y legal</strong></p>
    <div style="font-size:12px;color:#4b5563">${glosa}</div>
    <p style="font-size:12px;color:#6b7280">Se adjunta la documentación de respaldo. Agradecemos regularizar el pago a la brevedad.</p>
    <p>Atentamente,<br>${esc(d.empresa.nombre)}${d.empresa.rut ? ` — RUT ${esc(d.empresa.rut)}` : ''}</p>
  </div>`;
}
