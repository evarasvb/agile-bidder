/** Executes the real edge handler with a synthetic SDK/model. Never uses a live API. */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import * as sourceState from '../../supabase/functions/_shared/expertSourceState';
import * as gate from '../../supabase/functions/_shared/evidenceGateHelper';
import * as panorama from '../../supabase/functions/_shared/panorama';

type Row = Record<string, unknown>;
type Result = { data: unknown; error: unknown };
type Options = {
  results?: Record<string, Result | Error | Result[]>;
  authenticated?: boolean;
  authFailure?: 'error' | 'throw';
  userId?: string;
  onFetch?: (init: RequestInit) => Promise<Response>;
  onRpc?: (name: string, args: Row) => Promise<Result | undefined>;
  modelKey?: boolean;
  plan?: string;
  consultations?: number;
  reports?: number;
  quota?: Row;
};
const CODE = '123-1-LE26';
const BASES = [{ archivo: 'bases.pdf', paginas: 2, resumen: { garantia: null }, secciones: [{ titulo: '1', texto: 'La entrega se coordina.' }] }];
const ANEXOS = [{ archivo: 'anexo.pdf', paginas: 1, secciones: [{ titulo: 'A', texto: 'Identificación del oferente.' }] }];
const source = readFileSync(new URL('../../supabase/functions/experto-consultar/handler.ts', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('experto.ts', source, ts.ScriptTarget.Latest, true);
let noImports = source;
for (const statement of [...parsed.statements].reverse()) {
  if (ts.isImportDeclaration(statement)) noImports = noImports.slice(0, statement.getStart(parsed)) + noImports.slice(statement.end);
}
noImports = noImports.replace('export async function handleExpertRequest', 'async function handleExpertRequest') + '\nDeno.serve(handleExpertRequest);';
const compiled = ts.transpileModule(noImports, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

function createHarness(options: Options = {}) {
  const rpc = vi.fn(async (name: string, _args: Row): Promise<Result> => {
    const intercepted = await options.onRpc?.(name, _args);
    if (intercepted) return intercepted;
    const supplied = options.results?.[name];
    if (supplied instanceof Error) throw supplied;
    if (Array.isArray(supplied)) return supplied.shift() ?? { data: [], error: null };
    if (supplied) return supplied;
    if (name === 'experto_uso_mes') return { data: [{ consultas: options.consultations ?? 0, informes: options.reports ?? 0, plan: options.plan ?? 'free' }], error: null };
    if (name === 'experto_cuota') return { data: [options.quota ?? {}], error: null };
    if (name === 'experto_ficha_licitacion') return { data: { codigo: CODE, nombre: 'Compra de materiales', institucion: 'Entidad de prueba' }, error: null };
    if (name === 'experto_bases_texto') return { data: BASES, error: null };
    if (name === 'experto_anexos_texto') return { data: ANEXOS, error: null };
    if (name === 'experto_panorama_licitacion') return { data: null, error: null };
    if (name === 'evaristo_contexto') return { data: { conversaciones_recientes: [] }, error: null };
    return { data: [], error: null };
  });
  const profileFilter = vi.fn(() => profile);
  const profile = { select: () => profile, eq: profileFilter, maybeSingle: async () => ({ data: null, error: null }) };
  const getUser = vi.fn(async () => {
    if (options.authFailure === 'throw') throw new Error('private auth error');
    return { data: { user: options.authenticated === false ? null : { id: options.userId ?? 'owner-1' } }, error: options.authFailure === 'error' ? { message: 'private auth error' } : null };
  });
  const sdk = { rpc, from: () => profile, auth: { getUser } };
  const saveTurn = vi.fn(async () => undefined);
  const fallback = vi.fn(async (_messages: unknown, _options: unknown) => null);
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => options.onFetch ? options.onFetch(_init) : new Response(
    `data: ${JSON.stringify({ choices: [{ delta: { content: 'Respuesta respaldada por extractos.' }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`,
    { headers: { 'Content-Type': 'text/event-stream' } },
  ));
  const env: Record<string, string | undefined> = {
    SUPABASE_URL: 'https://synthetic-supabase.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service',
    SUPABASE_ANON_KEY: 'synthetic-anon', GEMINI_API_KEY: options.modelKey === false ? undefined : 'synthetic-model',
  };
  type InternalOptions = { persistConversation?: boolean; documentRequirement?: 'requirements' | 'commercial_terms' | 'forum' };
  let handler: ((req: Request, options?: InternalOptions) => Promise<Response>) | undefined;
  const createClient = vi.fn(() => sdk);
  runInNewContext(compiled, {
    ...sourceState, ...gate, ...panorama,
    createClient, guardarTurnoEvaristo: saveTurn, fetchClaudeComoOpenAI: fallback,
    Deno: { env: { get: (name: string) => env[name] }, serve: (callback: typeof handler) => { handler = callback; } },
    fetch, Request, Response, ReadableStream, TextEncoder, TextDecoder, AbortSignal, AbortController, setTimeout, clearTimeout,
    console: { error: vi.fn(), log: vi.fn() },
  }, { filename: 'expert.mocked.js', timeout: 1000 });
  if (!handler) throw new Error('Handler did not register');
  async function run(body: Row = {}, token = options.authenticated === false ? '' : 'synthetic-user-token', internalOptions?: InternalOptions, signal?: AbortSignal) {
    const response = await handler!(new Request('https://local.invalid/experto-consultar', {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), 'x-forwarded-for': '203.0.113.1' },
      body: JSON.stringify({ pregunta: '¿Qué garantía piden las bases?', codigo: CODE, huella: 'synthetic-browser', ...body }),
    }), internalOptions);
    const text = await response.text();
    const events = response.headers.get('Content-Type')?.includes('text/event-stream')
      ? text.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)) as Row)
      : [];
    const meta = events.find(event => event.meta)?.meta as Row | undefined;
    return { response, events, meta, text: events.map(event => event.delta ?? '').join(''), json: events.length ? null : JSON.parse(text) as Row };
  }
  const prompt = () => JSON.stringify(JSON.parse(String(fetch.mock.calls[0]?.[1].body ?? '{}')).messages);
  return { run, rpc, fetch, fallback, getUser, saveTurn, prompt, createClient, profileFilter, handle: handler };
}

