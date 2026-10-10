/** Real Claude adapter with local SSE fixtures only. No provider requests or credentials. */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Message = { role: string; content: string };
type Options = { modelo: string; maxTokens: number; temperature?: number; signal?: AbortSignal };
type Result = { resp: Response; modelo: string } | null;
type Adapter = (messages: Message[], options: Options) => Promise<Result>;
type Delta = { choices?: Array<{ delta?: { content?: string }; finish_reason?: string }> };
const messages: Message[] = [{ role: 'system', content: 'System fixture' }, { role: 'user', content: 'Question fixture' }];
const options: Options = { modelo: 'synthetic-claude-model', maxTokens: 2500, temperature: 0.3 };
const enc = new TextEncoder();
const textEvent = { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Información íntegra.' } };
const deltaEvent = (reason: string) => ({ type: 'message_delta', delta: { stop_reason: reason } });
const stopEvent = { type: 'message_stop' };
const sse = (...events: unknown[]) => events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('');
const source = readFileSync(new URL('../../supabase/functions/experto-consultar/claudeFallback.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

function harness(fetchImpl: (url: string, init: RequestInit) => Promise<Response>, key = 'synthetic-key') {
  const fetch = vi.fn(fetchImpl);
  const exported: { fetchClaudeComoOpenAI?: Adapter } = {};
  runInNewContext(compiled, {
    exports: exported, Deno: { env: { get: () => key } }, fetch,
    Response, ReadableStream, TextEncoder, TextDecoder, AbortController, AbortSignal, DOMException,
    setTimeout, clearTimeout, console: { error: vi.fn() },
  }, { filename: 'claude-fallback.mocked.js', timeout: 1000 });
  if (!exported.fetchClaudeComoOpenAI) throw new Error('Claude adapter export missing');
  return { run: exported.fetchClaudeComoOpenAI, fetch };
}
const fixture = (body: BodyInit) => harness(async () => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
async function read(result: Result) {
  expect(result).not.toBeNull();
  const raw = await result!.resp.text();
  const events = raw.split('\n').filter(line => line.startsWith('data: ') && line !== 'data: [DONE]').map(line => JSON.parse(line.slice(6)) as Delta);
  return { raw, events, text: events.map(event => event.choices?.[0]?.delta?.content ?? '').join(''), finishes: events.flatMap(event => event.choices?.[0]?.finish_reason ?? []) };
}

afterEach(() => vi.useRealTimers());

describe('Claude fallback SSE completion and cancellation', () => {
  it.each(['end_turn', 'stop_sequence'])('emits stop only for completed %s and preserves request/model contract', async reason => {
    const h = fixture(sse(textEvent, deltaEvent(reason), stopEvent));
    const result = await h.run(messages, options);
    const out = await read(result);
    expect(out.text).toBe('Información íntegra.');
    expect(out.finishes).toEqual(['stop']);
    expect(out.raw).toMatch(/data: \[DONE\]\n\n$/);
    expect(result?.modelo).toBe('claude:synthetic-claude-model');
    const [url, init] = h.fetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers).toEqual({ 'x-api-key': 'synthetic-key', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({ model: options.modelo, max_tokens: 2500, temperature: 0.3, system: [{ type: 'text', text: 'System fixture', cache_control: { type: 'ephemeral' } }], messages: [messages[1]], stream: true });
  });

  it.each([
    ['max_tokens', 'length'], ['refusal', 'content_filter'], ['content_filter', 'content_filter'],
    ['tool_use', 'incomplete'], ['pause_turn', 'incomplete'], ['future_reason', 'incomplete'],
  ])('maps %s to %s rather than successful completion', async (reason, expected) => {
    const h = fixture(sse(textEvent, deltaEvent(reason), stopEvent));
    expect((await read(await h.run(messages, options))).finishes).toEqual([expected]);
  });

  it.each([
    sse(textEvent), sse(textEvent, deltaEvent('end_turn')), sse(textEvent, stopEvent),
    sse(textEvent, stopEvent, deltaEvent('end_turn')), `${sse(textEvent)}data: {broken\n\n${sse(deltaEvent('end_turn'), stopEvent)}`,
    sse(textEvent, { type: 'error', error: { type: 'overloaded_error', message: 'private provider detail' } }, deltaEvent('end_turn'), stopEvent),
  ])('never invents stop on missing/invalid terminal events', async body => {
    const h = fixture(body);
    const out = await read(await h.run(messages, options));
    expect(out.finishes).toEqual(['incomplete']);
    expect(out.raw).not.toContain('private provider detail');
  });

  it('decodes split UTF-8 and SSE lines and the final event without a trailing newline', async () => {
    const bytes = enc.encode(sse({ type: 'ping' }, { type: 'future_event', detail: 'ignored' }, textEvent, deltaEvent('end_turn'), stopEvent).trimEnd());
    let index = 0;
    const upstream = new ReadableStream<Uint8Array>({ pull(ctrl) { if (index === bytes.length) ctrl.close(); else ctrl.enqueue(bytes.slice(index, ++index)); } });
    const h = fixture(upstream);
    const out = await read(await h.run(messages, options));
    expect(out.text).toBe('Información íntegra.');
    expect(out.finishes).toEqual(['stop']);
  });

  it('does not report success when the provider stream throws after partial text', async () => {
    let count = 0;
    const upstream = new ReadableStream<Uint8Array>({ pull(ctrl) {
      if (count++ === 0) ctrl.enqueue(enc.encode(sse(textEvent, deltaEvent('end_turn'))));
      else ctrl.error(new Error('Synthetic broken upstream'));
    } });
    const h = fixture(upstream);
    expect((await read(await h.run(messages, options))).finishes).toEqual(['incomplete']);
  });

  it('does not emit a finish reason while waiting for message_stop', async () => {
    let upstreamControl: ReadableStreamDefaultController<Uint8Array> | undefined;
    const h = fixture(new ReadableStream<Uint8Array>({ start(ctrl) { upstreamControl = ctrl; ctrl.enqueue(enc.encode(sse(textEvent, deltaEvent('end_turn')))); } }));
    const result = await h.run(messages, options);
    const reader = result!.resp.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).not.toContain('finish_reason');
    let nextReadSettled = false;
    const nextRead = reader.read().then(value => { nextReadSettled = true; return value; });
    await Promise.resolve(); await Promise.resolve();
    expect(nextReadSettled).toBe(false);
    upstreamControl!.enqueue(enc.encode(sse(stopEvent))); upstreamControl!.close();
    expect(new TextDecoder().decode((await nextRead).value)).toContain('"finish_reason":"stop"');
    await reader.cancel();
  });

  it('does not fetch when the request is already aborted', async () => {
    const controller = new AbortController(); controller.abort();
    const h = fixture(sse(textEvent, deltaEvent('end_turn'), stopEvent));
    await expect(h.run(messages, { ...options, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it('propagates request cancellation during fetch instead of returning an available fallback', async () => {
    const controller = new AbortController();
    const h = harness(async (_url, init) => new Promise<Response>((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true })));
    const pending = h.run(messages, { ...options, signal: controller.signal });
    const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejection;
    expect(h.fetch).toHaveBeenCalledOnce();
    expect(h.fetch.mock.calls[0][1].signal?.aborted).toBe(true);
  });

  it('cancels an active upstream reader and propagates external abort during streaming', async () => {
    const cancel = vi.fn(); const controller = new AbortController();
    const h = fixture(new ReadableStream<Uint8Array>({ start(ctrl) { ctrl.enqueue(enc.encode(sse(textEvent))); }, cancel }));
    const result = await h.run(messages, { ...options, signal: controller.signal });
    const readPending = result!.resp.text();
    const rejected = expect(readPending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('aborts provider IO when its translated response is cancelled', async () => {
    const cancel = vi.fn();
    const h = fixture(new ReadableStream<Uint8Array>({ start(ctrl) { ctrl.enqueue(enc.encode(sse(textEvent))); }, cancel }));
    const result = await h.run(messages, options);
    await result!.resp.body!.cancel('Consumer closed');
    expect(cancel).toHaveBeenCalledOnce();
    expect(h.fetch.mock.calls[0][1].signal?.aborted).toBe(true);
  });

  it('preserves the 15 second fetch budget and clears its timer after failure', async () => {
    vi.useFakeTimers();
    const h = harness(async (_url, init) => new Promise<Response>((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true })));
    const pending = h.run(messages, options);
    await vi.advanceTimersByTimeAsync(15000);
    expect(await pending).toBeNull();
    expect(h.fetch.mock.calls[0][1].signal?.reason).toMatchObject({ name: 'TimeoutError' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('marks a stalled stream incomplete when the same 15 second budget expires', async () => {
    vi.useFakeTimers(); const cancel = vi.fn();
    const h = fixture(new ReadableStream<Uint8Array>({ start(ctrl) { ctrl.enqueue(enc.encode(sse(textEvent))); }, cancel }));
    const result = await h.run(messages, options);
    const output = read(result);
    await vi.advanceTimersByTimeAsync(15000);
    expect((await output).finishes).toEqual(['incomplete']);
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns null for provider HTTP failure without changing auth or retrying', async () => {
    const h = harness(async () => new Response('Synthetic unavailable response', { status: 503 }));
    expect(await h.run(messages, options)).toBeNull();
    expect(h.fetch).toHaveBeenCalledOnce();
  });
});
