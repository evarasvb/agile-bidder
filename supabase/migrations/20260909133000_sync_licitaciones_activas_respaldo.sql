-- Respaldo del workflow de GitHub (sync-mercadopublico.yml, 09:00/15:00/21:00 UTC): el cron
-- programado de GitHub no corrió el 09-09 y las licitaciones del día quedaron sin entrar hasta
-- dispararlo a mano. pg_cron llama a sync-licitaciones-bi (estado=activas, ticket del env de la
-- función) media hora después de cada horario del workflow; el upsert es idempotente.
select cron.unschedule(jobid) from cron.job where jobname = 'sync-licitaciones-activas';
select cron.schedule('sync-licitaciones-activas', '30 9,15,21 * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/sync-licitaciones-bi',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{"estado":"activas"}'::jsonb, timeout_milliseconds := 150000);
$$);
