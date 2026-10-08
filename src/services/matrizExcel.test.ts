/** © 2024-2026 Firma VB SpA. Todos los derechos reservados. Software propietario. */
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { revisarRequisito } from '@/lib/matrizValidation';
import { crearMatrizWorkbook } from './matrizExcel';

describe('fail-closed matrix workbook', () => {
  it('keeps stale or unverified source exports under review without losing input values', async () => {
    const row = revisarRequisito({ requisito: 'Prueba', entrada: 'Dato completo', fuente: 'Bases p. 3', chequeo: { tipo: 'texto' } }, 'cumple');
    const w = await crearMatrizWorkbook({ admisibilidad: [row], evaluacion: [{ criterio: 'Prueba', fuente: 'Bases p. 4', ponderacion: '100%', puntaje_max: 100, puntaje_estimado: 80 }], umbral_adjudicacion: 0 }, true);
    expect(w.getWorksheet('Admisibilidad')!.getCell('C5').value).toBe('Dato completo');
    expect(w.getWorksheet('Admisibilidad')!.getCell('D5').result).toBe('REVISAR');
    expect(w.getWorksheet('Admisibilidad')!.getCell('D5').formula).not.toContain('"CUMPLE"');
    expect(w.getWorksheet('Admisibilidad')!.getCell('D7').result).toBe('FALTAN DATOS');
    expect(w.getWorksheet('Evaluación')!.getCell('F5').formula).toBe('"REVISAR"');
    expect(w.getWorksheet('Evaluación')!.getCell('F9').result).toBe('FALTAN DATOS');
  });
  it('never constructs reversed ranges or positive verdicts from empty lists', async () => {
    const w = await crearMatrizWorkbook({ umbral_adjudicacion: 0 });
    expect(w.getWorksheet('Admisibilidad')!.getCell('D6').value).toEqual({ formula: '"FALTAN DATOS"', result: 'FALTAN DATOS' });
    expect(w.getWorksheet('Evaluación')!.getCell('F6').value).toEqual({ formula: '"FALTAN DATOS"', result: 'FALTAN DATOS' });
    expect(w.getWorksheet('Evaluación')!.getCell('F8').result).toBe('FALTAN DATOS');
  });
  it('preserves all original inputs and only normalizes unambiguous numeric values', async () => {
    const values = ['0.001', '1.000', 'no informado', '4', '0'];
    const w = await crearMatrizWorkbook({ admisibilidad: values.map(entrada => ({ entrada, estado: 'cumple', fuente: 'Bases sintéticas p. 3', chequeo: { tipo: 'minimo', umbral: 1 } })) });
    const ws = w.getWorksheet('Admisibilidad')!;
    expect(values.map((_, i) => ws.getCell(`C${5 + i}`).value)).toEqual([.001, '1.000', 'no informado', 4, 0]);
    expect(values.map((_, i) => ws.getCell(`G${5 + i}`).value)).toEqual(values);
    expect(values.map((_, i) => ws.getCell(`D${5 + i}`).result)).toEqual(['NO CUMPLE', 'REVISAR', 'REVISAR', 'CUMPLE', 'NO CUMPLE']);
    expect(ws.getCell('D5').formula).toContain('ISNUMBER(C5)');
    expect(ws.getCell('D5').formula).toContain('C5>=1');
  });
  it('does not fall through to CUMPLE for missing threshold, source, or text rules', async () => {
    const w = await crearMatrizWorkbook({ admisibilidad: [
      { entrada: 8, fuente: 'Bases p. 3', chequeo: { tipo: 'minimo' } },
      { entrada: 'Documento entregado', fuente: 'Bases p. 3', chequeo: { tipo: 'texto' } },
      { entrada: 8, chequeo: { tipo: 'minimo', umbral: 1 } },
      { entrada: 'SÍ', fuente: 'Bases p. 3', chequeo: { tipo: 'si_no' } },
    ] });
    const ws = w.getWorksheet('Admisibilidad')!;
    for (let row = 5; row <= 8; row++) {
      expect(ws.getCell(`D${row}`).result).toBe('REVISAR');
      expect(ws.getCell(`D${row}`).formula).not.toContain('"CUMPLE"');
    }
    expect(ws.getCell('D10').result).toBe('FALTAN DATOS');
  });
  it('supports documented manual text review and guards edits to its evidence', async () => {
    const row = revisarRequisito({ requisito: 'Documento sintético', entrada: 'Documento completo', fuente: 'Bases, página 3', regla: 'Presentar documento', chequeo: { tipo: 'texto' } }, 'cumple');
    const w = await crearMatrizWorkbook({ admisibilidad: [row] });
    const ws = w.getWorksheet('Admisibilidad')!;
    expect(ws.getCell('D5').result).toBe('CUMPLE');
    expect(ws.getCell('D5').formula).toContain('EXACT(C5&"",L5&"")');
    expect(ws.getCell('D5').formula).toContain('EXACT(E5,J5)');
    expect(ws.getCell('D5').formula).toContain('EXACT(B5,I5)');
    expect(ws.getCell('D5').formula).toContain('EXACT(A5,H5)');
    expect(ws.getCell('D7').result).toBe('ADMISIBLE');
  });
  it('preserves pending review states even when the number passes its threshold', async () => {
    const w = await crearMatrizWorkbook({ admisibilidad: [{ entrada: 4, estado: 'verificar', fuente: 'Bases p. 3', chequeo: { tipo: 'minimo', umbral: 1 } }] });
    const ws = w.getWorksheet('Admisibilidad')!;
    expect(ws.getCell('D5').result).toBe('VERIFICAR');
    expect(ws.getCell('D5').formula).toContain('L5&"")),"VERIFICAR"');
    expect(ws.getCell('D7').result).toBe('FALTAN DATOS');
  });
  it('compares manually reviewed normalized numeric inputs numerically', async () => {
    const row = revisarRequisito({ entrada: '4,5', fuente: 'Bases p. 3', chequeo: { tipo: 'minimo', umbral: 1 } }, 'cumple');
    const w = await crearMatrizWorkbook({ admisibilidad: [row] });
    const ws = w.getWorksheet('Admisibilidad')!;
    expect(ws.getCell('C5').value).toBe(4.5);
    expect(ws.getCell('G5').value).toBe('4,5');
    expect(ws.getCell('D5').formula).toContain('AND(ISNUMBER(C5),C5=L5)');
    expect(ws.getCell('D5').result).toBe('CUMPLE');
  });
  it('keeps long manual evidence in snapshot cells instead of formula literals', async () => {
    const text = 'Evidencia sintética larga. '.repeat(30);
    const row = revisarRequisito({ requisito: text, entrada: 'Documento completo', fuente: text, regla: text, nota: text, chequeo: { tipo: 'texto' } }, 'cumple');
    const w = await crearMatrizWorkbook({ admisibilidad: [row] });
    const ws = w.getWorksheet('Admisibilidad')!;
    for (const col of ['H', 'I', 'J', 'K']) {
      expect(ws.getCell(`${col}5`).value).toBe(text);
      expect(ws.getColumn(col).hidden).toBe(true);
    }
    expect(ws.getCell('D5').formula).not.toContain(text);
    expect(ws.getCell('D5').formula).toContain('EXACT(F5,K5)');
    expect(ws.getCell('D5').result).toBe('CUMPLE');
  });
  it('distinguishes missing scores from zero and requires all weighted criteria', async () => {
    for (const score of ['', 0]) {
      const w = await crearMatrizWorkbook({ evaluacion: [{ criterio: 'Prueba', fuente: 'Bases, p. 4', ponderacion: '100%', puntaje_max: 100, puntaje_estimado: score }], umbral_adjudicacion: 0 });
      const ws = w.getWorksheet('Evaluación')!;
      expect(ws.getCell('F7').result).toBe(score === '' ? 'FALTAN DATOS' : 0);
      expect(ws.getCell('F9').result).toBe(score === '' ? 'FALTAN DATOS' : 'SOBRE EL UMBRAL');
      expect(ws.getCell('F7').formula).toContain('COUNT(F5:F5)=1');
      expect(ws.getCell('F7').formula).toContain('ABS(SUM(D5:D5)-1)');
      expect(ws.getCell('F5').formula).toContain('ISNUMBER(E5)');
    }
  });
  it('preserves an ambiguous threshold and distinguishes it from no threshold', async () => {
    const w = await crearMatrizWorkbook({ evaluacion: [{ criterio: 'Prueba', fuente: 'Bases p. 4', ponderacion: '100%', puntaje_max: 100, puntaje_estimado: 80 }], umbral_adjudicacion: '1.000' });
    expect(w.getWorksheet('Evaluación')!.getCell('F8').value).toBe('1.000');
    expect(w.getWorksheet('Evaluación')!.getCell('F9').result).toBe('REVISAR UMBRAL');
  });
  it('keeps malformed rows incomplete instead of crashing or silently dropping them', async () => {
    const w = await crearMatrizWorkbook({ admisibilidad: [null], evaluacion: [null] });
    expect(w.getWorksheet('Admisibilidad')!.getCell('D7').result).toBe('FALTAN DATOS');
    expect(w.getWorksheet('Evaluación')!.getCell('F7').result).toBe('FALTAN DATOS');
  });
  it('does not acquire a valid score from placeholder evidence on recalculation', async () => {
    const w = await crearMatrizWorkbook({ evaluacion: [{ criterio: 'Prueba', fuente: 'no informado', ponderacion: '100%', puntaje_max: 100, puntaje_estimado: 80 }] });
    expect(w.getWorksheet('Evaluación')!.getCell('F5').formula).toBe('"REVISAR"');
    expect(w.getWorksheet('Evaluación')!.getCell('F7').result).toBe('FALTAN DATOS');
  });
  it('round-trips formulas, cached results, inputs and exact-match color rules', async () => {
    const w = await crearMatrizWorkbook({ admisibilidad: [{ entrada: '0.001', estado: 'cumple', fuente: 'Bases, p. 3', chequeo: { tipo: 'minimo', umbral: 1 } }] });
    const copy = new ExcelJS.Workbook(); await copy.xlsx.load(await w.xlsx.writeBuffer());
    const ws = copy.getWorksheet('Admisibilidad')!;
    expect(ws.getCell('C5').value).toBe(.001);
    expect(ws.getCell('G5').value).toBe('0.001');
    expect(ws.getCell('D5').result).toBe('NO CUMPLE');
    expect(ws.getCell('D5').formula).toContain('IFERROR');
    const rules = (ws as unknown as { conditionalFormattings: { rules: { type: string; formulae?: string[] }[] }[] }).conditionalFormattings[0].rules;
    expect(rules.every(r => r.type === 'expression')).toBe(true);
    expect(rules.some(r => r.formulae?.[0] === 'D5="CUMPLE"')).toBe(true);
    expect(rules.some(r => r.formulae?.[0] === 'D5="NO CUMPLE"')).toBe(true);
  });
});
