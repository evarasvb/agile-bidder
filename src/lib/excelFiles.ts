import type { CellValue, Worksheet } from 'exceljs';
import {
  MAX_SPREADSHEET_ARCHIVE_ENTRIES,
  MAX_SPREADSHEET_UNCOMPRESSED_BYTES,
  measureSpreadsheetArchiveUncompressedBytes,
  SpreadsheetArchiveValidationError,
} from './excelArchiveValidation';

export { MAX_SPREADSHEET_UNCOMPRESSED_BYTES, measureSpreadsheetArchiveUncompressedBytes } from './excelArchiveValidation';

export const MAX_SPREADSHEET_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_SPREADSHEET_ROWS = 50_000;
export const MAX_SPREADSHEET_COLUMNS = 100;
export const MAX_SPREADSHEET_CELL_CHARACTERS = 10_000;
export const MAX_SPREADSHEET_HEADER_CHARACTERS = 200;

const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type SpreadsheetRow = Record<string, unknown>;

export interface SpreadsheetFile {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export interface SpreadsheetSheet {
  name: string;
  rows: unknown[][];
  columnWidths?: number[];
}

export class SpreadsheetReadError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'file_too_large'
      | 'archive_too_large'
      | 'sheet_too_large'
      | 'cell_too_large'
      | 'unsupported_format'
      | 'invalid_file',
  ) {
    super(message);
    this.name = 'SpreadsheetReadError';
  }
}

function toExcelValue(value: unknown): string | number | boolean | Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

export function recordsToSpreadsheetRows(
  records: ReadonlyArray<Record<string, unknown>>,
  headers: readonly string[] = records.length > 0 ? Object.keys(records[0]) : [],
): unknown[][] {
  return [
    [...headers],
    ...records.map((record) => headers.map((header) => record[header] ?? null)),
  ];
}

export async function buildSpreadsheetWorkbook(sheets: readonly SpreadsheetSheet[]): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.addRows(sheet.rows.map((row) => row.map(toExcelValue)));
    sheet.columnWidths?.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });
  }

  const written = await workbook.xlsx.writeBuffer();
  if (written instanceof ArrayBuffer) return written;
  return new Uint8Array(written as unknown as Uint8Array).slice().buffer;
}

export async function downloadSpreadsheetWorkbook(
  fileName: string,
  sheets: readonly SpreadsheetSheet[],
): Promise<void> {
  const [buffer, fileSaver] = await Promise.all([
    buildSpreadsheetWorkbook(sheets),
    import('file-saver'),
  ]);
  const saveAs = fileSaver.saveAs ?? fileSaver.default;
  saveAs(new Blob([buffer], { type: EXCEL_MIME }), fileName);
}

function normalizedCellValue(value: CellValue): unknown {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== 'object') return value;
  if ('result' in value) return normalizedCellValue(value.result as CellValue);
  if ('richText' in value) {
    let text = '';
    for (const part of value.richText) {
      text += part.text;
      assertSafeImportedCell(text);
    }
    return text;
  }
  if ('text' in value) return assertSafeImportedCell(value.text);
  if ('error' in value) return value.error;
  return String(value);
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function assertSafeImportedCell(value: unknown): unknown {
  if (typeof value === 'string' && value.length > MAX_SPREADSHEET_CELL_CHARACTERS) {
    throw new SpreadsheetReadError(
      `Una celda supera el máximo seguro de ${MAX_SPREADSHEET_CELL_CHARACTERS.toLocaleString('es-CL')} caracteres.`,
      'cell_too_large',
    );
  }
  return value;
}

