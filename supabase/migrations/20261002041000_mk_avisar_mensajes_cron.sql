-- Cron que llama a la edge function mk-avisar-mensajes-email cada 10
-- minutos: junta los mensajes del chat del Market de proveedores que nadie
-- contestó, manda un correo por destinatario y los marca avisados. Mismo
-- patrón que alerta-registro-email/alerta-documento-email.
select cron.schedule('mk-avisar-mensajes-email', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/mk-avisar-mensajes-email',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$$);
