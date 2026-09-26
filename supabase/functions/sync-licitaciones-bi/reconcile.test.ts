import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as reconciliation from './reconcile.ts';
import { reconcileStatuses, REQUEST_LIMIT, SCAN_LIMIT, type Candidate, type StatusPatch } from './reconcile.ts';

const NOW = Date.parse('2026-09-14T18:00:00Z');
const CODE = '2699-35-LE26';
const row = (codigo = CODE): Candidate => ({
  id: codigo, codigo, estado: 'Publicada', codigo_estado: 5,
  fecha_cierre: '2026-09-02T12:00:00Z', updated_at: '2026-08-27T00:25:58Z',
  raw_data: { Estado: 'Publicada', CodigoEstado: 5, MontoEstimado: 56037632, Items: [{ Cantidad: 34 }] },
});
const detail = (codigo = CODE, CodigoEstado = 18) => new Response(JSON.stringify({
  Listado: [{ CodigoExterno: codigo, CodigoEstado, Estado: reconciliation.STATUS_BY_CODE[CodigoEstado], MontoEstimado: 1, Items: [] }],
}));
function fixture(rows = [row()]) {
  const records = rows.map(r => structuredClone(r));
  const save = vi.fn(async (candidate: Candidate, patch: StatusPatch) => {
    const current = records.find(r => r.id === candidate.id)!;
    if (current.updated_at !== candidate.updated_at) return false;
    Object.assign(current, patch);
    return true;
  });
  const ports = {
    load: vi.fn(async () => structuredClone(records)), save,
    fetch: vi.fn<typeof fetch>().mockImplementation(async () => detail()),
    sleep: vi.fn(async (_ms: number) => {}), now: () => NOW,
  };
  return { records, ports };
}

