import ExcelJS from 'exceljs';
import { zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_SPREADSHEET_FILE_BYTES,
  MAX_SPREADSHEET_CELL_CHARACTERS,
  MAX_SPREADSHEET_HEADER_CHARACTERS,
  SpreadsheetReadError,
  buildSpreadsheetWorkbook,
  measureSpreadsheetArchiveUncompressedBytes,
  readFirstSpreadsheetSheet,
  recordsToSpreadsheetRows,
  validateSpreadsheetArchive,
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

  it('mide la expansión real aunque el directorio ZIP declare un tamaño menor', async () => {
    const archive = zipSync({ 'xl/sharedStrings.xml': new Uint8Array(1_024).fill(65) });
    const endSignature = [0x50, 0x4b, 0x01, 0x02];
    const directoryOffset = archive.findIndex((_, index) => endSignature.every((byte, offset) => archive[index + offset] === byte));
    expect(directoryOffset).toBeGreaterThanOrEqual(0);
    new DataView(archive.buffer, archive.byteOffset, archive.byteLength).setUint32(directoryOffset + 24, 1, true);

    expect(measureSpreadsheetArchiveUncompressedBytes(archive.slice().buffer)).toBe(1_024);
  });

  it('interrumpe la descompresión cuando una entrada supera el límite real', () => {
    const archive = zipSync({ 'xl/sharedStrings.xml': new Uint8Array(1_024).fill(65) });
    expect(() => measureSpreadsheetArchiveUncompressedBytes(archive.slice().buffer, { maxEntryBytes: 512 }))
      .toThrow('máximo seguro');
  });

  it('rechaza celdas excesivas antes de convertirlas en objetos', async () => {
    const csv = new TextEncoder().encode(`Código;Descripción\nSKU-1;${'A'.repeat(MAX_SPREADSHEET_CELL_CHARACTERS + 1)}\n`);
    await expect(readFirstSpreadsheetSheet(spreadsheetFile('productos.csv', csv.buffer)))
      .rejects.toMatchObject<Partial<SpreadsheetReadError>>({ code: 'cell_too_large' });
  });

  it('reconoce la declaración sep=; usada por Excel', async () => {
    const csv = new TextEncoder().encode('sep=;\r\nCódigo;Descripción\r\nSKU-1;Lápiz\r\n');
    await expect(readFirstSpreadsheetSheet(spreadsheetFile('productos.csv', csv.buffer))).resolves.toEqual([
      { Código: 'SKU-1', Descripción: 'Lápiz' },
    ]);
  });

  it('lee CSV Windows-1252 cuando no es UTF-8 válido', async () => {
    const csv = Uint8Array.from([
      ...new TextEncoder().encode('Codigo;Descripcion\r\nSKU-1;L'),
      0xe1,
      ...new TextEncoder().encode('piz\r\n'),
    ]);
    await expect(readFirstSpreadsheetSheet(spreadsheetFile('productos.csv', csv.buffer))).resolves.toEqual([
      { Codigo: 'SKU-1', Descripcion: 'Lápiz' },
    ]);
  });

  it('rechaza encabezados excesivos', async () => {
    const csv = new TextEncoder().encode(`${'A'.repeat(MAX_SPREADSHEET_HEADER_CHARACTERS + 1)}\nvalor\n`);
    await expect(readFirstSpreadsheetSheet(spreadsheetFile('productos.csv', csv.buffer)))
      .rejects.toMatchObject<Partial<SpreadsheetReadError>>({ code: 'cell_too_large' });
  });

  it('rechaza texto enriquecido excesivo en XLSX', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Productos');
    sheet.getCell('A1').value = 'Descripción';
    sheet.getCell('A2').value = {
      richText: [
        { text: 'A'.repeat(MAX_SPREADSHEET_CELL_CHARACTERS) },
        { text: 'B' },
      ],
    };
    const written = await workbook.xlsx.writeBuffer();
    const buffer = written instanceof ArrayBuffer
      ? written
      : new Uint8Array(written as unknown as Uint8Array).slice().buffer;

    await expect(readFirstSpreadsheetSheet(spreadsheetFile('productos.xlsx', buffer)))
      .rejects.toMatchObject<Partial<SpreadsheetReadError>>({ code: 'cell_too_large' });
  });

  it('corta un worker de validación que excede ocho segundos', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', class {
      onmessage = null;
      onerror = null;
      postMessage() {}
      terminate() {}
    });

    try {
      const validation = expect(validateSpreadsheetArchive(new ArrayBuffer(8)))
        .rejects.toThrow('excedió el tiempo seguro');
      await vi.advanceTimersByTimeAsync(8_001);
      await validation;
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});
