import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('infraestructura segura de pagos de Academia', () => {
  it('permite cerrar checkout y webhook antes de una migración', () => {
    const checkout = readFileSync(
      join(root, 'supabase/functions/crear-pago-curso/index.ts'),
      'utf8',
    );
    const webhook = readFileSync(
      join(root, 'supabase/functions/mp-curso-webhook/index.ts'),
      'utf8',
    );
    const security = readFileSync(
      join(root, 'supabase/functions/_shared/academia-security.ts'),
      'utf8',
    );

    expect(checkout).toContain("Deno.env.get('ACADEMIA_CHECKOUT_MAINTENANCE')");
    expect(webhook).toContain("Deno.env.get('ACADEMIA_WEBHOOK_MAINTENANCE')");
    expect(checkout).toContain("'Retry-After': '300'");
    expect(webhook).toContain("'Retry-After': '300'");
    expect(security).toContain('academyMaintenanceEnabled');
  });

  it('valida firma y límites antes de persistir contracargos', () => {
    const webhook = readFileSync(
      join(root, 'supabase/functions/mp-curso-webhook/index.ts'),
      'utf8',
    );
    const signatureCheck = webhook.indexOf(
      'const authorization = await authorizeMercadoPagoChargeback',
    );
    const rateLimit = webhook.indexOf('const rateResults = await Promise.all');
    const inboxWrite = webhook.indexOf("db.from('academia_mp_inbox').upsert");

    expect(signatureCheck).toBeGreaterThan(0);
    expect(rateLimit).toBeGreaterThan(signatureCheck);
    expect(inboxWrite).toBeGreaterThan(rateLimit);
    expect(webhook).toContain("secret: Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET')");
    expect(webhook).toContain("authorization === 'configuration_error'");
    expect(webhook).toContain("authorization !== 'authorized'");
    expect(webhook).toContain("if (event.kind === 'chargeback')");
    expect(webhook).not.toContain('hasSignatureHeaders');
    expect(webhook).not.toContain('signedChargeback');
  });

  it('deduplica por recurso firmado y agenda el worker cada cinco minutos', () => {
    const migrations = readdirSync(join(root, 'supabase/migrations'))
      .filter((file) => file.endsWith('_secure_academia_mp_webhooks.sql'));
    expect(migrations).toHaveLength(1);

    const sql = readFileSync(
      join(root, 'supabase/migrations', migrations[0]),
      'utf8',
    );
    expect(sql).toContain('signature_verified boolean not null default false');
    expect(sql).toContain('academia_mp_inbox_provider_resource_key');
    expect(sql).toContain('where inbox.signature_verified');
    expect(sql).toContain('academia_pausar_eventos_mp');
    expect(sql).toContain("name = 'service_role_jwt_legacy'");
    expect(sql).toContain("'academia-mp-inbox-worker'");
    expect(sql).toContain("'*/5 * * * *'");
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it('reserva el worker al service_role y no conserva el secreto anterior', () => {
    const worker = readFileSync(
      join(root, 'supabase/functions/procesar-academia-mp-inbox/index.ts'),
      'utf8',
    );
    const config = readFileSync(join(root, 'supabase/config.toml'), 'utf8');

    expect(worker).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    expect(worker).not.toContain('ACADEMIA_WORKER_SECRET');
    expect(config).toMatch(
      /\[functions\.procesar-academia-mp-inbox\]\s+verify_jwt = true/,
    );
  });

  it('aborta la migración si aparecen entregas legacy sin vínculo autoritativo', () => {
    const migration = readFileSync(
      join(root, 'supabase/migrations/20260926013000_academia_bundle_entrega_atomica.sql'),
      'utf8',
    );

    expect(migration).toContain('Academia tiene entregas legacy');
    expect(migration).toContain("estado in ('approved', 'aprobado', 'aprobado_sin_email')");
    expect(migration).toContain('where mp_payment_id is not null');
  });
});
