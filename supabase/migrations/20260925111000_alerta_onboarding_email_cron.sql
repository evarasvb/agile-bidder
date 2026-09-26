-- Aviso por correo de onboarding completado: cron que llama a la edge function
-- alerta-onboarding-email cada 15 minutos. Busca clientes con
-- onboarding_completado=true y aviso_onboarding=false, avisa y los marca.
select cron.unschedule(jobid) from cron.job where jobname = 'alerta-onboarding-email';
select cron.schedule('alerta-onboarding-email', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/alerta-onboarding-email',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$$);
