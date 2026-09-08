-- enrich-oc-detalle ya usa un ticket dedicado de Mercado Público (bóveda: mercadopublico_ticket_oc),
-- así que no compite con los otros robots por la cuota del ticket general. Vuelve a cada 2 min / 30 OC
-- para vaciar la cola de cabeceras sin detalle en horas en vez de días; el cupo diario (6.000) sigue
-- siendo el freno real.
do $$
declare v_jobid int;
begin
  select jobid into v_jobid from cron.job where jobname = 'enrich-oc-detalle-cron';
  if v_jobid is not null then
    perform cron.alter_job(job_id := v_jobid, schedule := '*/2 * * * *', command := $cmd$
  SELECT net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/enrich-oc-detalle',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_jwt_legacy')),
    body := '{"limit":30,"tipo":"todos","presupuesto_ms":100000,"cupo_diario":6000}'::jsonb,
    timeout_milliseconds := 150000
  );
$cmd$);
  end if;
end $$;