describe('bounded official status reconciliation', () => {
  it('2699-35-LE26: confirms Revocada/18, preserving budget/items and all other detail', async () => {
    const { ports, records } = fixture();
    const before = structuredClone(records[0]);
    const result = await reconcileStatuses(new Set(), 'fake-ticket', ports);
    expect(result).toMatchObject({ attempted: 1, verified: 1, changed: 1, errors: [] });
    const patch = ports.save.mock.calls[0][1];
    expect(Object.keys(patch).sort()).toEqual(['codigo_estado', 'estado', 'raw_data', 'updated_at']);
    expect(records[0]).toMatchObject({ estado: 'Revocada', codigo_estado: 18, fecha_cierre: before.fecha_cierre });
    expect(patch.raw_data).toMatchObject({ MontoEstimado: 56037632, Items: [{ Cantidad: 34 }], Estado: 'Revocada', CodigoEstado: 18 });
    expect(patch.raw_data._firmavb_estado).toMatchObject({ verificado_en: new Date(NOW).toISOString(), error: null });
    const url = new URL(String(ports.fetch.mock.calls[0][0]));
    expect(url.searchParams.get('codigo')).toBe(CODE);
    expect(url.searchParams.get('estado')).toBeNull();
  });
  it('absence from activas does not imply revocation: official Publicada remains Publicada', async () => {
    const { ports, records } = fixture();
    ports.fetch.mockResolvedValue(detail(CODE, 5));
    const result = await reconcileStatuses(new Set(), 'fake-ticket', ports);
    expect(result).toMatchObject({ changed: 0, verified: 1 });
    expect(records[0].estado).toBe('Publicada');
  });
  it('does not overwrite malformed existing metadata', async () => {
    const { ports, records } = fixture([{ ...row(), raw_data: ['keep'] }]);
    expect((await reconcileStatuses(new Set(), 'fake-ticket', ports)).errors).toEqual([`reconcile ${CODE}: invalid_existing_metadata`]);
    expect(ports.fetch).not.toHaveBeenCalled();
    expect(ports.save).not.toHaveBeenCalled();
    expect(records[0].raw_data).toEqual(['keep']);
  });
  it.each([
    ['429', () => new Response('', { status: 429 }), 'rate_limited'],
    ['HTTP', () => new Response('', { status: 503 }), 'http_503'],
    ['invalid JSON', () => new Response('{bad'), 'transport_or_json_failed'],
    ['empty', () => new Response(JSON.stringify({ Listado: [] })), 'invalid_detail'],
    ['wrong code', () => detail('999-1-LE26'), 'invalid_detail'],
    ['missing status', () => new Response(JSON.stringify({ Listado: [{ CodigoExterno: CODE, CodigoEstado: 18 }] })), 'invalid_status'],
    ['contradictory status', () => new Response(JSON.stringify({ Listado: [{ CodigoExterno: CODE, CodigoEstado: 18, Estado: 'Publicada' }] })), 'invalid_status'],
  ] as const)('%s preserves state and reports only a safe failure', async (_label, response, error) => {
    const { ports, records } = fixture();
    ports.fetch.mockImplementation(async () => response());
    const result = await reconcileStatuses(new Set(), 'fake-ticket', ports);
    expect(result.verified).toBe(0);
    expect(result.errors).toContain(`reconcile ${CODE}: ${error}`);
    expect(JSON.stringify(result)).not.toContain('fake-ticket');
    expect(records[0]).toMatchObject({ estado: 'Publicada', codigo_estado: 5 });
    expect(ports.save.mock.calls[0][1]).not.toHaveProperty('estado');
    expect(ports.save.mock.calls[0][1].raw_data._firmavb_estado).not.toHaveProperty('verificado_en');
  });
  it('transport timeout preserves state and never exposes the failed URL/ticket', async () => {
    const { ports, records } = fixture();
    ports.fetch.mockRejectedValue(new Error('secret URL fake-ticket'));
    const result = await reconcileStatuses(new Set(), 'fake-ticket', ports);
    expect(result.errors).toEqual([`reconcile ${CODE}: transport_or_json_failed`]);
    expect(records[0].codigo_estado).toBe(5);
  });
  it('second execution is idempotent and makes no additional request', async () => {
    const { ports, records } = fixture();
    await reconcileStatuses(new Set(), 'fake-ticket', ports);
    const once = structuredClone(records);
    expect(await reconcileStatuses(new Set(), 'fake-ticket', ports)).toMatchObject({ attempted: 0, changed: 0 });
    expect(records).toEqual(once);
    expect(ports.fetch).toHaveBeenCalledTimes(1);
  });
  it('cooldown also avoids repeated checks of still-open rows and failures', async () => {
    const { ports } = fixture();
    ports.fetch.mockResolvedValue(new Response('', { status: 503 }));
    await reconcileStatuses(new Set(), 'fake-ticket', ports);
    expect((await reconcileStatuses(new Set(), 'fake-ticket', ports)).attempted).toBe(0);
  });
  it('caps the scan and requests, serializes calls, and spaces them without retries', async () => {
    const { ports } = fixture(Array.from({ length: SCAN_LIMIT + 10 }, (_, n) => row(`${2700+n}-1-LE26`)));
    let concurrent = 0, peak = 0;
    ports.fetch.mockImplementation(async url => {
      peak = Math.max(peak, ++concurrent);
      await Promise.resolve();
      concurrent--;
      return detail(new URL(String(url)).searchParams.get('codigo')!);
    });
    const result = await reconcileStatuses(new Set(), 'fake-ticket', ports);
    expect(result.attempted).toBe(REQUEST_LIMIT);
    expect(peak).toBe(1);
    expect(ports.sleep.mock.calls).toEqual(Array.from({ length: REQUEST_LIMIT - 1 }, () => [1200]));
    expect(ports.fetch.mock.calls.every(call => call[1]?.signal instanceof AbortSignal)).toBe(true);
  });
  it('429 stops the entire batch with no retry', async () => {
    const { ports } = fixture([row(), row('2700-1-LE26')]);
    ports.fetch.mockResolvedValue(new Response('', { status: 429 }));
    expect((await reconcileStatuses(new Set(), 'fake-ticket', ports)).attempted).toBe(1);
    expect(ports.fetch).toHaveBeenCalledTimes(1);
  });
  it('checks stale active rows, but skips recently refreshed active rows', async () => {
    const recent = { ...row('2700-1-LE26'), fecha_cierre: '2026-10-01T12:00:00Z', updated_at: new Date(NOW).toISOString() };
    const { ports } = fixture([row(), recent]);
    await reconcileStatuses(new Set([CODE, recent.codigo]), 'fake-ticket', ports);
    expect(ports.fetch).toHaveBeenCalledTimes(1);
  });
  it('load, write and concurrent failures are safe, and a partial failure does not discard later successes', async () => {
    const first = fixture();
    first.ports.load.mockRejectedValue(new Error('secret'));
    expect((await reconcileStatuses(new Set(), 'fake-ticket', first.ports)).errors).toEqual(['reconcile: candidate_read_failed']);
    expect(first.ports.fetch).not.toHaveBeenCalled();
    const { ports } = fixture([row(), row('2700-1-LE26')]);
    ports.fetch.mockImplementation(async url => detail(new URL(String(url)).searchParams.get('codigo')!));
    ports.save.mockRejectedValueOnce(new Error('secret'));
    const result = await reconcileStatuses(new Set(), 'fake-ticket', ports);
    expect(result).toMatchObject({ attempted: 2, changed: 1, errors: [`reconcile ${CODE}: persistence_failed`] });
    const conflict = fixture();
    conflict.ports.save.mockResolvedValue(false);
    expect((await reconcileStatuses(new Set(), 'fake-ticket', conflict.ports)).errors).toEqual([`reconcile ${CODE}: concurrent_update`]);
    expect(conflict.records[0].estado).toBe('Publicada');
  });
});

