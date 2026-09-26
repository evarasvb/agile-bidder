import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_SPREADSHEET_FILE_BYTES,
  SpreadsheetReadError,
  buildSpreadsheetWorkbook,
  readFirstSpreadsheetSheet,
  recordsToSpreadsheetRows,
  type SpreadsheetFile,
} from './excelFiles';

function spreadsheetFile(name: string, buffer: ArrayBuffer): SpreadsheetFile {
  return { name, size: buffer.byteLength, arrayBuffer: async () => buffer };
}

describe('excelFiles', () => {
  it('genera hojas, encabezados, datos y anchos con ExcelJS', async () => {
    const buffer = await buildSpreadsheetWorkbook([
      {
        name: 'Productos',
        rows: recordsToSpreadsheetRows([
          { Código: 'SKU-1', Precio: 15990 },
          { Código: 'SKU-2', Precio: 2990 },
        ], ['Código', 'Precio']),
        columnWidths: [18, 12],
      },
      { name: 'Instrucciones', rows: [['Instrucciones'], ['Completa la plantilla']] },
    ]);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Productos', 'Instrucciones']);
    expect(workbook.getWorksheet('Productos')?.getRow(1).values).toEqual([undefined, 'Código', 'Precio']);
    expect(workbook.getWorksheet('Productos')?.getRow(2).values).toEqual([undefined, 'SKU-1', 15990]);
    expect(workbook.getWorksheet('Productos')?.getColumn(1).width).toBe(18);
  });

  it('lee la primera hoja como objetos usando la primera fila como encabezados', async () => {
    const buffer = await buildSpreadsheetWorkbook([
      {
        name: 'Facturas',
        rows: [
          ['Institución', 'Monto', 'Fecha'],
          ['Municipalidad', 1500000, new Date('2026-08-01T00:00:00.000Z')],
        ],
      },
      { name: 'Ignorada', rows: [['Otro'], ['dato']] },
    ]);

    await expect(readFirstSpreadsheetSheet(spreadsheetFile('facturas.xlsx', buffer))).resolves.toEqual([
      { Institución: 'Municipalidad', Monto: 1500000, Fecha: '2026-08-01' },
    ]);
  });

  it('lee CSV con separador chileno y comillas', async () => {
    const csv = new TextEncoder().encode('Código;Descripción;Precio\r\nSKU-1;"Caja; grande";15990\r\n');
    await expect(readFirstSpreadsheetSheet(spreadsheetFile('productos.csv', csv.buffer))).resolves.toEqual([
      { Código: 'SKU-1', Descripción: 'Caja; grande', Precio: '15990' },
    ]);
  });

  it('rechaza un archivo excesivo antes de cargarlo en memoria', async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
    const file: SpreadsheetFile = {
      name: 'catalogo.xlsx',
      size: MAX_SPREADSHEET_FILE_BYTES + 1,
      arrayBuffer,
    };

    await expect(readFirstSpreadsheetSheet(file)).rejects.toMatchObject<Partial<SpreadsheetReadError>>({
      code: 'file_too_large',
    });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('rechaza .xls antes de leer y explica cómo convertirlo', async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
    await expect(readFirstSpreadsheetSheet({ name: 'antiguo.xls', size: 10, arrayBuffer }))
      .rejects.toThrow('guárdalo como .xlsx');
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
});
