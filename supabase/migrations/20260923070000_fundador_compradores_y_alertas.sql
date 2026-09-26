-- 1) Compradores de cursos (Academia): academia_pagos hoy es solo service_role.
-- El FUNDADOR necesita verlos para gestionar el negocio. Damos lectura solo a su
-- correo (mismo criterio que AdminOnlyRoute en el front), no a cualquier cliente,
-- porque la tabla trae correos y datos de pago.
drop policy if exists academia_pagos_select_fundador on public.academia_pagos;
create policy academia_pagos_select_fundador on public.academia_pagos
  for select to authenticated
  using ((select auth.jwt() ->> 'email') = 'evaras@firmavb.cl');

-- 2) Aviso automático de instituciones seguidas: cron diario que llama a la edge
-- function alertas-instituciones-seguidas (09:00 hora Chile ≈ 12:00 UTC).
select cron.unschedule(jobid) from cron.job where jobname = 'alertas-instituciones-seguidas';
select cron.schedule('alertas-instituciones-seguidas', '0 12 * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/alertas-instituciones-seguidas',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);
