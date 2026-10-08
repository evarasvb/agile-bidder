import { describe, expect, it, vi } from 'vitest';
import {
  createDocumentOperationGuard,
  deleteEmpresaDocument,
  documentFileFingerprint,
  saveEmpresaDocument,
  type EmpresaDocument,
} from './documentosEmpresa';

const previous: EmpresaDocument = {
  id: 'doc-previo', tipo: 'carpeta_tributaria', nombre: 'anterior.pdf',
  archivo_url: 'propietario/anterior.pdf', created_at: '2026-10-01T10:00:00Z',
};
const file = new File(['archivo de prueba'], 'nuevo.pdf', { type: 'application/pdf', lastModified: 123 });
const input = { clienteId: 'cliente', userId: 'propietario', tipo: previous.tipo, descripcion: 'Carpeta tributaria', file };
type Response = { data: unknown; error: { code?: string; message?: string } | null; status: number };
type Options = {
  previous?: EmpresaDocument | null;
  read?: Response | Error;
  upload?: { error: { message: string } | null } | Error;
  write?: Response | Error;
  cleanup?: { error: { message: string } | null } | Error;
};

function supabaseDouble(options: Options = {}) {
  const events: string[] = [];
  const filters: [string, unknown][] = [];
  let values: Record<string, string> = {};
  let uploadedPath = '';
  const remove = vi.fn(async (paths: string[]) => {
    events.push(`remove:${paths[0]}`);
    if (options.cleanup instanceof Error) throw options.cleanup;
    return options.cleanup ?? { error: null };
  });
  const upload = vi.fn(async (path: string) => {
    events.push('upload');
    uploadedPath = path;
    if (options.upload instanceof Error) throw options.upload;
    return options.upload ?? { error: null };
  });
  const update = vi.fn();
  const insert = vi.fn();
  const deleted = vi.fn();
  const from = vi.fn(() => {
    let operation = 'lookup';
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: unknown) => { filters.push([column, value]); return query; }),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      update: (patch: Record<string, string>) => { operation = 'update'; values = patch; update(patch); return query; },
      insert: (patch: Record<string, string>) => { operation = 'insert'; values = patch; insert(patch); return query; },
      delete: () => { operation = 'delete'; deleted(); return query; },
      then: (resolve: (value: Response) => unknown, reject: (error: Error) => unknown) => {
        events.push(operation);
        const response = operation === 'lookup'
          ? options.read ?? { data: options.previous === null ? [] : [options.previous ?? previous], error: null, status: 200 }
          : options.write ?? {
            data: operation === 'delete' ? [{ id: previous.id }]
              : [{ ...previous, ...values, id: operation === 'insert' ? 'doc-nuevo' : previous.id }],
            error: null, status: 200,
          };
        return response instanceof Error ? Promise.reject(response).then(resolve, reject) : Promise.resolve(response).then(resolve, reject);
      },
    };
    return query;
  });
  const client = {
    from,
    storage: { from: vi.fn(() => ({ upload, remove })) },
  } as unknown as Parameters<typeof saveEmpresaDocument>[0];
  return { client, events, filters, remove, upload, update, insert, deleted, from, get path() { return uploadedPath; } };
}