function uniqueHeaders(values: readonly unknown[]): string[] {
  const seen = new Map<string, number>();
  return values.map((value) => {
    const base = isPresent(value) ? String(value).trim() : '__EMPTY';
    if (base.length > MAX_SPREADSHEET_HEADER_CHARACTERS) {
      throw new SpreadsheetReadError(
        `Un encabezado supera el máximo seguro de ${MAX_SPREADSHEET_HEADER_CHARACTERS} caracteres.`,
        'cell_too_large',
      );
    }
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count}`;
  });
}

function tableToObjects(table: readonly unknown[][]): SpreadsheetRow[] {
  const headerIndex = table.findIndex((row) => row.some(isPresent));
  if (headerIndex < 0) return [];

  const headerRow = table[headerIndex];
  if (headerRow.length > MAX_SPREADSHEET_COLUMNS || table.length - headerIndex - 1 > MAX_SPREADSHEET_ROWS) {
    throw new SpreadsheetReadError(
      `El archivo supera el máximo seguro de ${MAX_SPREADSHEET_ROWS.toLocaleString('es-CL')} filas o ${MAX_SPREADSHEET_COLUMNS} columnas.`,
      'sheet_too_large',
    );
  }

  const headers = uniqueHeaders(headerRow);
  const objects: SpreadsheetRow[] = [];
  for (let rowIndex = headerIndex + 1; rowIndex < table.length; rowIndex += 1) {
    const source = table[rowIndex];
    const target: SpreadsheetRow = {};
    let hasValue = false;
    headers.forEach((header, columnIndex) => {
      const value = assertSafeImportedCell(source[columnIndex]);
      if (isPresent(value)) {
        target[header] = value;
        hasValue = true;
      }
    });
    if (hasValue) objects.push(target);
  }
  return objects;
}

function worksheetToObjects(worksheet: Worksheet): SpreadsheetRow[] {
  if (
    worksheet.rowCount > MAX_SPREADSHEET_ROWS + 1
    || worksheet.columnCount > MAX_SPREADSHEET_COLUMNS
  ) {
    throw new SpreadsheetReadError(
      `El archivo supera el máximo seguro de ${MAX_SPREADSHEET_ROWS.toLocaleString('es-CL')} filas o ${MAX_SPREADSHEET_COLUMNS} columnas.`,
      'sheet_too_large',
    );
  }

  const table: unknown[][] = [];
  for (let rowIndex = 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const values: unknown[] = [];
    for (let columnIndex = 1; columnIndex <= worksheet.columnCount; columnIndex += 1) {
      values.push(normalizedCellValue(row.getCell(columnIndex).value));
    }
    table.push(values);
  }
  return tableToObjects(table);
}

function detectDelimiter(text: string): ',' | ';' | '\t' {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && (char === '\n' || char === '\r')) {
      break;
    } else if (!quoted && (char === ',' || char === ';' || char === '\t')) {
      counts[char] += 1;
    }
  }
  return counts[';'] > counts[','] && counts[';'] >= counts['\t']
    ? ';'
    : counts['\t'] > counts[','] ? '\t' : ',';
}

function parseDelimitedText(text: string): unknown[][] {
  let input = text.replace(/^\uFEFF/, '');
  const separatorDeclaration = input.match(/^sep=(,|;|\t)\r?\n/i);
  const delimiter = separatorDeclaration
    ? separatorDeclaration[1] as ',' | ';' | '\t'
    : detectDelimiter(input);
  if (separatorDeclaration) input = input.slice(separatorDeclaration[0].length);
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  const appendValue = (fragment: string) => {
    value += fragment;
    assertSafeImportedCell(value);
  };

  const pushValue = () => {
    row.push(value);
    value = '';
    if (row.length > MAX_SPREADSHEET_COLUMNS) {
      throw new SpreadsheetReadError(
        `El archivo supera el máximo seguro de ${MAX_SPREADSHEET_COLUMNS} columnas.`,
        'sheet_too_large',
      );
    }
  };
  const pushRow = () => {
    pushValue();
    rows.push(row);
    row = [];
    if (rows.length > MAX_SPREADSHEET_ROWS + 1) {
      throw new SpreadsheetReadError(
        `El archivo supera el máximo seguro de ${MAX_SPREADSHEET_ROWS.toLocaleString('es-CL')} filas.`,
        'sheet_too_large',
      );
    }
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        appendValue('"');
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === delimiter) {
      pushValue();
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      pushRow();
    } else {
      appendValue(char);
    }
  }
  if (quoted) throw new SpreadsheetReadError('El archivo CSV tiene comillas sin cerrar.', 'invalid_file');
  if (value.length > 0 || row.length > 0) pushRow();
  return rows;
}

function assertSafeZipArchive(buffer: ArrayBuffer): void {
  const view = new DataView(buffer);
  const minimumOffset = Math.max(0, buffer.byteLength - 65_557);
  let endOffset = -1;
  for (let offset = buffer.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new SpreadsheetReadError('El archivo .xlsx no es válido.', 'invalid_file');

  const entryCount = view.getUint16(endOffset + 10, true);
  const directorySize = view.getUint32(endOffset + 12, true);
  const directoryOffset = view.getUint32(endOffset + 16, true);
  if (entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    throw new SpreadsheetReadError('El archivo .xlsx usa un formato ZIP no compatible.', 'invalid_file');
  }
  if (directoryOffset + directorySize > endOffset || entryCount > MAX_SPREADSHEET_ARCHIVE_ENTRIES) {
    throw new SpreadsheetReadError('El archivo .xlsx no es válido.', 'invalid_file');
  }

  let offset = directoryOffset;
  let uncompressedBytes = 0;
  for (let entry = 0; entry < entryCount; entry += 1) {
    if (offset + 46 > endOffset || view.getUint32(offset, true) !== 0x02014b50) {
      throw new SpreadsheetReadError('El archivo .xlsx no es válido.', 'invalid_file');
    }
    const uncompressedSize = view.getUint32(offset + 24, true);
    if (uncompressedSize === 0xffffffff) {
      throw new SpreadsheetReadError('El archivo .xlsx usa un formato ZIP no compatible.', 'invalid_file');
    }
    uncompressedBytes += uncompressedSize;
    if (uncompressedBytes > MAX_SPREADSHEET_UNCOMPRESSED_BYTES) {
      throw new SpreadsheetReadError(
        'El archivo se expande sobre el máximo seguro de 100 MB.',
        'archive_too_large',
      );
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    offset += 46 + nameLength + extraLength + commentLength;
  }
}

export async function validateSpreadsheetArchive(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof Worker === 'undefined') {
    try {
      measureSpreadsheetArchiveUncompressedBytes(buffer);
      return buffer;
    } catch (error) {
      if (error instanceof SpreadsheetArchiveValidationError) {
        throw new SpreadsheetReadError(error.message, error.code);
      }
      throw error;
    }
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./excelArchive.worker.ts', import.meta.url), { type: 'module' });
    const timeout = globalThis.setTimeout(() => {
      worker.terminate();
      reject(new SpreadsheetReadError(
        'La validación del archivo excedió el tiempo seguro de 8 segundos.',
        'invalid_file',
      ));
    }, 8_000);
    const cleanup = () => {
      globalThis.clearTimeout(timeout);
      worker.terminate();
    };

    worker.onmessage = ({ data }: MessageEvent<
      | { ok: true; buffer: ArrayBuffer }
      | { ok: false; code: 'archive_too_large' | 'invalid_file'; message: string }
    >) => {
      cleanup();
      if (data.ok) resolve(data.buffer);
      else reject(new SpreadsheetReadError(data.message, data.code));
    };
    worker.onerror = () => {
      cleanup();
      reject(new SpreadsheetReadError('No se pudo validar el archivo .xlsx.', 'invalid_file'));
    };
    worker.postMessage({ buffer }, [buffer]);
  });
}

function decodeDelimitedBuffer(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

export async function readFirstSpreadsheetSheet(file: SpreadsheetFile): Promise<SpreadsheetRow[]> {
  if (file.size > MAX_SPREADSHEET_FILE_BYTES) {
    throw new SpreadsheetReadError('El archivo supera el máximo seguro de 20 MB.', 'file_too_large');
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'xls') {
    throw new SpreadsheetReadError(
      'El formato .xls antiguo no es compatible. Ábrelo en Excel y guárdalo como .xlsx.',
      'unsupported_format',
    );
  }
  if (extension !== 'xlsx' && extension !== 'csv') {
    throw new SpreadsheetReadError('Formato no soportado. Usa .xlsx o .csv.', 'unsupported_format');
  }

  const buffer = await file.arrayBuffer();
  if (extension === 'csv') {
    return tableToObjects(parseDelimitedText(decodeDelimitedBuffer(buffer)));
  }

  assertSafeZipArchive(buffer);
  const validatedBuffer = await validateSpreadsheetArchive(buffer);
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(validatedBuffer);
  const worksheet = workbook.worksheets[0];
  return worksheet ? worksheetToObjects(worksheet) : [];
}
