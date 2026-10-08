/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import JSZip from 'jszip';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const CODE = '9999999-999999-LE99';
const USER = '11111111-1111-4111-8111-111111111111';
const OLD_ID = '22222222-2222-4222-8222-222222222222';
const NEW_ID = '33333333-3333-4333-8333-333333333333';
const NAME = `Matriz_${CODE}.pptx`;
const OLD_PATH = `${USER}/${CODE}/${NAME}`;
const PRIVATE_ERROR = 'internal table experto.documentos, signed URL, private credential';
const source = readFileSync(new URL('../../supabase/functions/experto-pptx/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

type RpcResult = { data: unknown; error: unknown };
type Document = { id: string; nombre: string; storage_path: string };

function fixture(options: {
  existing?: boolean;
  quota?: RpcResult;
  listed?: RpcResult;
  uploadError?: boolean;
  uploadThrows?: boolean;
  insertResult?: RpcResult;
  insertThrows?: boolean;
  commitBeforeInsertFailure?: boolean;
  deleteError?: boolean;
  deleteThrows?: boolean;
  removeError?: boolean;
  removeThrows?: boolean;
  generateThrows?: boolean;
} = {}) {
  let handler!: (request: Request) => Promise<Response>;
  const records: Document[] = options.existing === false ? [] : [{ id: OLD_ID, nombre: NAME, storage_path: OLD_PATH }];
  const oldBytes = new Uint8Array([1, 2, 3]);
  const files = new Map<string, Uint8Array>(records.map(doc => [doc.storage_path, oldBytes]));
  const steps: string[] = [];
  const upload = vi.fn(async (path: string, bytes: Uint8Array, uploadOptions: { upsert: boolean }) => {
    steps.push('upload');
    if (options.uploadThrows) throw new Error(PRIVATE_ERROR);
    if (options.uploadError) return { error: { message: PRIVATE_ERROR } };
    if (!uploadOptions.upsert && files.has(path)) return { error: { message: 'Already exists' } };
    files.set(path, bytes);
    return { error: null };
  });
  const remove = vi.fn(async (paths: string[]) => {
    steps.push('remove-file');
    if (options.removeThrows) throw new Error(PRIVATE_ERROR);
    if (options.removeError) return { error: { message: PRIVATE_ERROR } };
    paths.forEach(path => files.delete(path));
    return { error: null };
  });
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>): Promise<RpcResult> => {
    if (name === 'experto_ficha_licitacion') return { data: {}, error: null };
    if (name === 'experto_documentos_cupo') return options.quota ?? { data: [{ usados: records.length, maximo: 2 }], error: null };
    if (name === 'experto_documentos_listar') return options.listed ?? { data: records.map(doc => ({ id: doc.id, nombre: doc.nombre })), error: null };
    if (name === 'experto_documento_insertar') {
      steps.push('insert');
      if ((!options.insertResult && !options.insertThrows) || options.commitBeforeInsertFailure) {
        records.push({ id: NEW_ID, nombre: String(args.p_nombre), storage_path: String(args.p_storage_path) });
      }
      if (options.insertThrows) throw new Error(PRIVATE_ERROR);
      return options.insertResult ?? { data: NEW_ID, error: null };
    }
    if (name === 'experto_documento_borrar') {
      steps.push('delete-row');
      if (options.deleteThrows) throw new Error(PRIVATE_ERROR);
      if (options.deleteError) return { data: null, error: { message: PRIVATE_ERROR } };
      const index = records.findIndex(doc => doc.id === args.p_id);
      return { data: index < 0 ? null : records.splice(index, 1)[0].storage_path, error: null };
    }
    throw new Error(`Unexpected RPC ${name}`);
  });
  const fetch = vi.fn(async () => new Response(JSON.stringify({ matriz: { titulo: 'Matriz de prueba', resumen: 'Resumen sintético' } })));
  const logger = { error: vi.fn(), warn: vi.fn() };
  runInNewContext(compiled, {
    exports: {},
    require: (name: string) => {
      if (name === 'jsr:@supabase/supabase-js@2') return { createClient: () => ({ rpc, storage: { from: () => ({ upload, remove }) } }) };
      if (name === 'npm:jszip@3.10.1') return {
        default: options.generateThrows ? class { constructor() { throw new Error(PRIVATE_ERROR); } } : JSZip,
      };
      throw new Error(`Unexpected import ${name}`);
    },
    Deno: {
      serve: (callback: typeof handler) => { handler = callback; },
      env: { get: (key: string) => key === 'SUPABASE_URL' ? 'https://example.test' : 'test-service-key' },
    },
    Response, fetch, crypto: { randomUUID }, console: logger,
  });
  const request = () => handler(new Request('https://example.test/pptx', {
    method: 'POST', headers: { Authorization: 'Bearer test-service-key' },
    body: JSON.stringify({ codigo: CODE, user_id: USER }),
  }));
  return { request, handler, records, files, oldBytes, upload, remove, rpc, steps, logger, fetch };
}

function expectPreviousPreserved(f: ReturnType<typeof fixture>) {
  expect(f.records.find(doc => doc.id === OLD_ID)).toEqual({ id: OLD_ID, nombre: NAME, storage_path: OLD_PATH });
  expect(f.files.get(OLD_PATH)).toEqual(f.oldBytes);
  expect(f.rpc.mock.calls.some(([name]) => name === 'experto_documento_borrar')).toBe(false);
  expect(f.remove).not.toHaveBeenCalled();
}