describe('expert source states in the real SSE handler (mock-only)', () => {
  it.each([
    { key: 'ficha', rpc: 'experto_ficha_licitacion' },
    { key: 'bases', rpc: 'experto_bases_texto' },
    { key: 'anexos', rpc: 'experto_anexos_texto' },
  ])('returns deterministic evidence warning without any model on $key error', async ({ key, rpc }) => {
    const h = createHarness({ results: { [rpc]: { data: key === 'ficha' ? { codigo: CODE } : BASES, error: { message: 'private backend detail', code: '42501' } } } });
    const result = await h.run();
    expect(result.response.status).toBe(200);
    expect(result.meta).toMatchObject({ modelo: null, codigo: CODE, pedir_bases: null, estado_respuesta: 'source_error', estado_documental: 'no_verificable', estados_fuentes: { [key]: { estado: 'error', conocimiento: 'desconocido' } } });
    expect(result.text).toContain('desconocida y no verificable');
    expect(result.text).not.toMatch(/NO HAY BASES|Subir bases|private backend|42501/);
    expect(result.events.at(-1)).toMatchObject({ done: true });
    expect(result.meta?.fuentes).toBeInstanceOf(Array);
    expect((result.meta?.fuentes as Row[]).length).toBeGreaterThan(0);
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.fallback).not.toHaveBeenCalled();
    expect(h.rpc.mock.calls.filter(([name]) => name === 'experto_registrar_uso')).toHaveLength(1);
    expect(h.rpc.mock.calls.some(([name]) => name === 'registrar_uso_ia')).toBe(false);
    expect(h.saveTurn).toHaveBeenCalledOnce();
  });

  it('preserves a rejected source and works even with no model key', async () => {
    const h = createHarness({ modelKey: false, results: { experto_bases_texto: new Error('synthetic failure') } });
    const result = await h.run();
    expect(result.meta).toMatchObject({ estado_respuesta: 'source_error', estados_fuentes: { bases: { estado: 'error' } } });
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.fallback).not.toHaveBeenCalled();
  });

  it('uses NO HAY BASES only for a successful empty read and keeps the upload affordance', async () => {
    const h = createHarness({ results: { experto_bases_texto: { data: [], error: null } } });
    const result = await h.run();
    expect(result.meta).toMatchObject({ pedir_bases: CODE, estados_fuentes: { bases: { estado: 'empty', cantidad: 0 } } });
    expect(h.prompt()).toContain('NO HAY BASES CARGADAS');
    expect(h.fetch).toHaveBeenCalledOnce();
    expect(h.rpc.mock.calls.filter(([name]) => name === 'registrar_uso_ia')).toHaveLength(1);
  });

  it.each(['chat', 'informe'])('does not equate no indicado with no exigido in %s prompts', async modo => {
    const h = createHarness();
    const result = await h.run({ modo });
    expect(result.meta).toMatchObject({ estado_respuesta: 'ok', estados_fuentes: { bases: { estado: 'ok', cantidad: 1 }, anexos: { estado: 'ok', cantidad: 1 } } });
    expect(h.prompt()).toContain(sourceState.EXPERT_MISSING_SUMMARY_RULE);
    expect(h.prompt()).not.toContain('di que las bases no lo exigen');
    expect(h.prompt()).not.toContain('significa que las bases no lo exigen');
    expect(h.prompt()).toContain('garantia: no indicado');
  });

  it('does not claim no search results when the licitation search fails', async () => {
    const h = createHarness({ results: { experto_licitaciones: { data: [], error: { message: 'failed' } } } });
    const result = await h.run({ codigo: null, pregunta: 'Busca licitaciones abiertas de uniformes' });
    expect(result.meta).toMatchObject({ estados_fuentes: { lic: { estado: 'error' } } });
    expect(result.text).toContain('No pude consultar: licitaciones abiertas');
    expect(h.prompt()).not.toContain('sin resultados en títulos');
  });

  it('still reports no results on a successful empty search', async () => {
    const h = createHarness();
    const result = await h.run({ codigo: null, pregunta: 'Busca licitaciones abiertas de uniformes' });
    expect(result.meta).toMatchObject({ estados_fuentes: { lic: { estado: 'empty' } } });
    expect(h.prompt()).toContain('sin resultados en títulos');
  });

  it.each(['experto_panorama_licitacion', 'experto_documentos_texto'])('never marks documentation complete after %s fails', async rpc => {
    const h = createHarness({ results: { [rpc]: { data: null, error: { message: 'failed' } } } });
    const result = await h.run();
    expect(result.meta).toMatchObject({ estado_documental: 'no_verificable' });
    expect(result.text).toContain('no verificable');
    expect(h.prompt()).not.toContain('Documentación aparentemente completa');
    expect(h.prompt()).toContain('No afirmes que falten documentos ni que estén completos');
  });

  it('preserves both primary news failure and successful fallback news state', async () => {
    const h = createHarness({ results: { experto_noticias: [
      { data: null, error: { message: 'first query failed' } },
      { data: [{ fuente: 'Medio de prueba', seccion: 'Hoy', texto: 'Noticia de prueba.' }], error: null },
    ] } });
    const result = await h.run();
    expect(result.meta).toMatchObject({ estados_fuentes: { noticias: { estado: 'error' }, noticiasTema: { estado: 'ok' } } });
    expect(h.prompt()).toContain('Noticia de prueba.');
  });

  it('preserves an organism lookup error instead of inventing an empty second query', async () => {
    const h = createHarness({ results: { experto_buscar_organismo: { data: 'private-result', error: { message: 'failed' } } } });
    const result = await h.run({ codigo: null, pregunta: '¿Paga la municipalidad de Santiago?' });
    expect(result.meta).toMatchObject({ estados_fuentes: { orgBusqueda: { estado: 'error' } } });
    expect(h.rpc.mock.calls.some(([name]) => name === 'experto_organismo')).toBe(false);
    expect(h.prompt()).not.toContain('private-result');
  });

  it.each([
    { options: { consultations: 3 }, body: {}, status: 402, error: 'limite' },
    { options: { authenticated: false, consultations: 1 }, body: {}, status: 402, error: 'comodin_usado' },
    { options: { authenticated: false }, body: { modo: 'informe' }, status: 402, error: 'comodin_usado' },
    { options: { quota: { ip_hora: 20 } }, body: {}, status: 429, error: 'ritmo' },
  ])('keeps existing quota before source/model reads ($error)', async ({ options, body, status, error }) => {
    const h = createHarness(options);
    const result = await h.run(body);
    expect(result.response.status).toBe(status);
    expect(result.json).toMatchObject({ error });
    expect(h.rpc.mock.calls.some(([name]) => name === 'experto_bases_texto')).toBe(false);
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it('retains validated auth rather than trusting body.user_id', async () => {
    const h = createHarness();
    await h.run({ user_id: 'other-owner' });
    expect(h.getUser).toHaveBeenCalledWith('synthetic-user-token');
    expect(h.rpc).toHaveBeenCalledWith('experto_uso_mes', { p_user_id: 'owner-1', p_huella: 'synthetic-browser' });
  });

  it('preserves exact service-key delegation and existing Pro bypass', async () => {
    const h = createHarness({ plan: 'pro', consultations: 99 });
    const result = await h.run({ user_id: 'delegated-owner' }, 'synthetic-service');
    expect(result.response.status).toBe(200);
    expect(h.getUser).not.toHaveBeenCalled();
    expect(h.rpc).toHaveBeenCalledWith('experto_uso_mes', { p_user_id: 'delegated-owner', p_huella: 'synthetic-browser' });
    expect(h.rpc.mock.calls.some(([name]) => name === 'experto_cuota')).toBe(false);
  });

  it.each([
    { authenticated: false }, { authFailure: 'error' as const }, { authFailure: 'throw' as const },
  ])('rejects an invalid present token before quota and sources: %j', async options => {
    const h = createHarness(options);
    const result = await h.run({}, 'invalid-token');
    expect(result.response.status).toBe(401);
    expect(result.json).toMatchObject({ error: 'no_autorizado' });
    expect(JSON.stringify(result.json)).not.toContain('private');
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.fallback).not.toHaveBeenCalled();
    expect(h.saveTurn).not.toHaveBeenCalled();
  });

  it('preserves a fresh anonymous wildcard only when no JWT was supplied', async () => {
    const h = createHarness({ authenticated: false });
    const result = await h.run();
    expect(result.response.status).toBe(200);
    expect(h.getUser).not.toHaveBeenCalled();
    expect(h.rpc).toHaveBeenCalledWith('experto_uso_mes', { p_user_id: null, p_huella: 'synthetic-browser' });
    expect(h.fetch).toHaveBeenCalledOnce();
  });

  it.each([
    { data: null, error: { message: 'private quota SQL' } },
    { data: [{ consultas: 0, informes: 0, plan: 'pro' }], error: { message: 'private partial result' } },
    new Error('private quota throw'),
    { data: null, error: null },
    { data: [], error: null },
    { data: {}, error: null },
    { data: [null], error: null },
    { data: [{ consultas: 0, informes: 0, plan: 'free' }, { consultas: 0, informes: 0, plan: 'pro' }], error: null },
    { data: [{ consultas: '0', informes: 0, plan: 'free' }], error: null },
    { data: [{ consultas: -1, informes: 0, plan: 'free' }], error: null },
    { data: [{ consultas: 0, informes: 0.5, plan: 'free' }], error: null },
    { data: [{ consultas: 0, plan: 'free' }], error: null },
    { data: [{ consultas: 0, informes: 0, plan: null }], error: null },
    { data: [{ consultas: 0, informes: 0, plan: '' }], error: null },
    { data: [{ consultas: 0, informes: 0, plan: ' free' }], error: null },
  ])('fails closed on an unreadable monthly usage result: %j', async result => {
    const h = createHarness({ results: { experto_uso_mes: result } });
    const response = await h.run();
    expect(response.response.status).toBe(503);
    expect(response.json).toMatchObject({ error: 'cuota_no_disponible' });
    expect(JSON.stringify(response.json)).not.toContain('private');
    expect(h.rpc.mock.calls.map(([name]) => name)).toEqual(['experto_uso_mes']);
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.fallback).not.toHaveBeenCalled();
    expect(h.saveTurn).not.toHaveBeenCalled();
  });

  it('internal memory suppression changes only shared chat persistence', async () => {
    const h = createHarness();
    const result = await h.run({}, 'synthetic-user-token', { persistConversation: false });
    expect(result.response.status).toBe(200);
    expect(h.saveTurn).not.toHaveBeenCalled();
    expect(h.getUser).toHaveBeenCalledWith('synthetic-user-token');
    expect(h.createClient).toHaveBeenCalledWith('https://synthetic-supabase.invalid', 'synthetic-anon', { global: { headers: { Authorization: 'Bearer synthetic-user-token' } } });
    expect(h.rpc).toHaveBeenCalledWith('experto_cuota', { p_ip: '203.0.113.1' });
    expect(h.rpc.mock.calls.filter(([name]) => name === 'experto_registrar_uso')).toHaveLength(1);
    expect(h.rpc.mock.calls.filter(([name]) => name === 'registrar_uso_ia')).toHaveLength(1);
  });

  it('ignores externally supplied memory options', async () => {
    const h = createHarness();
    await h.run({ persistConversation: false, options: { persistConversation: false } });
    expect(h.saveTurn).toHaveBeenCalledOnce();
  });

  it.each(['requirements', 'commercial_terms'] as const)('avoids model expense for empty support documents: %s', async documentRequirement => {
    const h = createHarness({ results: {
      experto_bases_texto: { data: [], error: null }, experto_anexos_texto: { data: [], error: null },
    } });
    const result = await h.run({}, 'synthetic-user-token', { persistConversation: false, documentRequirement });
    expect(result.meta).toMatchObject({ modelo: null, estado_respuesta: 'needs_evidence', estado_documental: 'no_verificable', estados_fuentes: { bases: { estado: 'empty', cantidad: 0 }, anexos: { estado: 'empty', cantidad: 0 } } });
    expect(result.text).toContain('no recuperó bases ni anexos');
    expect(result.events.at(-1)).toMatchObject({ done: true });
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.fallback).not.toHaveBeenCalled();
    expect(h.rpc.mock.calls.filter(([name]) => name === 'experto_registrar_uso')).toHaveLength(1);
    expect(h.rpc.mock.calls.some(([name]) => name === 'registrar_uso_ia')).toBe(false);
    expect(h.saveTurn).not.toHaveBeenCalled();
  });

  it('avoids a forum model when only unrelated documents were recovered', async () => {
    const h = createHarness();
    const result = await h.run({}, 'synthetic-user-token', { documentRequirement: 'forum' });
    expect(result.meta).toMatchObject({ modelo: null, estado_respuesta: 'needs_evidence', estado_documental: 'no_verificable' });
    expect(result.text).toContain('Un foro vacío no demuestra que no existan');
    expect(result.meta?.fuentes).toHaveLength(2);
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.fallback).not.toHaveBeenCalled();
  });

  it.each(['respuestas-oficiales.pdf', 'Aclaración.pdf', 'Consultas.pdf', 'foro.pdf'])('allows the existing model when a forum document is identified: %s', async archivo => {
    const h = createHarness({ results: { experto_anexos_texto: { data: [{ ...ANEXOS[0], archivo }], error: null } } });
    const result = await h.run({}, 'synthetic-user-token', { documentRequirement: 'forum' });
    expect(result.meta).toMatchObject({ estado_respuesta: 'ok' });
    expect(h.fetch).toHaveBeenCalledOnce();
  });

  it('does not apply support-only documentary requirements from the public body', async () => {
    const h = createHarness({ results: {
      experto_bases_texto: { data: [], error: null }, experto_anexos_texto: { data: [], error: null },
    } });
    const result = await h.run({ documentRequirement: 'forum', options: { documentRequirement: 'forum' } });
    expect(result.meta).toMatchObject({ estado_respuesta: 'ok' });
    expect(h.fetch).toHaveBeenCalledOnce();
    expect(h.saveTurn).toHaveBeenCalledOnce();
  });


  it.each(['company-owner', 'company-member'])('uses the validated actor for all user-scoped calls: %s', async userId => {
    const h = createHarness({ userId });
    await h.run({ user_id: 'foreign-owner' });
    expect(h.rpc).toHaveBeenCalledWith('experto_uso_mes', { p_user_id: userId, p_huella: 'synthetic-browser' });
    expect(h.rpc).toHaveBeenCalledWith('experto_memoria', { p_user_id: userId, p_huella: 'synthetic-browser' });
    expect(h.rpc).toHaveBeenCalledWith('experto_panorama_licitacion', { p_user_id: userId, p_codigo: CODE });
    expect(h.rpc).toHaveBeenCalledWith('experto_documentos_texto', { p_user_id: userId, p_codigo: CODE, p_max: 8000 });
    expect(h.profileFilter).toHaveBeenCalledWith('user_id', userId);
    expect(h.rpc).toHaveBeenCalledWith('experto_registrar_uso', expect.objectContaining({ p_user_id: userId }));
    expect(h.saveTurn).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId }));
    expect(h.rpc.mock.calls.some(([, args]) => Object.values(args).includes('foreign-owner'))).toBe(false);
  });

  it('never starts a model or fallback for an already aborted request', async () => {
    const controller = new AbortController(); controller.abort();
    const h = createHarness();
    const result = await h.run({}, 'synthetic-user-token', undefined, controller.signal);
    expect(result.response.status).toBe(499);
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.fallback).not.toHaveBeenCalled();
    expect(h.rpc.mock.calls.some(([name]) => name === 'registrar_uso_ia')).toBe(false);
  });

  it('propagates request cancellation to Gemini and never retries or starts Claude', async () => {
    const controller = new AbortController();
    let providerSignal: AbortSignal | null | undefined;
    const h = createHarness({ onFetch: async init => {
      providerSignal = init.signal;
      expect(providerSignal?.aborted).toBe(false);
      controller.abort();
      expect(providerSignal?.aborted).toBe(true);
      throw new Error('synthetic abort');
    } });
    const result = await h.run({}, 'synthetic-user-token', undefined, controller.signal);
    expect(result.response.status).toBe(499);
    expect(h.fetch).toHaveBeenCalledOnce();
    expect(h.fallback).not.toHaveBeenCalled();
    expect(providerSignal?.aborted).toBe(true);
  });

  it('passes the original request cancellation signal to the existing Claude fallback', async () => {
    const controller = new AbortController();
    const h = createHarness({ modelKey: false });
    const result = await h.run({}, 'synthetic-user-token', undefined, controller.signal);
    expect(result.response.status).toBe(502);
    expect(h.fallback).toHaveBeenCalledOnce();
    const options = h.fallback.mock.calls[0]?.[1] as { signal?: AbortSignal };
    expect(options.signal?.aborted).toBe(false);
    controller.abort();
    expect(options.signal?.aborted).toBe(true);
  });


  it('cancels an active Gemini response body when the original request aborts', async () => {
    const controller = new AbortController();
    let providerSignal: AbortSignal | null | undefined;
    const h = createHarness({ onFetch: async init => {
      providerSignal = init.signal;
      return new Response(new ReadableStream({ start(ctrl) {
        init.signal?.addEventListener('abort', () => ctrl.error(new Error('synthetic stream abort')), { once: true });
      } }));
    } });
    const response = await h.handle(new Request('https://local.invalid/expert', {
      method: 'POST', signal: controller.signal, headers: { Authorization: 'Bearer synthetic-user-token' },
      body: JSON.stringify({ codigo: CODE, pregunta: 'Garantías' }),
    }));
    controller.abort();
    const text = await response.text();
    expect(providerSignal?.aborted).toBe(true);
    expect(text).toContain('synthetic stream abort');
    expect(h.fetch).toHaveBeenCalledOnce();
    expect(h.fallback).not.toHaveBeenCalled();
  });

  it('stops the upstream reader if the SSE consumer cancels', async () => {
    const cancelProvider = vi.fn();
    const h = createHarness({ onFetch: async () => new Response(new ReadableStream({ cancel: cancelProvider })) });
    const response = await h.handle(new Request('https://local.invalid/expert', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user-token' },
      body: JSON.stringify({ codigo: CODE, pregunta: 'Garantías' }),
    }));
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(cancelProvider).toHaveBeenCalledOnce();
    expect(h.fetch).toHaveBeenCalledOnce();
    expect(h.fallback).not.toHaveBeenCalled();
  });


  it('does not finish response.text until quota, memory and model-cost writes settle exactly once', async () => {
    let releaseUsage!: () => void, releaseCost!: () => void;
    const usageGate = new Promise<void>(resolve => { releaseUsage = resolve; });
    const costGate = new Promise<void>(resolve => { releaseCost = resolve; });
    const settled: string[] = [];
    const h = createHarness({ onRpc: async name => {
      if (name === 'experto_registrar_uso') { await usageGate; settled.push(name); return { data: null, error: null }; }
      if (name === 'registrar_uso_ia') { await costGate; settled.push(name); return { data: null, error: null }; }
      return undefined;
    } });
    const response = await h.handle(new Request('https://local.invalid/expert', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user-token' },
      body: JSON.stringify({ codigo: CODE, pregunta: 'Garantías' }),
    }));
    let completed = false;
    const consumed = response.text().then(text => { completed = true; return text; });
    await new Promise(resolve => setImmediate(resolve));
    expect(completed).toBe(false);
    expect(settled).toEqual([]);
    releaseUsage();
    await new Promise(resolve => setImmediate(resolve));
    expect(completed).toBe(false);
    expect(settled).toEqual(['experto_registrar_uso']);
    expect(h.saveTurn).toHaveBeenCalledOnce();
    releaseCost();
    await consumed;
    expect(completed).toBe(true);
    expect(settled).toEqual(['experto_registrar_uso', 'registrar_uso_ia']);
    expect(h.rpc.mock.calls.filter(([name]) => name === 'experto_registrar_uso')).toHaveLength(1);
    expect(h.rpc.mock.calls.filter(([name]) => name === 'registrar_uso_ia')).toHaveLength(1);
  });


  it('recognizes only the configured public key as the existing anonymous wildcard credential', async () => {
    const h = createHarness({ authenticated: false });
    const result = await h.run({ user_id: 'foreign-owner' }, 'synthetic-anon');
    expect(result.response.status).toBe(200);
    expect(h.getUser).not.toHaveBeenCalled();
    expect(h.createClient).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenCalledWith('experto_uso_mes', { p_user_id: null, p_huella: 'synthetic-browser' });
    expect(h.rpc.mock.calls.some(([, args]) => Object.values(args).includes('foreign-owner'))).toBe(false);
    expect(h.rpc.mock.calls.some(([name]) => name === 'experto_documentos_texto' || name === 'evaristo_contexto')).toBe(false);
    expect(h.saveTurn).not.toHaveBeenCalled();
    expect(h.fetch).toHaveBeenCalledOnce();
  });

  it('does not trust anonymous claims from an arbitrary token', async () => {
    const token = `synthetic.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.synthetic`;
    const h = createHarness({ authenticated: false });
    const result = await h.run({ user_id: 'foreign-owner' }, token);
    expect(result.response.status).toBe(401);
    expect(h.getUser).toHaveBeenCalledWith(token);
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.fetch).not.toHaveBeenCalled();
  });

});
