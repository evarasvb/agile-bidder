import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';

const mock = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({ createClient: mock.createClient }));

let handler: (request: Request) => Promise<Response>;
let db: { rpc: ReturnType<typeof vi.fn>; from: ReturnType<typeof vi.fn>; storage: { getBucket: ReturnType<typeof vi.fn>; from: ReturnType<typeof vi.fn> } };
const key = 'synthetic-service-key';
const token = 'synthetic-mp-key';

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  vi.stubGlobal('Deno', {
    env: { get: (name: string) => ({ SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_SERVICE_ROLE_KEY: key, MERCADOPAGO_ACCESS_TOKEN: token, MERCADOPAGO_WEBHOOK_SECRET: 'synthetic-signature-key' })[name] },
    serve: (value: typeof handler) => { handler = value; },
  });
  db = {
    rpc: vi.fn(),
    from: vi.fn(() => ({ select: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ error: null }) })) })),
    storage: {
      getBucket: vi.fn().mockResolvedValue({ data: { public: false }, error: null }),
      from: vi.fn(() => ({ list: vi.fn().mockResolvedValue({ data: [{ name: 'planillas-programa-pro.xlsx', metadata: { size: 19616, mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } }], error: null }) })),
    },
  };
  mock.createClient.mockReset().mockReturnValue(db);
  const workerModule: string = '../../supabase/functions/procesar-academia-mp-inbox/index';
  await import(/* @vite-ignore */ workerModule);
});

afterEach(() => vi.unstubAllGlobals());

function request(bearer: string) {
  return new Request('https://synthetic.invalid/worker', { method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preflight' }) });
}

describe('authenticated read-only Academy worker preflight', () => {
  it('rejects a wrong bearer before any resource check', async () => {
    const response = await handler(request('wrong-key'));
    expect(response.status).toBe(401);
    expect(mock.createClient).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('reports readiness without claiming events or returning credentials', async () => {
    const response = await handler(request(key));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(JSON.parse(body)).toMatchObject({ action: 'preflight', authenticated: true, ready: true });
    expect(body).not.toContain(key);
    expect(body).not.toContain(token);
    expect(db.rpc).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://api.mercadopago.com/users/me');
  });
  it('fails closed on a public bucket without claiming events', async () => {
    db.storage.getBucket.mockResolvedValue({ data: { public: true }, error: null });
    const response = await handler(request(key));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ authenticated: true, ready: false, checks: { bucketPrivate: false } });
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
