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

type DocumentClient = Pick<SupabaseClient<Database>, 'from' | 'storage'>;
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
  return /^[234][0-9A-Z]{4}$/.test(error.code ?? '')
    || (status >= 400 && status < 500 && status !== 408 && status !== 429);
}

async function removeAttemptObject(client: DocumentClient, path: string) {
  try {
    const { error } = await client.storage.from('documentos-empresa').remove([path]);
    if (!error) return undefined;
  } catch {
    // Preserve the failure as a warning, without masking the database result.
  }
  return 'No se pudo retirar el archivo de este intento. Solicita una revisión antes de volver a subirlo.';
}

export async function saveEmpresaDocument(
  client: DocumentClient,
  input: { clienteId: string; userId: string; tipo: string; descripcion: string; file: File },
): Promise<SaveDocumentResult> {
  const { clienteId, userId, tipo, descripcion, file } = input;
  let previous: EmpresaDocument | undefined;
  try {
    // A fresh read avoids replacing from an outdated query cache.
    const current = await client.from('cliente_documentos').select(DOCUMENT_COLUMNS)
      .eq('cliente_id', clienteId).eq('tipo', tipo)
      .order('created_at', { ascending: false }).limit(1);
    if (current.error) return { ok: false, message: 'No se pudo consultar el documento actual. Reintenta.' };
    previous = current.data?.[0];
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
    saved = previous
      ? await client.from('cliente_documentos').update(values)
        .eq('id', previous.id).eq('cliente_id', clienteId).eq('archivo_url', previous.archivo_url)
        .select(DOCUMENT_COLUMNS)
      : await client.from('cliente_documentos')
        .insert({ ...values, cliente_id: clienteId, tipo }).select(DOCUMENT_COLUMNS);
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
    if (cleanupWarning) warning = 'Documento guardado. El archivo anterior sigue almacenado y requiere revisión.';
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
    const removed = await client.from('cliente_documentos').delete()
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
    warning: warning ? 'Documento retirado de la lista. Su archivo sigue almacenado y requiere revisión.' : undefined,
  };
}
