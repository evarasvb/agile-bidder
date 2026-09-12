-- enrich-oc-detalle usa ticket dedicado (no comparte cuota con otros robots): el cupo diario sube
-- de 6.000 a 9.000 llamadas (la API permite ~10.000 por ticket y día). Con ~20.000 OC nuevas al día
-- el detalle vía API no alcanza para todas: las relevantes van primero y el resto lo cubre la carga
-- mensual desde Datos Abiertos.
do $$
declare v_jobid int;
begin
  select jobid into v_jobid from cron.job where jobname = 'enrich-oc-detalle-cron';
  if v_jobid is not null then
    perform cron.alter_job(job_id := v_jobid, command := $cmd$
  SELECT net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/enrich-oc-detalle',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_jwt_legacy')),
    body := '{"limit":30,"tipo":"todos","presupuesto_ms":100000,"cupo_diario":9000}'::jsonb,
    timeout_milliseconds := 150000
  );
$cmd$);
  end if;
end $$;
