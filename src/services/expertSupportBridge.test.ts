/** © 2024-2026 Firma VB SpA. Todos los derechos reservados. */
import { describe, expect, it, vi } from 'vitest';
import { consultExpertForSupport } from '../../supabase/functions/_shared/expertSupportBridge';
import { createSupportHarness } from './testHelpers/evaristoSupportHarness';

const CODE = '2239-5-LR26';
const source = { n: 1, fuente: `Bases de la licitación ${CODE}: bases.pdf`, seccion: 'Numeral 6.2.1', url: null };
const metadata = { codigo: CODE, modelo: 'synthetic-model', fuentes: [source], estados_fuentes: {
  ficha: { estado: 'ok' }, bases: { estado: 'ok', cantidad: 1 }, anexos: { estado: 'empty', cantidad: 0 },
} };
const input = { baseUrl: 'https://project.supabase.co', anonKey: 'synthetic-anon', authorization: 'Bearer synthetic-member-JWT', code: CODE,
  question: '¿Qué requisitos exige?', intent: 'requirements' as const, history: [] };
function sse(meta: Record<string, unknown> = metadata, answer = 'La cláusula 6.2.1 relaciona el servicio con el producto adjudicado. [1]', extra: Record<string, unknown>[] = [{ finish: 'stop' }, { done: true }]) {
  const text = [{ meta }, { delta: answer }, ...extra].map(event => `data: ${JSON.stringify(event)}\r\n\r\n`).join('');
  return new Response(text, { headers: { 'Content-Type': 'text/event-stream' } });
}
function fetchOnce(response: Response | Error) {
  return vi.fn<typeof fetch>(async () => { if (response instanceof Error) throw response; return response; });
}

describe('one authorized Expert invocation for support, with documentary evidence', () => {
  it('forwards original member JWT and code without delegated identity, plan or service_role', async () => {
    const fetchImpl = fetchOnce(sse());
    const result = await consultExpertForSupport({ ...input, fetchImpl, history: [
      { role: 'user', content: 'Solo vendo servicios' }, { role: 'assistant', content: 'Pon stock 1' },
    ] });
    expect(result).toMatchObject({ status: 'answered_with_sources', httpStatus: 200, upstreamStatus: 200, sources: [source] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, request] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://project.supabase.co/functions/v1/experto-consultar');
    expect(request?.headers).toEqual({ Authorization: input.authorization, apikey: 'synthetic-anon', 'Content-Type': 'application/json' });
    expect(JSON.parse(String(request?.body))).toEqual({ modo: 'chat', codigo: CODE, pregunta: input.question,
      historial: [{ role: 'user', content: 'Solo vendo servicios' }] });
  });

  it.each([401, 402, 403, 429])('preserves denial %i, without retry or alternate model/credentials', async status => {
    const fetchImpl = fetchOnce(new Response(JSON.stringify({ error: 'sensitive internal detail not relayed' }), { status }));
    const result = await consultExpertForSupport({ ...input, fetchImpl });
    expect(result).toMatchObject({ status: 'access_denied', httpStatus: status, upstreamStatus: status, model: null, sources: [] });
    expect(JSON.stringify(result)).not.toContain('sensitive internal');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('exposes a failed quota check as unavailable access, never as an upgrade requirement', async () => {
    const fetchImpl = fetchOnce(new Response(JSON.stringify({ error: 'cuota_no_disponible', message: 'private detail' }), { status: 503 }));
    const result = await consultExpertForSupport({ ...input, fetchImpl });
    expect(result).toMatchObject({ status: 'access_denied', httpStatus: 503, upstreamStatus: 503 });
    expect(result.reply).toContain('no significa que necesites cambiar de plan');
    expect(result.reply).not.toContain('private detail');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no documentary sources', { ...metadata, fuentes: [] }],
    ['normative source only', { ...metadata, fuentes: [{ ...source, fuente: 'Ley general' }] }],
    ['wrong tender', { ...metadata, codigo: '123-4-LE26' }],
    ['source from another tender', { ...metadata, fuentes: [{ ...source, fuente: 'Bases de la licitación 123-4-LE26: bases.pdf' }] }],
    ['old endpoint without states', { ...metadata, estados_fuentes: undefined }],
    ['contradictory empty bases', { ...metadata, estados_fuentes: { ...metadata.estados_fuentes, bases: { estado: 'empty' } } }],
    ['failed bases', { ...metadata, estados_fuentes: { ...metadata.estados_fuentes, bases: { estado: 'error' } } }],
    ['failed anexos', { ...metadata, estados_fuentes: { ...metadata.estados_fuentes, anexos: { estado: 'error' } } }],
  ])('does not fabricate a sourced answer with %s', async (_name, meta) => {
    const result = await consultExpertForSupport({ ...input, fetchImpl: fetchOnce(sse(meta)) });
    expect(result.status).toBe('needs_evidence');
    expect(result.reply).not.toContain('La cláusula 6.2.1 relaciona');
  });

  it.each(['Sin cita documental', 'Artículo falso [99]', 'Pon stock 1 para continuar. [1]', 'Ingresa $1 para continuar. [1]'])('rejects unsupported answer %s', async answer => {
    const result = await consultExpertForSupport({ ...input, fetchImpl: fetchOnce(sse(metadata, answer)) });
    expect(result.status).toBe('needs_evidence');
    expect(result.reply).not.toBe(answer);
  });

  it('forum needs a cited answer/clarification attachment rather than generic bases', async () => {
    const noForum = await consultExpertForSupport({ ...input, intent: 'forum', fetchImpl: fetchOnce(sse()) });
    expect(noForum.status).toBe('needs_evidence');
    const forum = { ...source, fuente: `Anexo/adjunto de la licitación ${CODE}: respuestas_consultas.pdf` };
    const covered = await consultExpertForSupport({ ...input, intent: 'forum', fetchImpl: fetchOnce(sse({ ...metadata, fuentes: [forum], estados_fuentes: { ...metadata.estados_fuentes, anexos: { estado: 'ok' } } }, 'En el documento de respuestas, pregunta 4: revisar el numeral indicado. [1]')) });
    expect(covered.status).toBe('answered_with_sources');
  });

  it.each([
    [{ finish: 'length' }, { done: true }], [{ finish: 'content_filter' }, { done: true }],
    [{ finish: 'stop' }], [{ done: true }], [{ finish: 'stop' }, { error: 'stream failure' }, { done: true }],
  ])('does not publish an unfinished stream (%j)', async (...extra) => {
    const result = await consultExpertForSupport({ ...input, fetchImpl: fetchOnce(sse(metadata, 'Respuesta parcial [1]', extra)) });
    expect(result.status).toBe('incomplete');
    expect(result.reply).not.toContain('Respuesta parcial');
  });

  it('parses arbitrary chunk boundaries and UTF-8 without losing citations', async () => {
    const original = await sse(metadata, 'Cláusula y precisión [1]').text();
    const bytes = new TextEncoder().encode(original);
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
      controller.close();
    } });
    const result = await consultExpertForSupport({ ...input, fetchImpl: fetchOnce(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })) });
    expect(result).toMatchObject({ status: 'answered_with_sources', reply: 'Cláusula y precisión [1]' });
  });

  it.each([new Response('internal', { status: 500 }), new Response('{}'), new Error('network')])('fails closed on unavailable upstream', async response => {
    const fetchImpl = fetchOnce(response);
    expect((await consultExpertForSupport({ ...input, fetchImpl })).status).toBe('needs_evidence');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('times out a stalled call without retry', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));
    const result = await consultExpertForSupport({ ...input, fetchImpl, timeoutMs: 5 });
    expect(result.status).toBe('needs_evidence');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it.each(['https://example.org/doc?sig=synthetic', 'https://example.org/doc?key=synthetic', 'https://example.org/doc?auth=synthetic', 'https://example.org/doc#token=synthetic', 'http://127.0.0.1/admin', 'javascript:alert(1)', 'https://example.org/doc?token=synthetic', 'https://example.org/storage/v1/object/sign/a', 'https://user:password@example.org/doc'])('does not persist credentials or unsafe source URL %s', async url => {
    const result = await consultExpertForSupport({ ...input, fetchImpl: fetchOnce(sse({ ...metadata, fuentes: [{ ...source, url }] })) });
    expect(result.sources[0].url).toBeNull();
  });
});

