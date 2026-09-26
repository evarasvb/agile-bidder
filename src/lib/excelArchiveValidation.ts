import { Unzip, UnzipInflate } from 'fflate';

export const MAX_SPREADSHEET_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
export const MAX_SPREADSHEET_ENTRY_BYTES = 25 * 1024 * 1024;
export const MAX_SPREADSHEET_ARCHIVE_ENTRIES = 5_000;

export type SpreadsheetArchiveErrorCode = 'archive_too_large' | 'invalid_file';

export class SpreadsheetArchiveValidationError extends Error {
  constructor(
    message: string,
    public readonly code: SpreadsheetArchiveErrorCode,
  ) {
    super(message);
    this.name = 'SpreadsheetArchiveValidationError';
  }
}

interface SpreadsheetArchiveLimits {
  maxTotalBytes?: number;
  maxEntryBytes?: number;
  maxEntries?: number;
}

export function measureSpreadsheetArchiveUncompressedBytes(
  buffer: ArrayBuffer,
  limits: SpreadsheetArchiveLimits = {},
): number {
  const maxTotalBytes = limits.maxTotalBytes ?? MAX_SPREADSHEET_UNCOMPRESSED_BYTES;
  const maxEntryBytes = limits.maxEntryBytes ?? MAX_SPREADSHEET_ENTRY_BYTES;
  const maxEntries = limits.maxEntries ?? MAX_SPREADSHEET_ARCHIVE_ENTRIES;
  let expandedBytes = 0;
  let entries = 0;
  let failure: SpreadsheetArchiveValidationError | undefined;

  const unzip = new Unzip((file) => {
    entries += 1;
    if (failure || entries > maxEntries) {
      failure ??= new SpreadsheetArchiveValidationError(
        'El archivo .xlsx contiene demasiados elementos.',
        'invalid_file',
      );
      file.terminate();
      return;
    }

    let entryBytes = 0;
    file.ondata = (error, chunk) => {
      if (failure) {
        file.terminate();
        return;
      }
      if (error) {
        failure = new SpreadsheetArchiveValidationError('El archivo .xlsx no es válido.', 'invalid_file');
        file.terminate();
        return;
      }

      entryBytes += chunk.byteLength;
      expandedBytes += chunk.byteLength;
      if (entryBytes > maxEntryBytes || expandedBytes > maxTotalBytes) {
        failure = new SpreadsheetArchiveValidationError(
          'El archivo .xlsx se expande sobre el máximo seguro.',
          'archive_too_large',
        );
        file.terminate();
        throw failure;
      }
    };

    try {
      file.start();
    } catch (error) {
      if (error instanceof SpreadsheetArchiveValidationError) throw error;
      failure = new SpreadsheetArchiveValidationError('El archivo .xlsx no es válido.', 'invalid_file');
      file.terminate();
    }
  });

  unzip.register(UnzipInflate);
  try {
    unzip.push(new Uint8Array(buffer), true);
  } catch (error) {
    failure ??= error instanceof SpreadsheetArchiveValidationError
      ? error
      : new SpreadsheetArchiveValidationError('El archivo .xlsx no es válido.', 'invalid_file');
  }

  if (failure) throw failure;
  if (entries === 0) {
    throw new SpreadsheetArchiveValidationError('El archivo .xlsx no contiene elementos.', 'invalid_file');
  }
  return expandedBytes;
}
