-- Job: cada 10 minutos carga hasta 3 días pendientes (ambos tipos) del buscador de reclamos.
-- Primero rellena los últimos 365 días (~2 h) y después solo carga el día anterior.
select cron.unschedule(jobid) from cron.job where jobname = 'sync-reclamos-mp-cron';
select cron.schedule(
  'sync-reclamos-mp-cron',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/sync-reclamos-mp',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{"dias": 3}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