describe('documentos de empresa: confirmar registro antes de retirar archivos', () => {
  it.each([
    { data: null, error: { code: '42501' }, status: 403 },
    new Error('offline'),
  ])('no carga si no puede leer el documento actual (%j)', async (read) => {
    const db = supabaseDouble({ read });
    expect((await saveEmpresaDocument(db.client, input)).ok).toBe(false);
    expect(db.upload).not.toHaveBeenCalled();
    expect(db.remove).not.toHaveBeenCalled();
  });

  it.each([{ error: { message: 'falló upload' } }, new Error('offline')])(
    'no modifica filas ni el archivo anterior si falla la carga (%j)', async (upload) => {
      const db = supabaseDouble({ upload });
      expect((await saveEmpresaDocument(db.client, input)).ok).toBe(false);
      expect(db.update).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
      expect(db.deleted).not.toHaveBeenCalled();
      expect(db.remove).not.toHaveBeenCalled();
    },
  );

  it.each([null, previous])('retira sólo el objeto nuevo cuando INSERT/UPDATE rechaza el CHECK (%j)', async (existing) => {
    const db = supabaseDouble({ previous: existing, write: { data: null, error: { code: '23514' }, status: 400 } });
    const result = await saveEmpresaDocument(db.client, input);
    expect(result.ok).toBe(false);
    expect(db.remove).toHaveBeenCalledExactlyOnceWith([db.path]);
    expect(db.path).not.toBe(previous.archivo_url);
    expect(db.deleted).not.toHaveBeenCalled();
    if (existing) expect(db.update).toHaveBeenCalledOnce();
    else expect(db.insert).toHaveBeenCalledOnce();
  });

  it('reemplaza la misma fila y confirma su retorno antes de retirar el archivo anterior', async () => {
    const db = supabaseDouble();
    const result = await saveEmpresaDocument(db.client, input);
    expect(result).toMatchObject({ ok: true, document: { id: previous.id, archivo_url: db.path } });
    expect(db.events).toEqual(['lookup', 'upload', 'update', `remove:${previous.archivo_url}`]);
    expect(db.filters).toEqual(expect.arrayContaining([
      ['cliente_id', input.clienteId], ['tipo', input.tipo], ['id', previous.id], ['archivo_url', previous.archivo_url],
    ]));
    expect(db.deleted).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('registra el primer documento y conserva su objeto', async () => {
    const db = supabaseDouble({ previous: null });
    expect(await saveEmpresaDocument(db.client, input)).toMatchObject({ ok: true, document: { archivo_url: db.path } });
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({ cliente_id: input.clienteId, tipo: input.tipo }));
    expect(db.remove).not.toHaveBeenCalled();
    expect(db.upload).toHaveBeenCalledWith(db.path, file, { contentType: file.type, upsert: false });
  });

  it('no borra el documento anterior ante cero filas por permisos o cambio concurrente', async () => {
    const db = supabaseDouble({ write: { data: [], error: null, status: 200 } });
    expect((await saveEmpresaDocument(db.client, input)).ok).toBe(false);
    expect(db.remove).toHaveBeenCalledExactlyOnceWith([db.path]);
    expect(db.deleted).not.toHaveBeenCalled();
  });

  it.each([
    new Error('respuesta perdida'),
    { data: null, error: { message: 'Failed to fetch' }, status: 0 },
    { data: null, error: { code: 'PGRST000' }, status: 503 },
    { data: null, error: { message: 'timeout' }, status: 408 },
  ])('conserva ambos archivos ante un registro de resultado ambiguo (%j)', async (write) => {
    const db = supabaseDouble({ write });
    expect((await saveEmpresaDocument(db.client, input)).ok).toBe(false);
    expect(db.remove).not.toHaveBeenCalled();
    expect(db.deleted).not.toHaveBeenCalled();
  });

  it.each([[], [{ ...previous, archivo_url: 'otro-path' }], [previous, previous]])(
    'conserva ambos objetos si INSERT no devuelve una sola fila verificable (%j)', async (data) => {
      const db = supabaseDouble({ previous: null, write: { data, error: null, status: 201 } });
      expect((await saveEmpresaDocument(db.client, input)).ok).toBe(false);
      expect(db.remove).not.toHaveBeenCalled();
    },
  );

  it.each([{ error: { message: 'storage no disponible' } }, new Error('offline')])(
    'mantiene el nuevo registro y advierte si no puede retirar el archivo anterior (%j)', async (cleanup) => {
      const db = supabaseDouble({ cleanup });
      expect(await saveEmpresaDocument(db.client, input)).toMatchObject({ ok: true, warning: expect.any(String) });
      expect(db.remove).toHaveBeenCalledExactlyOnceWith([previous.archivo_url]);
    },
  );

  it('informa el rechazo de DB y el fallo de compensación sin tocar el documento anterior', async () => {
    const db = supabaseDouble({
      write: { data: null, error: { code: '42501' }, status: 403 }, cleanup: { error: { message: 'denied' } },
    });
    expect(await saveEmpresaDocument(db.client, input)).toMatchObject({ ok: false, warning: expect.any(String) });
    expect(db.remove).toHaveBeenCalledExactlyOnceWith([db.path]);
  });

  it('usa una ruta nueva para cada intento y evita sobrescribir objetos', async () => {
    const first = supabaseDouble({ previous: null });
    const second = supabaseDouble({ previous: null });
    await saveEmpresaDocument(first.client, input);
    await saveEmpresaDocument(second.client, input);
    expect(first.path).not.toBe(second.path);
    expect(first.path).toMatch(/^propietario\/carpeta_tributaria_[0-9a-f-]+\.pdf$/);
  });
});

describe('eliminación conservadora', () => {
  it.each([
    { data: null, error: { code: '42501' }, status: 403 },
    { data: [], error: null, status: 200 },
    new Error('respuesta perdida'),
  ])('conserva Storage si no confirma la eliminación de la fila (%j)', async (write) => {
    const db = supabaseDouble({ write });
    expect((await deleteEmpresaDocument(db.client, input.clienteId, previous)).ok).toBe(false);
    expect(db.remove).not.toHaveBeenCalled();
  });

  it('elimina el objeto sólo después de confirmar la fila y su versión', async () => {
    const db = supabaseDouble();
    expect(await deleteEmpresaDocument(db.client, input.clienteId, previous)).toEqual({ ok: true, warning: undefined });
    expect(db.events).toEqual(['delete', `remove:${previous.archivo_url}`]);
    expect(db.filters).toEqual([['id', previous.id], ['cliente_id', input.clienteId], ['archivo_url', previous.archivo_url]]);
  });

  it('informa si la fila se eliminó pero quedó su archivo', async () => {
    const db = supabaseDouble({ cleanup: new Error('offline') });
    expect(await deleteEmpresaDocument(db.client, input.clienteId, previous)).toMatchObject({ ok: true, warning: expect.any(String) });
  });
});

describe('bloqueo inmediato y reintentos en la tarjeta', () => {
  it('bloquea otra carga y eliminación aunque React todavía no haya renderizado', () => {
    const guard = createDocumentOperationGuard();
    expect(guard.tryStart('cliente:carpeta', 'archivo-a')).toBe('started');
    expect(guard.tryStart('cliente:cedula', 'archivo-b')).toBe('busy');
    expect(guard.tryStart('cliente:carpeta')).toBe('busy');
    guard.finish('cliente:carpeta', 'archivo-a', false);
    expect(guard.tryStart('cliente:cedula', 'archivo-b')).toBe('started');
  });

  it('rechaza la selección repetida de un archivo ya guardado y permite reintentar un fallo', () => {
    const guard = createDocumentOperationGuard();
    const fingerprint = documentFileFingerprint(file);
    expect(guard.tryStart('cliente:carpeta', fingerprint)).toBe('started');
    guard.finish('cliente:carpeta', fingerprint, false);
    expect(guard.tryStart('cliente:carpeta', fingerprint)).toBe('started');
    guard.finish('cliente:carpeta', fingerprint, true);
    expect(guard.tryStart('cliente:carpeta', fingerprint)).toBe('repeated');
    expect(guard.tryStart('cliente:cedula', fingerprint)).toBe('started');
  });

  it('permite subir el mismo archivo después de confirmar su eliminación', () => {
    const guard = createDocumentOperationGuard();
    guard.tryStart('cliente:carpeta', 'archivo-a');
    guard.finish('cliente:carpeta', 'archivo-a', true);
    expect(guard.tryStart('cliente:carpeta')).toBe('started');
    guard.finish('cliente:carpeta', undefined, true);
    expect(guard.tryStart('cliente:carpeta', 'archivo-a')).toBe('started');
  });
});
