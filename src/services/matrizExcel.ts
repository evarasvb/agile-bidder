// Matriz de postulación en Excel "de verdad": entradas del usuario, fórmulas de cumplimiento y de puntaje,
// listas desplegables y formato condicional (rojo/verde/amarillo). Se carga ExcelJS solo al exportar.
import type { Matriz } from '@/components/experto/MatrizPostulacion';
import { evaluarPuntaje, fuenteIdentificada, numeroMatriz as num, ponderacionMatriz as pond, revisionManualVigente, estadoAdmisibilidad } from '@/lib/matrizValidation';

const NAVY = 'FF1B2540';
export async function crearMatrizWorkbook(m: Matriz, fuentesPendientes = false) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook(); wb.creator = 'Don Evaristo';
  const cab = (ws: any, fila: number, cols: string[], anchos: number[]) => {
    const r = ws.getRow(fila); r.values = cols; r.font = { bold: true, color: { argb: 'FFFFFFFF' } }; r.alignment = { vertical: 'middle', wrapText: true }; r.height = 22;
    cols.forEach((_, i) => { r.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; ws.getColumn(i + 1).width = anchos[i]; });
    ws.views = [{ state: 'frozen', ySplit: fila }];
  };
  const titulo = (ws: any, texto: string, sub?: string) => { ws.mergeCells('A1:F1'); const c = ws.getCell('A1'); c.value = texto; c.font = { bold: true, size: 14, color: { argb: NAVY } }; if (sub) { ws.mergeCells('A2:F2'); ws.getCell('A2').value = sub; ws.getCell('A2').font = { italic: true, color: { argb: 'FF666666' } }; } };
  const entrada = (c: any) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7CC' } }; c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; };
  const semaforo = (ws: any, rango: string) => {
    const first = rango.split(':')[0];
    ws.addConditionalFormatting({ ref: rango, rules: [
      ...['NO CUMPLE', 'INADMISIBLE', 'BAJO EL UMBRAL'].map(text => ({ text, bg: 'FFF8D7DA', fg: 'FF842029' })),
      ...['PENDIENTE', 'REVISAR', 'VERIFICAR', 'FALTAN DATOS', 'SIN UMBRAL', 'REVISAR UMBRAL'].map(text => ({ text, bg: 'FFFFF3CD', fg: 'FF664D03' })),
      ...['CUMPLE', 'ADMISIBLE', 'SOBRE EL UMBRAL', 'OK'].map(text => ({ text, bg: 'FFD1E7DD', fg: 'FF0F5132' })),
    ].map(({ text, bg, fg }, i) => ({ type: 'expression', priority: i + 1, stopIfTrue: true, formulae: [`${first}="${text}"`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: bg } }, font: { color: { argb: fg } } } })) });
  };

  // 1. Admisibilidad: entrada del usuario + fórmula de cumplimiento
  const ws = wb.addWorksheet('Admisibilidad');
  titulo(ws, m.titulo ?? 'Matriz de postulación', fuentesPendientes ? 'FUENTES Y VIGENCIA PENDIENTES: conserva estos datos para revisar; no acreditan cumplimiento.' : 'Llena ENTRADA (amarilla). REVISAR requiere validación manual; no significa incumplimiento. Conservamos tu entrada original para contrastar.');
  cab(ws, 4, ['Requisito', 'Regla de las bases', 'ENTRADA (tu dato)', 'Estado', 'Fuente', 'Nota', 'Entrada original'], [34, 48, 18, 18, 24, 40, 24]);
  // Hidden evidence snapshots avoid Excel's 255-character formula literal limit.
  for (const column of ['H', 'I', 'J', 'K', 'L']) ws.getColumn(column).hidden = true;
  const adm = Array.isArray(m.admisibilidad) ? m.admisibilidad.map(row => row && typeof row === 'object' ? row : {}) : [];
  const states: string[] = [];
  adm.forEach((r: any, i: number) => {
    const f = 5 + i; const ch = r.chequeo ?? {}; const tipo = String(ch.tipo ?? 'texto');
    const u = num(ch.umbral), u2 = num(ch.umbral2);
    // La condición ("solo línea 2", "solo si postula como UTP", etc.) se agrega a la regla en vez de
    // una columna nueva: así no se corren las fórmulas de cumplimiento, que apuntan a columnas fijas.
    const regla = r.condicion && !/^siempre$/i.test(String(r.condicion)) ? `${r.regla ?? ''} (${r.condicion})` : (r.regla ?? '');
    const row = ws.getRow(f); row.values = [r.requisito ?? '', regla, (['minimo', 'maximo', 'rango'].includes(tipo) ? num(r.entrada) : null) ?? r.entrada ?? '', '', r.fuente ?? '', r.nota ?? '', r.entrada ?? '']; row.alignment = { vertical: 'top', wrapText: true };
    const c = row.getCell(3); entrada(c);
    let check = '"REVISAR"';
    if (!fuentesPendientes && fuenteIdentificada(r.fuente)) {
      if (tipo === 'si_no' && /^(s[ií]|no)$/i.test(String(ch.esperado ?? '').trim())) {
        const expected = /^no$/i.test(String(ch.esperado).trim()) ? 'NO' : 'SI';
        const actual = `SUBSTITUTE(UPPER(TRIM(C${f})),"Í","I")`;
        c.dataValidation = { type: 'list', allowBlank: true, formulae: ['"SÍ,NO"'], showErrorMessage: true };
        check = `IF(OR(${actual}="SI",${actual}="NO"),IF(${actual}="${expected}","CUMPLE","NO CUMPLE"),"REVISAR")`;
      } else if (tipo === 'minimo' && u != null) check = `IF(ISNUMBER(C${f}),IF(C${f}>=${u},"CUMPLE","NO CUMPLE"),"REVISAR")`;
      else if (tipo === 'maximo' && u != null) check = `IF(ISNUMBER(C${f}),IF(C${f}<=${u},"CUMPLE","NO CUMPLE"),"REVISAR")`;
      else if (tipo === 'rango' && u != null && u2 != null && u <= u2) check = `IF(ISNUMBER(C${f}),IF(AND(C${f}>=${u},C${f}<=${u2}),"CUMPLE","NO CUMPLE"),"REVISAR")`;
    }
    const manual = fuentesPendientes ? null : revisionManualVigente(r) ?? (r.estado === 'no_cumple' ? 'no_cumple' : null);
    const labels: Record<string, string> = { cumple: 'CUMPLE', ok: 'OK', no_cumple: 'NO CUMPLE', no_aplica: 'NO APLICA', solo_si_adjudica: 'SOLO SI ADJUDICA', pendiente: 'PENDIENTE', verificar: 'VERIFICAR' };
    row.getCell(8).value = r.requisito ?? '';
    row.getCell(9).value = regla;
    row.getCell(10).value = r.fuente ?? '';
    row.getCell(11).value = r.nota ?? '';
    row.getCell(12).value = c.value;
    const sameInput = `IF(ISNUMBER(L${f}),AND(ISNUMBER(C${f}),C${f}=L${f}),EXACT(C${f}&"",L${f}&""))`;
    const sameEvidence = `AND(EXACT(A${f},H${f}),EXACT(B${f},I${f}),EXACT(E${f},J${f}))`;
    const state = fuentesPendientes ? 'revisar' : estadoAdmisibilidad(r);
    const initialResult = labels[state] ?? 'REVISAR';
    const manualCheck = manual ? `IF(AND(${sameInput},${sameEvidence},EXACT(F${f},K${f})),"${labels[manual]}","REVISAR")` : null;
    const automaticCheck = `IF(${sameInput},"${initialResult}",IF(TRIM(C${f}&"")="","PENDIENTE",${check}))`;
    const formula = `IFERROR(IF(${sameEvidence},${manualCheck ?? automaticCheck},"REVISAR"),"REVISAR")`;
    if (['minimo', 'maximo', 'rango'].includes(tipo)) c.dataValidation = { type: 'decimal', allowBlank: true, formulae: [], showErrorMessage: true, errorTitle: 'Número', error: 'Escribe un número sin unidades ni separadores ambiguos.' };
    states.push(state);
    row.getCell(4).value = { formula, result: labels[state] ?? 'REVISAR' };

  });
  const fin = 4 + adm.length;
  const res = fin + 2;
  ws.getCell(`A${res}`).value = 'RESULTADO DE ADMISIBILIDAD'; ws.getCell(`A${res}`).font = { bold: true };
  const admissibility = states.includes('no_cumple') ? 'INADMISIBLE' : states.length > 0 && states.every(s => ['cumple', 'ok', 'no_aplica', 'solo_si_adjudica'].includes(s)) ? 'ADMISIBLE' : 'FALTAN DATOS';
  ws.getCell(`D${res}`).value = { formula: adm.length ? `IFERROR(IF(COUNTIF(D5:D${fin},"NO CUMPLE")>0,"INADMISIBLE",IF((COUNTIF(D5:D${fin},"CUMPLE")+COUNTIF(D5:D${fin},"OK")+COUNTIF(D5:D${fin},"NO APLICA")+COUNTIF(D5:D${fin},"SOLO SI ADJUDICA"))=${adm.length},"ADMISIBLE","FALTAN DATOS")),"FALTAN DATOS")` : '"FALTAN DATOS"', result: admissibility };

  ws.getCell(`D${res}`).font = { bold: true };
  semaforo(ws, `D5:D${res}`);

  // 2. Evaluación: puntaje esperado × ponderación, total y umbral
  const ev = wb.addWorksheet('Evaluación');
  titulo(ev, 'Cómo se puntúa', 'Escribe en MI PUNTAJE (amarillo) lo que esperas obtener en cada criterio (0 al máximo). El total ponderado se calcula solo.');
  cab(ev, 4, ['Criterio', 'Cómo se puntúa', 'Puntaje máx.', 'Ponderación', 'MI PUNTAJE', 'Puntaje ponderado', 'Qué hacer para el máximo', 'Fuente', 'Puntaje original'], [30, 40, 12, 12, 12, 18, 44, 24, 24]);
  const evs = Array.isArray(m.evaluacion) ? m.evaluacion.map(row => row && typeof row === 'object' ? row : {}) : [];
  const score = fuentesPendientes ? { complete: false, total: null } : evaluarPuntaje(evs);
  evs.forEach((r: any, i: number) => {
    const f = 5 + i; const pmax = num(r.puntaje_max_num ?? r.puntaje_max); const pd = pond(r);
    const row = ev.getRow(f); row.values = [r.criterio ?? '', r.como_se_puntua ?? '', pmax ?? '', pd ?? '', num(r.puntaje_estimado) ?? r.puntaje_estimado ?? '', '', r.que_hacer ?? '', r.fuente ?? '', r.puntaje_estimado ?? '']; row.alignment = { vertical: 'top', wrapText: true };
    row.getCell(4).numFmt = '0%'; const c = row.getCell(5); entrada(c); if (pmax != null && pmax > 0) c.dataValidation = { type: 'decimal', operator: 'between', allowBlank: true, formulae: [0, pmax], showErrorMessage: true, error: `Entre 0 y ${pmax}` };
    row.getCell(6).value = { formula: fuentesPendientes || !fuenteIdentificada(r.fuente) ? '"REVISAR"' : `IFERROR(IF(AND(TRIM(A${f}&"")<>"",TRIM(H${f}&"")<>"",ISNUMBER(C${f}),C${f}>0,ISNUMBER(E${f}),E${f}>=0,E${f}<=C${f},ISNUMBER(D${f}),D${f}>0,D${f}<=1),E${f}*D${f},"REVISAR"),"REVISAR")` } as any; row.getCell(6).numFmt = '0.00';
  });
  const fe = 4 + evs.length; const tot = fe + 2;
  ev.getCell(`A${tot}`).value = 'TOTAL PONDERADO'; ev.getCell(`A${tot}`).font = { bold: true };
  ev.getCell(`F${tot}`).value = { formula: !fuentesPendientes && evs.length ? `IFERROR(IF(AND(COUNT(F5:F${fe})=${evs.length},ABS(SUM(D5:D${fe})-1)<0.000001),SUM(F5:F${fe}),"FALTAN DATOS"),"FALTAN DATOS")` : '"FALTAN DATOS"', result: score.total ?? 'FALTAN DATOS' } as any; ev.getCell(`F${tot}`).font = { bold: true }; ev.getCell(`F${tot}`).numFmt = '0.00';
  const umbral = num(m.umbral_adjudicacion);
  ev.getCell(`A${tot + 1}`).value = 'UMBRAL MÍNIMO (según bases; edítalo si cambia)'; ev.getCell(`F${tot + 1}`).value = umbral ?? m.umbral_adjudicacion ?? ''; entrada(ev.getCell(`F${tot + 1}`));
  ev.getCell(`A${tot + 2}`).value = 'VEREDICTO'; ev.getCell(`A${tot + 2}`).font = { bold: true };
  ev.getCell(`F${tot + 2}`).value = { formula: `IFERROR(IF(NOT(ISNUMBER(F${tot})),"FALTAN DATOS",IF(F${tot + 1}="","SIN UMBRAL",IF(OR(NOT(ISNUMBER(F${tot + 1})),F${tot + 1}<0),"REVISAR UMBRAL",IF(F${tot}>=F${tot + 1},"SOBRE EL UMBRAL","BAJO EL UMBRAL")))),"FALTAN DATOS")`, result: score.total == null ? 'FALTAN DATOS' : m.umbral_adjudicacion == null || m.umbral_adjudicacion === '' ? 'SIN UMBRAL' : umbral == null || umbral < 0 ? 'REVISAR UMBRAL' : score.total >= umbral ? 'SOBRE EL UMBRAL' : 'BAJO EL UMBRAL' } as any; ev.getCell(`F${tot + 2}`).font = { bold: true };
  semaforo(ev, `F${tot + 2}:F${tot + 2}`);

  // 3. Tareas con estado desplegable
  const ta = wb.addWorksheet('Plan de tareas');
  titulo(ta, 'Plan de tareas', 'Cambia ESTADO: OK (listo y probado), VERIFICAR, NO APLICA o SOLO SI ADJUDICA (se entrega después de adjudicar).');
  const ESTADO_XLS: Record<string, string> = { ok: 'OK', verificar: 'VERIFICAR', no_aplica: 'NO APLICA', solo_si_adjudica: 'SOLO SI ADJUDICA' };
  cab(ta, 4, ['Estado', 'Fase', 'Documento', 'Responsable', 'Acción', 'Plazo'], [12, 24, 28, 20, 50, 18]);
  (m.tareas ?? []).forEach((r: any, i: number) => { const f = 5 + i; const row = ta.getRow(f); row.values = [ESTADO_XLS[r.estado] ?? 'PENDIENTE', r.fase ?? '', r.documento ?? '', r.responsable ?? '', r.accion ?? '', r.plazo ?? '']; row.alignment = { vertical: 'top', wrapText: true }; entrada(row.getCell(1)); row.getCell(1).dataValidation = { type: 'list', allowBlank: false, formulae: ['"PENDIENTE,OK,VERIFICAR,NO APLICA,SOLO SI ADJUDICA"'] }; });
  if (m.tareas?.length) semaforo(ta, `A5:A${4 + m.tareas.length}`);

  // 4. Anexos, reglas y fechas (referencia)
  const simple = (nombre: string, cols: string[], anchos: number[], filas: any[][]) => { const w = wb.addWorksheet(nombre); cab(w, 1, cols, anchos); filas.forEach((v, i) => { const r = w.getRow(2 + i); r.values = v; r.alignment = { vertical: 'top', wrapText: true }; }); };
  simple('Anexos', ['Anexo', 'Obligatorio', 'Cuándo', 'Quién firma', 'Nota'], [34, 12, 22, 24, 44], (m.anexos ?? []).map((a: any) => [a.anexo, a.obligatorio ? 'Sí' : 'No', a.cuando, a.quien_firma, a.nota]));
  simple('Reglas especiales', ['Aspecto', 'Regla'], [30, 90], (m.reglas_especiales ?? []).map((a: any) => [a.aspecto, a.regla]));
  simple('Fechas', ['Hito', 'Fecha'], [40, 30], (m.fechas ?? []).map((a: any) => [a.hito, a.fecha]));
  if (m.garantias?.length) simple('Garantías', ['Garantía', 'Exigida', 'Monto o %', 'Beneficiario', 'Glosa', 'Vigencia', 'Fuente'], [24, 10, 18, 28, 40, 18, 18], m.garantias.map((g: any) => [g.tipo, g.exigida === false ? 'No' : 'Sí', g.monto_o_porcentaje, g.beneficiario, g.glosa, g.vigencia, g.fuente]));
  if (m.secuencia_carga?.length) simple('Secuencia de carga', ['N°', 'Documento', 'Dónde se sube'], [6, 60, 30], m.secuencia_carga.map((c: any) => [c.orden, c.documento, c.donde]));
  if (m.pendientes_humanos?.length) simple('Pendientes empresa', ['N°', 'Debe validar la empresa'], [6, 100], m.pendientes_humanos.map((t: any, i: number) => [i + 1, typeof t === 'string' ? t : t.texto]));

  wb.calcProperties.fullCalcOnLoad = true;
  return wb;
}

export async function matrizAExcelPro(m: Matriz, fuentesPendientes = false) {
  const wb = await crearMatrizWorkbook(m, fuentesPendientes);
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = `${m.codigo ?? 'licitacion'}-matriz-postulacion.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
