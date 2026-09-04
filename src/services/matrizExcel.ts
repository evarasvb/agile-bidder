// Matriz de postulación en Excel "de verdad": entradas del usuario, fórmulas de cumplimiento y de puntaje,
// listas desplegables y formato condicional (rojo/verde/amarillo). Se carga ExcelJS solo al exportar.
import type { Matriz } from '@/components/experto/MatrizPostulacion';

const NAVY = 'FF1B2540';
const num = (v: any): number | null => { if (v == null || v === '') return null; const n = Number(String(v).replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const pond = (r: any): number | null => { const n = r.ponderacion_num != null ? Number(r.ponderacion_num) : num(r.ponderacion); if (n == null) return null; return n > 1 ? n / 100 : n; };

export async function matrizAExcelPro(m: Matriz) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook(); wb.creator = 'Experto FirmaVB';
  const cab = (ws: any, fila: number, cols: string[], anchos: number[]) => {
    const r = ws.getRow(fila); r.values = cols; r.font = { bold: true, color: { argb: 'FFFFFFFF' } }; r.alignment = { vertical: 'middle', wrapText: true }; r.height = 22;
    cols.forEach((_, i) => { r.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; ws.getColumn(i + 1).width = anchos[i]; });
    ws.views = [{ state: 'frozen', ySplit: fila }];
  };
  const titulo = (ws: any, texto: string, sub?: string) => { ws.mergeCells('A1:F1'); const c = ws.getCell('A1'); c.value = texto; c.font = { bold: true, size: 14, color: { argb: NAVY } }; if (sub) { ws.mergeCells('A2:F2'); ws.getCell('A2').value = sub; ws.getCell('A2').font = { italic: true, color: { argb: 'FF666666' } }; } };
  const entrada = (c: any) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7CC' } }; c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; };
  const semaforo = (ws: any, rango: string) => {
    ws.addConditionalFormatting({ ref: rango, rules: [
      { type: 'containsText', operator: 'containsText', text: 'NO CUMPLE', style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF8D7DA' } }, font: { color: { argb: 'FF842029' }, bold: true } } },
      { type: 'containsText', operator: 'containsText', text: 'INADMISIBLE', style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF8D7DA' } }, font: { color: { argb: 'FF842029' }, bold: true } } },
      { type: 'containsText', operator: 'containsText', text: 'BAJO', style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF8D7DA' } }, font: { color: { argb: 'FF842029' }, bold: true } } },
      { type: 'containsText', operator: 'containsText', text: 'PENDIENTE', style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFF3CD' } }, font: { color: { argb: 'FF664D03' } } } },
      { type: 'containsText', operator: 'containsText', text: 'FALTAN', style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFF3CD' } }, font: { color: { argb: 'FF664D03' } } } },
      { type: 'containsText', operator: 'containsText', text: 'CUMPLE', style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFD1E7DD' } }, font: { color: { argb: 'FF0F5132' }, bold: true } } },
      { type: 'containsText', operator: 'containsText', text: 'ADMISIBLE', style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFD1E7DD' } }, font: { color: { argb: 'FF0F5132' }, bold: true } } },
      { type: 'containsText', operator: 'containsText', text: 'SOBRE', style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFD1E7DD' } }, font: { color: { argb: 'FF0F5132' }, bold: true } } },
      { type: 'containsText', operator: 'containsText', text: 'OK', style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFD1E7DD' } }, font: { color: { argb: 'FF0F5132' } } } },
    ] });
  };

  // 1. Admisibilidad: entrada del usuario + fórmula de cumplimiento
  const ws = wb.addWorksheet('Admisibilidad');
  titulo(ws, m.titulo ?? 'Matriz de postulación', 'Llena la columna ENTRADA (amarilla). Si una fila dice NO CUMPLE, la oferta queda fuera. Generado con el Experto FirmaVB · firmavb.cl');
  cab(ws, 4, ['Requisito', 'Regla de las bases', 'ENTRADA (tu dato)', 'Estado', 'Fuente', 'Nota'], [34, 48, 18, 16, 16, 40]);
  const adm = m.admisibilidad ?? [];
  adm.forEach((r: any, i: number) => {
    const f = 5 + i; const ch = r.chequeo ?? {}; const tipo = String(ch.tipo ?? (/^(s[ií]|no)$/i.test(String(r.entrada ?? '')) ? 'si_no' : 'texto'));
    const u = num(ch.umbral), u2 = num(ch.umbral2);
    const row = ws.getRow(f); row.values = [r.requisito ?? '', r.regla ?? '', r.entrada ?? '', '', r.fuente ?? '', r.nota ?? '']; row.alignment = { vertical: 'top', wrapText: true };
    const c = row.getCell(3); entrada(c);
    let formula: string;
    if (tipo === 'si_no') { const esp = /^no$/i.test(String(ch.esperado ?? '')) ? 'NO' : 'SÍ'; c.dataValidation = { type: 'list', allowBlank: true, formulae: ['"SÍ,NO"'] }; formula = `IF(C${f}="","PENDIENTE",IF(UPPER(C${f})="${esp}","CUMPLE","NO CUMPLE"))`; }
    else if (tipo === 'minimo' && u != null) formula = `IF(C${f}="","PENDIENTE",IF(C${f}>=${u},"CUMPLE","NO CUMPLE"))`;
    else if (tipo === 'maximo' && u != null) formula = `IF(C${f}="","PENDIENTE",IF(C${f}<=${u},"CUMPLE","NO CUMPLE"))`;
    else if (tipo === 'rango' && u != null && u2 != null) formula = `IF(C${f}="","PENDIENTE",IF(AND(C${f}>=${u},C${f}<=${u2}),"CUMPLE","NO CUMPLE"))`;
    else formula = `IF(C${f}="","PENDIENTE","CUMPLE")`;
    if (tipo !== 'si_no' && tipo !== 'texto') { c.dataValidation = { type: 'decimal', allowBlank: true, formulae: [], showErrorMessage: true, errorTitle: 'Número', error: 'Escribe un número' + (ch.unidad ? ` (${ch.unidad})` : '') }; }
    row.getCell(4).value = { formula, result: r.entrada ? undefined : 'PENDIENTE' } as any;
  });
  const fin = 4 + adm.length;
  const res = fin + 2;
  ws.getCell(`A${res}`).value = 'RESULTADO DE ADMISIBILIDAD'; ws.getCell(`A${res}`).font = { bold: true };
  ws.getCell(`D${res}`).value = { formula: `IF(COUNTIF(D5:D${fin},"NO CUMPLE")>0,"INADMISIBLE",IF(COUNTIF(D5:D${fin},"PENDIENTE")>0,"FALTAN DATOS","ADMISIBLE"))`, result: 'FALTAN DATOS' } as any;
  ws.getCell(`D${res}`).font = { bold: true };
  semaforo(ws, `D5:D${res}`);

  // 2. Evaluación: puntaje esperado × ponderación, total y umbral
  const ev = wb.addWorksheet('Evaluación');
  titulo(ev, 'Cómo se puntúa', 'Escribe en MI PUNTAJE (amarillo) lo que esperas obtener en cada criterio (0 al máximo). El total ponderado se calcula solo.');
  cab(ev, 4, ['Criterio', 'Cómo se puntúa', 'Puntaje máx.', 'Ponderación', 'MI PUNTAJE', 'Puntaje ponderado', 'Qué hacer para el máximo'], [30, 40, 12, 12, 12, 16, 44]);
  const evs = m.evaluacion ?? [];
  evs.forEach((r: any, i: number) => {
    const f = 5 + i; const pmax = r.puntaje_max_num != null ? Number(r.puntaje_max_num) : (num(r.puntaje_max) ?? 100); const pd = pond(r);
    const row = ev.getRow(f); row.values = [r.criterio ?? '', r.como_se_puntua ?? '', pmax, pd ?? '', r.puntaje_estimado ?? '', '', r.que_hacer ?? '']; row.alignment = { vertical: 'top', wrapText: true };
    row.getCell(4).numFmt = '0%'; const c = row.getCell(5); entrada(c); c.dataValidation = { type: 'decimal', allowBlank: true, formulae: [0, pmax], showErrorMessage: true, error: `Entre 0 y ${pmax}` };
    row.getCell(6).value = { formula: `IF(OR(E${f}="",D${f}=""),"",E${f}*D${f})` } as any; row.getCell(6).numFmt = '0.00';
  });
  const fe = 4 + evs.length; const tot = fe + 2;
  ev.getCell(`A${tot}`).value = 'TOTAL PONDERADO'; ev.getCell(`A${tot}`).font = { bold: true };
  ev.getCell(`F${tot}`).value = { formula: `SUM(F5:F${fe})` } as any; ev.getCell(`F${tot}`).font = { bold: true }; ev.getCell(`F${tot}`).numFmt = '0.00';
  const umbral = num(m.umbral_adjudicacion);
  ev.getCell(`A${tot + 1}`).value = 'UMBRAL MÍNIMO (según bases; edítalo si cambia)'; ev.getCell(`F${tot + 1}`).value = umbral ?? ''; entrada(ev.getCell(`F${tot + 1}`));
  ev.getCell(`A${tot + 2}`).value = 'VEREDICTO'; ev.getCell(`A${tot + 2}`).font = { bold: true };
  ev.getCell(`F${tot + 2}`).value = { formula: `IF(F${tot + 1}="","SIN UMBRAL",IF(F${tot}>=F${tot + 1},"SOBRE EL UMBRAL","BAJO EL UMBRAL"))` } as any; ev.getCell(`F${tot + 2}`).font = { bold: true };
  semaforo(ev, `F${tot + 2}:F${tot + 2}`);

  // 3. Tareas con estado desplegable
  const ta = wb.addWorksheet('Plan de tareas');
  titulo(ta, 'Plan de tareas', 'Cambia ESTADO: OK (listo y probado), VERIFICAR, NO APLICA o SOLO SI ADJUDICA (se entrega después de adjudicar).');
  const ESTADO_XLS: Record<string, string> = { ok: 'OK', verificar: 'VERIFICAR', no_aplica: 'NO APLICA', solo_si_adjudica: 'SOLO SI ADJUDICA' };
  cab(ta, 4, ['Estado', 'Fase', 'Documento', 'Responsable', 'Acción', 'Plazo'], [12, 24, 28, 20, 50, 18]);
  (m.tareas ?? []).forEach((r: any, i: number) => { const f = 5 + i; const row = ta.getRow(f); row.values = [ESTADO_XLS[r.estado] ?? 'PENDIENTE', r.fase ?? '', r.documento ?? '', r.responsable ?? '', r.accion ?? '', r.plazo ?? '']; row.alignment = { vertical: 'top', wrapText: true }; entrada(row.getCell(1)); row.getCell(1).dataValidation = { type: 'list', allowBlank: false, formulae: ['"PENDIENTE,OK,VERIFICAR,NO APLICA,SOLO SI ADJUDICA"'] }; });
  semaforo(ta, `A5:A${4 + (m.tareas ?? []).length}`);

  // 4. Anexos, reglas y fechas (referencia)
  const simple = (nombre: string, cols: string[], anchos: number[], filas: any[][]) => { const w = wb.addWorksheet(nombre); cab(w, 1, cols, anchos); filas.forEach((v, i) => { const r = w.getRow(2 + i); r.values = v; r.alignment = { vertical: 'top', wrapText: true }; }); };
  simple('Anexos', ['Anexo', 'Obligatorio', 'Cuándo', 'Quién firma', 'Nota'], [34, 12, 22, 24, 44], (m.anexos ?? []).map((a: any) => [a.anexo, a.obligatorio ? 'Sí' : 'No', a.cuando, a.quien_firma, a.nota]));
  simple('Reglas especiales', ['Aspecto', 'Regla'], [30, 90], (m.reglas_especiales ?? []).map((a: any) => [a.aspecto, a.regla]));
  simple('Fechas', ['Hito', 'Fecha'], [40, 30], (m.fechas ?? []).map((a: any) => [a.hito, a.fecha]));
  if (m.garantias?.length) simple('Garantías', ['Garantía', 'Exigida', 'Monto o %', 'Beneficiario', 'Glosa', 'Vigencia', 'Fuente'], [24, 10, 18, 28, 40, 18, 18], m.garantias.map((g: any) => [g.tipo, g.exigida === false ? 'No' : 'Sí', g.monto_o_porcentaje, g.beneficiario, g.glosa, g.vigencia, g.fuente]));
  if (m.secuencia_carga?.length) simple('Secuencia de carga', ['N°', 'Documento', 'Dónde se sube'], [6, 60, 30], m.secuencia_carga.map((c: any) => [c.orden, c.documento, c.donde]));
  if (m.pendientes_humanos?.length) simple('Pendientes empresa', ['N°', 'Debe validar la empresa'], [6, 100], m.pendientes_humanos.map((t: any, i: number) => [i + 1, typeof t === 'string' ? t : t.texto]));

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = `${m.codigo ?? 'licitacion'}-matriz-postulacion.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
