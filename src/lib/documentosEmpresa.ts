import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export const DOCUMENT_COLUMNS = 'id, tipo, nombre, archivo_url, created_at';
export interface EmpresaDocument {
  id: string;
  tipo: string;
  nombre: string;
  archivo_url: string;
  created_at: string;
}

interface ReplacementDocument extends EmpresaDocument {
  tipo_codigo: string | null;
  storage_path: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  texto_extraido: string | null;
  usado_en: string[] | null;
}
const REPLACEMENT_COLUMNS = `${DOCUMENT_COLUMNS}, tipo_codigo, storage_path, fecha_emision, fecha_vencimiento, texto_extraido, usado_en`;

// Do not replace evidence already used or carrying derived data. These fields
// exist in the observed schema but are absent from the generated repo types.
function canReplaceDocument(document: ReplacementDocument) {
  const noHistory = document.usado_en === null
    || (Array.isArray(document.usado_en) && document.usado_en.length === 0);
  const noDerivedData = document.tipo_codigo === null && document.texto_extraido === null
    && document.fecha_emision === null && document.fecha_vencimiento === null;
  const matchingStorage = document.storage_path === null || document.storage_path === document.archivo_url;
  return noHistory && noDerivedData && matchingStorage;
}

type DocumentClient = Pick<SupabaseClient<Database>, 'from' | 'storage'>;
type DocumentMetadata = Omit<ReplacementDocument, keyof EmpresaDocument>;
type DocumentDatabase = Database & {
  public: { Tables: { cliente_documentos: {
    Row: DocumentMetadata; Insert: Partial<DocumentMetadata>; Update: Partial<DocumentMetadata>;
  } } };
};

function documentTable(client: DocumentClient) {
  // Narrow schema extension for columns verified in the production catalog.
  // No new client, role or key: the same request and RLS remain in effect.
  return (client as unknown as Pick<SupabaseClient<DocumentDatabase>, 'from'>).from('cliente_documentos');
}
type DocumentFailure = { ok: false; message: string; warning?: string };
type DocumentResult = { ok: true; warning?: string } | DocumentFailure;
type SaveDocumentResult = { ok: true; document: EmpresaDocument; warning?: string } | DocumentFailure;

/** Immediate lock: React state alone cannot block two events before a render. */
export function createDocumentOperationGuard() {
  let busy = false;
  const completedUploads = new Map<string, string>();
  return {
    tryStart(scope: string, fingerprint?: string): 'started' | 'busy' | 'repeated' {
      if (busy) return 'busy';
      if (fingerprint && completedUploads.get(scope) === fingerprint) return 'repeated';
      busy = true;
      return 'started';
    },
    finish(scope: string, fingerprint?: string, completed = false) {
      if (completed) {
        if (fingerprint) completedUploads.set(scope, fingerprint);
        else completedUploads.delete(scope);
      }
      busy = false;
    },
  };
}

export function documentFileFingerprint(file: File) {
  return JSON.stringify([file.name, file.size, file.type, file.lastModified]);
}

function isDefiniteDatabaseFailure(error: { code?: string }, status: number) {
  // SQL errors and rejected HTTP requests cannot have committed this statement.
  // Timeouts, transport failures and server errors can hide a committed write.
  if (error.code === '40003' || /^08/.test(error.code ?? '')) return false;
  return /^[234][0-9A-Z]{4}$/.test(error.code ?? '')
    || (status >= 400 && status < 500 && status !== 408 && status !== 429);
}

async function removeAttemptObject(client: DocumentClient, path: string) {
  try {
    const { data, error } = await client.storage.from('documentos-empresa').remove([path]);
    if (!error && data?.length === 1 && data[0].name === path) return undefined;
  } catch {
    // Preserve the failure as a warning, without masking the database result.
  }
  return 'No se pudo confirmar que se retiró el archivo de este intento. Solicita una revisión antes de volver a subirlo.';
}

