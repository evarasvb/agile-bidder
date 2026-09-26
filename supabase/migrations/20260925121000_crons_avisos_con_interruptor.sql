-- Re-programa los crons de avisos para que respeten el interruptor de
-- ajustes_avisos: solo disparan el correo si activo = true (o si no hay registro).
-- Incluye el nuevo aviso de documentos.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('alerta-cita-email'),
      ('alerta-registro-email'),
      ('alerta-onboarding-email'),
      ('alerta-drive-email'),
      ('alerta-documento-email')
    ) as t(clave)
  loop
    perform cron.unschedule(jobid) from cron.job where jobname = r.clave;
    perform cron.schedule(r.clave, '*/15 * * * *', format($fmt$
      select net.http_post(
        url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/%s',
        headers := jsonb_build_object('Content-Type','application/json',
          'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
        body := '{}'::jsonb, timeout_milliseconds := 60000)
      where coalesce((select activo from public.ajustes_avisos where clave = %L), true);
    $fmt$, r.clave, r.clave));
  end loop;
end $$;
