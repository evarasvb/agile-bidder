import {
  measureSpreadsheetArchiveUncompressedBytes,
  SpreadsheetArchiveValidationError,
} from './excelArchiveValidation';

interface ValidationRequest {
  buffer: ArrayBuffer;
}

type ValidationResponse =
  | { ok: true; buffer: ArrayBuffer }
  | { ok: false; code: 'archive_too_large' | 'invalid_file'; message: string };

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<ValidationRequest>) => void) | null;
  postMessage: (message: ValidationResponse, transfer?: Transferable[]) => void;
};

workerScope.onmessage = ({ data }) => {
  try {
    measureSpreadsheetArchiveUncompressedBytes(data.buffer);
    workerScope.postMessage({ ok: true, buffer: data.buffer }, [data.buffer]);
  } catch (error) {
    const validationError = error instanceof SpreadsheetArchiveValidationError
      ? error
      : new SpreadsheetArchiveValidationError('El archivo .xlsx no es válido.', 'invalid_file');
    workerScope.postMessage({
      ok: false,
      code: validationError.code,
      message: validationError.message,
    });
  }
};