export async function saveEmpresaDocument(
  client: DocumentClient,
  input: { clienteId: string; userId: string; tipo: string; descripcion: string; file: File },
): Promise<SaveDocumentResult> {
  const { clienteId, userId, tipo, descripcion, file } = input;
  let previous: ReplacementDocument | undefined;
  try {
    // A fresh read avoids replacing from an outdated query cache.
    const current = await documentTable(client).select(REPLACEMENT_COLUMNS)
      .eq('cliente_id', clienteId).eq('tipo', tipo)
      .order('created_at', { ascending: false }).limit(1);
    if (current.error) return { ok: false, message: 'No se pudo consultar el documento actual. Reintenta.' };
    previous = current.data?.[0] as unknown as ReplacementDocument | undefined;
    if (previous && !canReplaceDocument(previous)) {
      return { ok: false, message: 'Este documento tiene historial o datos extraídos que debemos conservar. Solicita una revisión antes de reemplazarlo.' };
    }
  } catch {
    return { ok: false, message: 'No se pudo consultar el documento actual. Revisa tu conexión.' };
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  const safeExtension = ['pdf', 'png', 'jpg', 'jpeg'].includes(extension ?? '') ? extension : 'pdf';
  const path = `${userId}/${tipo}_${crypto.randomUUID()}.${safeExtension}`;
  try {
    const upload = await client.storage.from('documentos-empresa')
      .upload(path, file, { contentType: file.type || 'application/pdf', upsert: false });
    if (upload.error) return { ok: false, message: 'No se pudo subir el archivo. Reintenta.' };
  } catch {
    return { ok: false, message: 'No se pudo confirmar la carga. Revisa tu conexión antes de reintentar.' };
  }

  const values = { nombre: file.name, archivo_url: path, descripcion };
  let saved: { data: EmpresaDocument[] | null; error: { code?: string } | null; status: number };
  try {
    if (previous) {
      // For simple, unused rows created_at denotes the currently stored upload
      // (as in the preexisting INSERT flow, the card and documentos_por_avisar).
      // updated_at is a generic modification timestamp maintained by a trigger.
      const replacementValues = {
        ...values, avisado: false, created_at: new Date().toISOString(),
        storage_path: previous.storage_path === null ? null : path,
      };
      const update = documentTable(client).update(replacementValues)
        .eq('id', previous.id).eq('cliente_id', clienteId).eq('archivo_url', previous.archivo_url)
        .is('tipo_codigo', null).is('texto_extraido', null)
        .is('fecha_emision', null).is('fecha_vencimiento', null);
      // Recheck evidence at write time: another worker may add history/OCR
      // while this upload is in progress. Zero updated rows keeps it untouched.
      const withoutHistory = previous.usado_en === null
        ? update.is('usado_en', null) : update.filter('usado_en', 'eq', '{}');
      const sameStorage = previous.storage_path === null
        ? withoutHistory.is('storage_path', null) : withoutHistory.eq('storage_path', previous.storage_path);
      saved = await sameStorage.select(DOCUMENT_COLUMNS);
    } else {
      saved = await documentTable(client)
        .insert({ ...values, cliente_id: clienteId, tipo }).select(DOCUMENT_COLUMNS);
    }
  } catch {
    // The write may have committed. Never delete a possibly referenced object.
    return { ok: false, message: 'No se pudo confirmar el registro. Actualiza la lista antes de reintentar; conservamos los archivos.' };
  }

  if (saved.error) {
    const definite = isDefiniteDatabaseFailure(saved.error, saved.status);
    return {
      ok: false,
      message: definite
        ? 'No se pudo registrar el archivo. El documento anterior se conserva.'
        : 'No se pudo confirmar el registro. Actualiza la lista antes de reintentar; conservamos los archivos.',
      warning: definite ? await removeAttemptObject(client, path) : undefined,
    };
  }
  if (previous && saved.data?.length === 0) {
    return {
      ok: false,
      message: 'El documento cambió o no tienes permiso para reemplazarlo. Actualiza la lista.',
      warning: await removeAttemptObject(client, path),
    };
  }
  const document = saved.data?.[0];
  if (saved.data?.length !== 1 || !document || document.archivo_url !== path
    || document.tipo !== tipo || (previous && document.id !== previous.id)) {
    return { ok: false, message: 'No se pudo confirmar el registro. Actualiza la lista antes de reintentar; conservamos los archivos.' };
  }

  let warning: string | undefined;
  if (previous) {
    const cleanupWarning = await removeAttemptObject(client, previous.archivo_url);
    if (cleanupWarning) warning = 'Documento guardado. No se pudo confirmar que se retiró el archivo anterior; solicita una revisión.';
  }
  return { ok: true, document, warning };
}

export async function deleteEmpresaDocument(
  client: DocumentClient,
  clienteId: string,
  document: EmpresaDocument,
): Promise<DocumentResult> {
  try {
    // Delete the row first and confirm it; a failed DB delete must keep its file.
    const removed = await documentTable(client).delete()
      .eq('id', document.id).eq('cliente_id', clienteId).eq('archivo_url', document.archivo_url)
      .select('id');
    if (removed.error || removed.data?.length !== 1 || removed.data[0].id !== document.id) {
      return { ok: false, message: 'No se pudo confirmar la eliminación. Actualiza la lista; el archivo se conserva.' };
    }
  } catch {
    return { ok: false, message: 'No se pudo confirmar la eliminación. Actualiza la lista; el archivo se conserva.' };
  }
  const warning = await removeAttemptObject(client, document.archivo_url);
  return {
    ok: true,
    warning: warning ? 'Documento retirado de la lista. No se pudo confirmar que se eliminó su archivo; solicita una revisión.' : undefined,
  };
}
