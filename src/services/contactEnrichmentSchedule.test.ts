import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('programacion del enriquecimiento de contactos', () => {
  it('no mantiene el cron ni la API intermediaria en Vercel', () => {
    const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));

    expect(config.crons).toBeUndefined();
    expect(existsSync(join(root, 'api/contact-enrichment-cron.ts'))).toBe(false);
  });

  it('evita previews de Dependabot sin desactivar las demas ramas', () => {
    const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
    const deploymentRules = config.git?.deploymentEnabled;

    expect(deploymentRules?.['dependabot/**']).toBe(false);
    expect(deploymentRules?.['codex/**']).not.toBe(false);
    expect(deploymentRules?.['claude/**']).not.toBe(false);
  });

  it('agenda un inicio diario y un worker sin duplicar corridas', () => {
    const migrationFiles = readdirSync(join(root, 'supabase/migrations'))
      .filter((file) => file.endsWith('_contact_enrichment_pg_cron.sql'));

    expect(migrationFiles).toHaveLength(1);

    const sql = readFileSync(
      join(root, 'supabase/migrations', migrationFiles[0]),
      'utf8',
    );

    expect(sql.match(/cron\.schedule\s*\(/g)).toHaveLength(2);
    expect(sql).toContain("'contact-enrichment-daily'");
    expect(sql).toContain("'contact-enrichment-worker'");
    expect(sql).toContain("'0 2 * * *'");
    expect(sql).toContain('contact_enrichment_one_active_run');
    expect(sql).toContain('alter table public.contact_enrichment_logs enable row level security');
    expect(sql).toContain('contact_enrichment_logs_founder_select');
    expect(sql).toContain("auth.jwt() ->> 'email', '')) = 'evaras@firmavb.cl'");
    expect(sql).toContain('unique (run_id, source)');
    expect(sql).toContain("when 'completed' then 'completado'");
    expect(sql).toContain('/functions/v1/contact-enrichment');
    expect(sql).toContain("name = 'service_role_jwt_legacy'");
    expect(sql).toContain('cron.unschedule(v_job.jobid)');
    expect(sql).not.toMatch(/v_sources constant text\[\][\s\S]{0,300}'mercadopublico'/);
    expect(sql).not.toMatch(/v_sources constant text\[\][\s\S]{0,500}'duplicados'/);
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it('persiste y verifica HTTP antes de reintentar con backoff', () => {
    const migration = readdirSync(join(root, 'supabase/migrations'))
      .find((file) => file.endsWith('_contact_enrichment_pg_cron.sql'))!;
    const sql = readFileSync(join(root, 'supabase/migrations', migration), 'utf8');

    expect(sql).toContain('contact_enrichment_http_dispatches');
    expect(sql).toContain('request_id bigint not null unique');
    expect(sql).toContain('left join net._http_response');
    expect(sql).toContain('contact_enrichment_http_outcome');
    expect(sql).toContain('contact_enrichment_retry_delay_seconds');
    expect(sql).toContain('contact_enrichment_dispatch_due_retries');
    expect(sql).toContain("status = 'failed'");
    expect(sql).toContain("'despacho_enriquecimiento_' || v_dispatch.kind");
  });

  it('procesa lotes acotados y no invoca el worker cuando no hay trabajo', () => {
    const edgeFunction = readFileSync(
      join(root, 'supabase/functions/contact-enrichment/index.ts'),
      'utf8',
    );
    const migration = readdirSync(join(root, 'supabase/migrations'))
      .find((file) => file.endsWith('_contact_enrichment_pg_cron.sql'))!;
    const sql = readFileSync(join(root, 'supabase/migrations', migration), 'utf8');

    expect(edgeFunction).toContain('const BATCH_SIZE = 100');
    expect(edgeFunction).toContain('has_more: procesados === batchSize');
    expect(edgeFunction).toContain('result.errores > 0 && result.nuevos + result.actualizados === 0');
    expect(edgeFunction).toContain('result.nuevos + result.actualizados === 0');
    expect(edgeFunction).toContain('(result.next_cursor ?? job.cursor_value) <= job.cursor_value');
    expect(edgeFunction).toContain('batch_without_progress');
    expect(sql).toContain('timeout_milliseconds := 120000');
    expect(sql).toMatch(/if p_kind = 'worker' and not exists \([\s\S]*then return null; end if;/);
  });

  it('normaliza el resultado tabular del RPC de duplicados', () => {
    const edgeFunction = readFileSync(
      join(root, 'supabase/functions/contact-enrichment/index.ts'),
      'utf8',
    );

    expect(edgeFunction).toContain('const result = Array.isArray(data) ? data[0] : data');
    expect(edgeFunction).toContain('procesados = Number(result.procesados) || 0');
    expect(edgeFunction).toContain('actualizados = Number(result.eliminados) || 0');
  });

  it('incluye pruebas SQL de fallo, retry y unicidad', () => {
    const testSql = readFileSync(
      join(root, 'supabase/tests/contact_enrichment_pipeline.sql'),
      'utf8',
    );

    expect(testSql).toContain("contact_enrichment_http_outcome(503");
    expect(testSql).toContain('contact_enrichment_fail_job');
    expect(testSql).toContain("v_job_status <> 'retry'");
    expect(testSql.match(/unique_violation/g)).toHaveLength(2);
  });

  it('autoriza solo al fundador confirmado y reserva el worker para service_role', () => {
    const edgeFunction = readFileSync(
      join(root, 'supabase/functions/contact-enrichment/index.ts'),
      'utf8',
    );

    expect(edgeFunction).toContain('admin.auth.getUser(token)');
    expect(edgeFunction).toContain("user.email?.toLowerCase() === 'evaras@firmavb.cl'");
    expect(edgeFunction).toContain('Boolean(user.email_confirmed_at)');
    expect(edgeFunction).not.toContain(".from('user_roles')");
    expect(edgeFunction).not.toContain("['admin', 'super_admin']");
    expect(edgeFunction).toContain("if (!caller.serviceRole) return jsonResponse({ error: 'Forbidden' }, 403)");
    expect(edgeFunction).toContain(".rpc('contact_enrichment_enqueue'");
    expect(edgeFunction).toContain(".rpc('contact_enrichment_claim_job'");
  });

  it('rechaza en servidor a otro administrador aunque tenga rol elevado', () => {
    const edgeFunction = readFileSync(
      join(root, 'supabase/functions/contact-enrichment/index.ts'),
      'utf8',
    );

    expect(edgeFunction).toContain("user.email?.toLowerCase() === 'evaras@firmavb.cl'");
    expect(edgeFunction).not.toContain(".from('user_roles')");
    expect(edgeFunction).not.toContain(".in('role', ['admin', 'super_admin'])");
    expect(edgeFunction).toMatch(/Boolean\(user\.email_confirmed_at\)[\s\S]*return \{ serviceRole: false, userId: user\.id \}[\s\S]*return null/);
  });

  it('documenta un corte y rollback sin solapar los dos programadores', () => {
    const runbook = readFileSync(join(root, 'docs/CONTACT_ENRICHMENT_SETUP.md'), 'utf8');

    expect(runbook).toContain('Realizar fuera de las 02:00 UTC');
    expect(runbook).toContain('Desplegar primero la versión compatible');
    expect(runbook).toContain('Solo entonces desplegar `vercel.json`');
    expect(runbook).toMatch(/Rollback del programador:[\s\S]*desactivar \*\*solo\*\* `contact-enrichment-daily`[\s\S]*dejar[\s\S]*`contact-enrichment-worker` activo[\s\S]*restaurar la API\/Cron de Vercel anterior/);
  });
});
