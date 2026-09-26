-- Aviso por correo de nuevas conexiones de Google Drive: cron que llama a la
-- edge function alerta-drive-email cada 15 minutos. La función busca conexiones
-- con avisado=false, manda un correo al fundador y las marca avisado=true.
select cron.unschedule(jobid) from cron.job where jobname = 'alerta-drive-email';
select cron.schedule('alerta-drive-email', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/alerta-drive-email',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$$);
