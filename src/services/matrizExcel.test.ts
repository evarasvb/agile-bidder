import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveObjectURL } from 'node:buffer';
import ExcelJS from 'exceljs';
import { matrizAExcelPro } from './matrizExcel';
import { confirmarEstadoAdmisibilidad } from '../lib/admisibilidad';

let anchor: { href: string; download: string; click: () => void };
const originalTimeout = globalThis.setTimeout;

describe('exportación real xlsx de admisibilidad con fixtures', () => {
  beforeEach(() => {
    anchor = { href: '', download: '', click: vi.fn() };
    vi.stubGlobal('document', { createElement: () => anchor });
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback, delay, ...args) => delay === 10_000 ? 0 : originalTimeout(callback, delay, ...args)) as typeof setTimeout);
  });
  afterEach(() => { if (anchor.href) URL.revokeObjectURL(anchor.href); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  async function exported() {
    const blob = resolveObjectURL(anchor.href)!;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await blob.arrayBuffer()));
    return workbook.getWorksheet('Admisibilidad')!;
  }
  it('texto pendiente no sale como cumple y el resumen exige todas las filas verificadas', async () => {
    await matrizAExcelPro({ codigo: 'FIXTURE', admisibilidad: [{ requisito: 'Certificado', entrada: 'Certificado pendiente de obtener', estado: 'cumple' }] });
    const ws = await exported();
    const value = ws.getCell('D5').value as ExcelJS.CellFormulaValue;
    expect(value.result).toBe('REVISAR');
    expect(value.formula).toBe('IF(C5="","PENDIENTE","REVISAR")');
    const summary = ws.getCell('D7').value as ExcelJS.CellFormulaValue;
    expect(summary.formula).toContain('COUNTIF(D5:D5,"CUMPLE")+COUNTIF(D5:D5,"NO APLICA")=1');
    expect(summary.result).toBe('FALTAN DATOS');
  });
  it.each([['no_cumple', 'NO CUMPLE'], ['no_aplica', 'NO APLICA']])('exporta número chileno y conserva decisión %s ligada al valor exportado', async (estado, label) => {
    const row = confirmarEstadoAdmisibilidad({ entrada: '1.234,5', chequeo: { tipo: 'minimo', umbral: 1 } }, estado);
    await matrizAExcelPro({ admisibilidad: [{ ...row, requisito: 'Valor revisado' }] });
    const ws = await exported();
    expect(ws.getCell('C5').value).toBe(1234.5);
    const value = ws.getCell('D5').value as ExcelJS.CellFormulaValue;
    expect(value.result).toBe(label);
    expect(value.formula).toContain(`IF(AND(ISNUMBER(C5),C5=1234.5),"${label}"`);
  });
  it('matriz sin requisitos no declara admisible', async () => {
    await matrizAExcelPro({ admisibilidad: [] });
    const ws = await exported();
    expect(ws.getCell('D6').value).toBe('FALTAN DATOS');
  });
});
