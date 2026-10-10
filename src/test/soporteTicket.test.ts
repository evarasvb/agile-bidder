// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import ts from 'typescript';

type Handler = (request: Request) => Promise<Response>;
type EmailPayload = {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  reply_to: string;
  subject: string;
  html: string;
};

function fixture({ resendKey = true, insertError = false, internalEmailOk = true } = {}) {
  let handler: Handler | undefined;
  const emails: EmailPayload[] = [];
  const insert = vi.fn(() => ({
    select: () => ({ single: async () => ({
      data: insertError ? null : { numero: 123 },
      error: insertError ? { message: 'simulated failure' } : null,
    }) }),
  }));
  const from = vi.fn((table: string) => {
    if (table === 'soporte_tickets') return { insert };
    if (table === 'clientes') return {
      select: () => ({ limit: () => ({ eq: () => ({
        maybeSingle: async () => ({ data: null, error: null }),
      }) }) }),
    };
    throw new Error(`Unexpected table: ${table}`);
  });
  const fakeFetch = vi.fn(async (url: string, init: RequestInit) => {
    if (url !== 'https://api.resend.com/emails' || init.method !== 'POST') {
      throw new Error('Unexpected outgoing request');
    }
    emails.push(JSON.parse(String(init.body)) as EmailPayload);
    return new Response('{}', { status: emails.length === 1 && !internalEmailOk ? 500 : 200 });
  });
  const source = readFileSync(new URL('../../supabase/functions/soporte-ticket/index.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(compiled, {
    exports: {},
    require: (name: string) => {
      if (name === 'https://esm.sh/@supabase/supabase-js@2') return { createClient: () => ({ from }) };
      throw new Error(`Unexpected import: ${name}`);
    },
    Deno: {
      serve: (fn: Handler) => { handler = fn; },
      env: { get: (name: string) => {
        if (name === 'SUPABASE_URL') return 'https://supabase.invalid';
        if (name === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-service-role';
        if (name === 'RESEND_API_KEY') return resendKey ? 'test-resend-key' : undefined;
        throw new Error(`Unexpected environment variable: ${name}`);
      } },
    },
    fetch: fakeFetch,
    Response,
    console: { error: vi.fn() },
  });
  if (!handler) throw new Error('Handler not registered');
  const invoke = (body: Record<string, unknown>) => handler!(new Request('https://support.invalid', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { invoke, emails, insert, fakeFetch };
}

describe('soporte-ticket recipients, with all services simulated', () => {
  it.each([
    ['consulta', 'manual'],
    ['consulta', 'automatico'],
    ['bug', 'manual'],
    ['bug', 'automatico'],
  ])('copies only the internal notification for %s / %s', async (tipo, origen) => {
    const { invoke, emails, insert, fakeFetch } = fixture();
    const response = await invoke({
      email: ' CLIENTE@EXAMPLE.COM ', mensaje: 'Consulta de prueba local', tipo, origen,
      cc: ['unexpected@example.com'], to: ['unexpected@example.com'],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, email_equipo: true, email_cliente: true });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(fakeFetch).toHaveBeenCalledTimes(2);
    expect(emails[0]).toMatchObject({
      from: 'FirmaVB <notificaciones@firmavb.cl>', to: ['contacto@firmavb.cl'],
      cc: ['evaras@firmavb.cl'], reply_to: 'cliente@example.com',
    });
    expect(emails[0]).not.toHaveProperty('bcc');
    expect(emails[1]).toMatchObject({
      from: 'FirmaVB <notificaciones@firmavb.cl>', to: ['cliente@example.com'],
      reply_to: 'contacto@firmavb.cl',
    });
    expect(emails[1]).not.toHaveProperty('cc');
    expect(emails[1]).not.toHaveProperty('bcc');
  });

  it.each(['evaras@firmavb.cl', 'contacto@firmavb.cl'])('keeps internal recipients unique when %s submits', async email => {
    const { invoke, emails } = fixture();
    await invoke({ email, mensaje: 'Consulta de prueba local' });
    expect(emails).toHaveLength(2);
    const recipients = [...emails[0].to, ...(emails[0].cc ?? [])];
    expect(recipients).toEqual(['contacto@firmavb.cl', 'evaras@firmavb.cl']);
    expect(new Set(recipients).size).toBe(recipients.length);
    expect(emails[0].reply_to).toBe(email);
    expect(emails[1].to).toEqual([email]);
    expect(emails[1]).not.toHaveProperty('cc');
    expect(emails[1]).not.toHaveProperty('bcc');
  });

  it('still acknowledges the client when the internal provider request fails', async () => {
    const { invoke, emails } = fixture({ internalEmailOk: false });
    const response = await invoke({ email: 'cliente@example.com', mensaje: 'Consulta' });
    expect(await response.json()).toMatchObject({ ok: true, email_equipo: false, email_cliente: true });
    expect(emails).toHaveLength(2);
    expect(emails[1].to).toEqual(['cliente@example.com']);
    expect(emails[1]).not.toHaveProperty('cc');
  });

  it('stores the ticket without sending when no Resend key is configured', async () => {
    const { invoke, insert, fakeFetch } = fixture({ resendKey: false });
    const response = await invoke({ email: 'cliente@example.com', mensaje: 'Consulta' });
    expect(await response.json()).toMatchObject({ ok: true, email_equipo: false, email_cliente: false });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('does not send when storing the ticket fails', async () => {
    const { invoke, fakeFetch } = fixture({ insertError: true });
    const response = await invoke({ email: 'cliente@example.com', mensaje: 'Consulta' });
    expect(response.status).toBe(500);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('rejects an invalid client email before storing or sending', async () => {
    const { invoke, insert, fakeFetch } = fixture();
    const response = await invoke({ email: 'invalid', mensaje: 'Consulta' });
    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
    expect(fakeFetch).not.toHaveBeenCalled();
  });
});
