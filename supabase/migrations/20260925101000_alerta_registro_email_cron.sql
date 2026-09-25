-- Aviso por correo de nuevos registros: cron que llama a la edge function
-- alerta-registro-email cada 15 minutos. Busca profiles con avisado=false,
-- manda un correo al fundador y los marca avisado=true.
select cron.unschedule(jobid) from cron.job where jobname = 'alerta-registro-email';
select cron.schedule('alerta-registro-email', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/alerta-registro-email',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$$);