describe('actual support handler delegates once and retains its own tenant boundary', () => {
  const request = (extra: Record<string, unknown> = {}) => ({ messages: [{ role: 'user', content: '¿Qué requisitos exige?' }], contexto: { codigo: CODE }, ...extra });
  it('persists sources and uses no second model call or quota RPC in support', async () => {
    const h = createSupportHarness({ fetchResults: [sse()] });
    const { response, body } = await h.run(request());
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ estado_respuesta: 'answered_with_sources', fuentes: [source], codigo_activo: CODE, memoria_guardada: true });
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.rows.evaristo_mensajes[1].meta).toMatchObject({ solicitudes_experto: 1, solicitudes_ia: 0, fuentes: [source], evidencia_documental: 'citada_parcial' });
    expect(h.rpc.mock.calls.map(([name]) => name)).not.toContain('experto_registrar_uso');
    expect(h.rpc.mock.calls.map(([name]) => name)).not.toContain('registrar_uso_ia');
    expect(h.fetch.mock.calls[0][1]?.headers).toMatchObject({ 'x-forwarded-for': '198.51.100.99, 203.0.113.1' });
    expect(h.rows.evaristo_acciones).toHaveLength(0);
  });

  it.each([401, 402, 403, 429])('returns real HTTP %i and saves the denial without extra calls', async status => {
    const h = createSupportHarness({ fetchResults: [new Response('{}', { status })], serviceKey: true });
    const { response, body } = await h.run(request({ identidad: { user_id: 'other-company-owner' } }));
    expect(response.status).toBe(status);
    expect(body).toMatchObject({ estado_respuesta: 'access_denied', experto_http_status: status, memoria_guardada: true });
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.fetch.mock.calls)).not.toContain('synthetic-service');
    expect(JSON.stringify(h.fetch.mock.calls)).not.toContain('other-company-owner');
    expect(h.rows.evaristo_mensajes.every(row => row.user_id === 'owner-1')).toBe(true);
  });

  it('cannot borrow a foreign conversation code or documents', async () => {
    const h = createSupportHarness({ conversations: [{ id: 'foreign', user_id: 'other-company-user', contexto: { codigo: CODE } }] });
    const { body } = await h.run(request({ conversacion_id: 'foreign', contexto: {} }));
    expect(body.codigo_activo).toBeNull();
    expect(body.conversacion_id).not.toBe('foreign');
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.queries.filter(q => q.table === 'evaristo_conversaciones' && q.operation === 'select').every(q => q.filters.some(f => f.column === 'user_id' && f.value === 'owner-1'))).toBe(true);
  });

  it.each([{ authenticated: false }, { context: {}, authenticated: false, serviceKey: true }])('does not turn an anonymous support request into a privileged Expert call', async options => {
    const h = createSupportHarness(options);
    const { body } = await h.run(request({ identidad: { user_id: 'owner-1' } }));
    expect(body.estado_respuesta).toBe('needs_evidence');
    expect(h.fetch).not.toHaveBeenCalled();
  });
});
