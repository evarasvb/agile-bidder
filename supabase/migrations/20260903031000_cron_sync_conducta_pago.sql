-- Job: cada 15 minutos lee la ficha de Mercado Público de hasta 40 instituciones
-- (las más desactualizadas primero; se refrescan cada 7 días). ~1 s por institución.
-- Reemplaza al workflow de GitHub "poblar-riesgo-semanal", que falló 31 semanas seguidas
-- y cuyo script generaba datos aleatorios.
select cron.unschedule(jobid) from cron.job where jobname = 'sync-conducta-pago-cron';
select cron.schedule(
  'sync-conducta-pago-cron',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/sync-conducta-pago',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{"lote": 40, "dias": 7}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
