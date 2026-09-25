-- Aviso por correo de nuevas citas agendadas: cron que llama a la edge function
-- alerta-cita-email cada 15 minutos. La función busca citas con avisado=false,
-- manda un correo al fundador y las marca avisado=true (dedup). La columna
-- `avisado` y su baseline se crearon en 20260925...avisado.
select cron.unschedule(jobid) from cron.job where jobname = 'alerta-cita-email';
select cron.schedule('alerta-cita-email', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/alerta-cita-email',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$$);
