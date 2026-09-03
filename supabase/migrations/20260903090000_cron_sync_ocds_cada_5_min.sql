-- Acelera el relleno OCDS: cada 5 min y 300 procesos por tramo (~80 s por corrida; el
-- guardia de tiempo de la funcion corta antes del limite y el puntero solo avanza si no hubo errores).
select cron.unschedule(jobid) from cron.job where jobname = 'sync-ocds-cron';
select cron.schedule('sync-ocds-cron', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/sync-ocds',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{"lote_mes": 300}'::jsonb, timeout_milliseconds := 150000);
$$);
