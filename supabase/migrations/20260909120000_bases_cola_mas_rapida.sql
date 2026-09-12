-- El robot de descarga (cada 2 min) encola bases más rápido de lo que el lector las lee (6 cada 3 min):
-- con el modelo lite cada lectura toma 10-30 s, así que caben 12 por pasada dentro del presupuesto de 330 s.
-- Las pasadas pueden solaparse; bases_intento_en evita leer dos veces el mismo archivo.
select cron.unschedule(jobid) from cron.job where jobname = 'licitacion-bases-pendientes';
select cron.schedule('licitacion-bases-pendientes', '1-59/3 * * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/licitacion-adjuntos',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{"bases":true,"limit":12}'::jsonb, timeout_milliseconds := 120000);
$$);
