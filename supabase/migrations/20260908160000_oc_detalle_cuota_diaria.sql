-- enrich-oc-detalle: el ticket de Mercado Público tiene cuota diaria compartida entre robots
-- (a las 13:40 UTC del 08-09 respondió "Ticket superó la cuota diaria asignada"). El enriquecedor
-- pasa de cada 2 min / 60 OC a cada 5 min / 30 OC y con cupo propio de 6.000 llamadas por día
-- (se reparte a lo largo del día y deja margen a los demás robots que usan el ticket).
do $$
declare v_jobid int;
begin
  select jobid into v_jobid from cron.job where jobname = 'enrich-oc-detalle-cron';
  if v_jobid is not null then
    perform cron.alter_job(job_id := v_jobid, schedule := '*/5 * * * *', command := $cmd$
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