describe('existing sync handler, isolated from all network and production', () => {
  it('keeps gateway JWT verification enabled for the sync function', () => {
    const config = readFileSync(new URL('../../config.toml', import.meta.url), 'utf8');
    expect(config).toMatch(/\[functions\.sync-licitaciones-bi\]\s+verify_jwt = true/);
  });

  it.each(['none', 'revoked', '429'])('normal sync and guarded reconciliation: %s', async mode => {
    let handler!: (req: Request) => Promise<Response>;
    const upsert = vi.fn((rows: Array<{ codigo: string }>) => ({ select: async () => ({ data: rows.map(r => ({ id: r.codigo, codigo: r.codigo })), error: null }) }));
    const insert = vi.fn(async () => ({ error: null }));
    const removeItems = vi.fn(async () => ({ error: null }));
    const limit = vi.fn(async () => ({ data: mode === 'none' ? [] : [row()], error: null }));
    const or = vi.fn();
    const order = vi.fn();
    const selection = { or, order, limit };
    or.mockReturnValue(selection); order.mockReturnValue(selection);
    const eq = vi.fn();
    const guarded = { eq, is: vi.fn(), select: async () => ({ data: [{ id: CODE }], error: null }) };
    eq.mockReturnValue(guarded);
    const update = vi.fn(() => guarded);
    const from = vi.fn(() => ({ upsert, insert, update, delete: () => ({ in: removeItems }), select: () => selection }));
    const fakeFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ Cantidad: 1, Listado: [{
      CodigoExterno: '2700-1-LE26', Nombre: 'Cámaras', CodigoEstado: 5, FechaCierre: '2026-10-01',
      Items: [{ NombreProducto: 'Cámara', Cantidad: 2 }],
    }] }))).mockImplementation(async () => mode === '429' ? new Response('', { status: 429 }) : detail());
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(compiled, {
      exports: {}, require: (name: string) => {
        if (name === './reconcile.ts') return reconciliation;
        if (name === 'https://esm.sh/@supabase/supabase-js@2') return { createClient: () => ({ from }) };
        throw new Error('Unexpected import');
      },
      Deno: { serve: (fn: typeof handler) => { handler = fn; }, env: { get: () => 'fake' } },
      fetch: fakeFetch, Request, Response, URLSearchParams, setTimeout, atob,
    });
    const unauthorized = await handler(new Request('https://local.test', { method: 'POST', body: JSON.stringify({ estado: 'activas' }) }));
    expect(unauthorized.status).toBe(401);
    const mismatchedLegacyKey = await handler(new Request('https://local.test', {
      method: 'POST', headers: { Authorization: 'Bearer fake' }, body: JSON.stringify({ estado: 'activas' }),
    }));
    expect(mismatchedLegacyKey.status).toBe(401);
    expect(fakeFetch).not.toHaveBeenCalled();
    const serviceJwt = `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`;
    const response = await handler(new Request('https://local.test', {
      method: 'POST', headers: { Authorization: `Bearer ${serviceJwt}` }, body: JSON.stringify({ estado: 'activas' }),
    }));
    expect(await response.json()).toMatchObject({ success: mode !== '429', synced: 1, items_synced: 1, status_checks: mode === 'none' ? 0 : 1 });
    expect(upsert.mock.calls[0][0][0]).toMatchObject({ codigo: '2700-1-LE26', estado: 'Publicada', codigo_estado: 5 });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(removeItems).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith(SCAN_LIMIT);
    expect(order).toHaveBeenCalledWith('updated_at', { ascending: true, nullsFirst: true });
    expect(fakeFetch).toHaveBeenCalledTimes(mode === 'none' ? 1 : 2);
    if (mode !== 'none') {
      expect(eq).toHaveBeenCalledWith('updated_at', row().updated_at);
      expect(eq).toHaveBeenCalledWith('id', CODE);
      expect(update).toHaveBeenCalledTimes(1);
    }
  });
});