async function expectSafeFailure(response: Response) {
  expect(response.status).toBe(500);
  const body = await response.json();
  expect(body).not.toHaveProperty('ok', true);
  expect(body).not.toHaveProperty('documento_id');
  expect(body.mensaje).toMatch(/PowerPoint/);
  expect(JSON.stringify(body)).not.toContain(PRIVATE_ERROR);
}

describe('PowerPoint edge handler save reliability (synthetic services only)', () => {
  it('returns a persisted UUID only after upload and insert, then removes the previous version', async () => {
    const f = fixture();
    const response = await f.request();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, codigo: CODE, documento_id: NEW_ID, nombre: NAME, slides: 7 });
    expect(f.steps).toEqual(['upload', 'insert', 'delete-row', 'remove-file']);
    expect(f.records).toHaveLength(1);
    const [path, bytes, uploadOptions] = f.upload.mock.calls[0];
    expect(path).not.toBe(OLD_PATH);
    expect(path).toMatch(new RegExp(`^${USER}/${CODE}/[a-f0-9-]{36}_${NAME}$`));
    expect(uploadOptions.upsert).toBe(false);
    expect(f.records[0]).toEqual({ id: NEW_ID, nombre: NAME, storage_path: path });
    expect(f.files.has(path)).toBe(true);
    expect(f.files.has(OLD_PATH)).toBe(false);
    expect(f.remove).toHaveBeenCalledWith([OLD_PATH]);
    expect(f.rpc).toHaveBeenCalledWith('experto_documento_insertar', expect.objectContaining({
      p_user_id: USER, p_codigo: CODE, p_nombre: NAME, p_tipo: 'pptx', p_storage_path: path,
    }));
    const archive = await JSZip.loadAsync(bytes);
    expect(Object.keys(archive.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))).toHaveLength(7);
  });

  it.each([null, undefined, '', 'null', 'undefined', 'not-a-uuid', 123, {}, [], [NEW_ID]])('rejects missing or invalid insert ID %j without deleting the prior document', async id => {
    const f = fixture({ insertResult: { data: id, error: null } });
    await expectSafeFailure(await f.request());
    expectPreviousPreserved(f);
  });

  it.each([null, NEW_ID])('rejects RPC insertion errors even if data contains %j', async data => {
    const f = fixture({ insertResult: { data, error: { message: PRIVATE_ERROR } } });
    await expectSafeFailure(await f.request());
    expectPreviousPreserved(f);
  });

  it.each([false, true])('preserves both possible versions on an ambiguous insert response (committed: %s)', async committed => {
    const f = fixture({ insertThrows: true, commitBeforeInsertFailure: committed });
    await expectSafeFailure(await f.request());
    expectPreviousPreserved(f);
    expect(f.files.has(f.upload.mock.calls[0][0])).toBe(true);
    if (committed) expect(f.records.every(doc => f.files.has(doc.storage_path))).toBe(true);
  });

  it.each([{ uploadError: true }, { uploadThrows: true }, { generateThrows: true }])('preserves the prior version on generation/upload failure %j', async options => {
    const f = fixture(options);
    await expectSafeFailure(await f.request());
    expectPreviousPreserved(f);
    expect(f.rpc.mock.calls.some(([name]) => name === 'experto_documento_insertar')).toBe(false);
  });

  it.each([
    { quota: { data: null, error: { message: PRIVATE_ERROR } } },
    { quota: { data: [], error: null } },
    { quota: { data: [{ usados: 'unknown', maximo: 2 }], error: null } },
    { listed: { data: null, error: { message: PRIVATE_ERROR } } },
    { listed: { data: null, error: null } },
  ])('fails closed if quota or existing-document lookup is unavailable: %j', async options => {
    const f = fixture(options);
    await expectSafeFailure(await f.request());
    expectPreviousPreserved(f);
    expect(f.upload).not.toHaveBeenCalled();
  });

  it('allows a safe replacement at full quota but rejects a new document', async () => {
    const quota = { data: [{ usados: 2, maximo: 2 }], error: null };
    const replacement = fixture({ quota });
    expect((await replacement.request()).status).toBe(200);
    const fresh = fixture({ existing: false, quota });
    expect((await fresh.request()).status).toBe(422);
    expect(fresh.upload).not.toHaveBeenCalled();
  });

  it.each([{ deleteError: true }, { deleteThrows: true }, { removeError: true }, { removeThrows: true }])('keeps the confirmed new file downloadable if old-version cleanup fails: %j', async options => {
    const f = fixture(options);
    const response = await f.request();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, documento_id: NEW_ID });
    expect(f.records.every(doc => f.files.has(doc.storage_path))).toBe(true);
    expect(f.logger.warn).toHaveBeenCalled();
    if ('deleteError' in options || 'deleteThrows' in options) expect(f.remove).not.toHaveBeenCalled();
  });

  it('saves a first version without cleanup', async () => {
    const f = fixture({ existing: false });
    expect((await f.request()).status).toBe(200);
    expect(f.steps).toEqual(['upload', 'insert']);
    expect(f.records).toHaveLength(1);
  });

  it('keeps unauthenticated requests out of storage and RPCs', async () => {
    const f = fixture();
    const response = await f.handler(new Request('https://example.test/pptx', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(401);
    expect(f.rpc).not.toHaveBeenCalled();
    expect(f.upload).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
  });
});
