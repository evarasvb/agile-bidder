-- Cada 10 min: adjudicaciones de licitaciones recientes de la base + relleno OCDS mes a mes (13 meses).
select cron.unschedule(jobid) from cron.job where jobname = 'sync-ocds-cron';
select cron.schedule('sync-ocds-cron', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/sync-ocds',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{}'::jsonb, timeout_milliseconds := 150000);
$$);
