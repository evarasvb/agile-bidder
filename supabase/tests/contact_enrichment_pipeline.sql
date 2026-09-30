begin;

do $test$
declare
  v_log_id uuid;
  v_run_id uuid;
  v_job_id uuid;
  v_job_status text;
  v_available_at timestamptz;
begin
  if public.contact_enrichment_http_outcome(200, false, null, 1, 5) <> 'succeeded' then
    raise exception 'HTTP 200 debe marcarse succeeded';
  end if;
  if public.contact_enrichment_http_outcome(503, false, null, 1, 5) <> 'retry' then
    raise exception 'HTTP 503 debe reintentarse';
  end if;
  if public.contact_enrichment_http_outcome(null, true, 'timeout', 1, 5) <> 'retry' then
    raise exception 'timeout debe reintentarse';
  end if;
  if public.contact_enrichment_http_outcome(503, false, null, 5, 5) <> 'failed' then
    raise exception 'el ultimo HTTP fallido debe generar alerta definitiva';
  end if;
  if public.contact_enrichment_retry_delay_seconds(1) <> 60
     or public.contact_enrichment_retry_delay_seconds(2) <> 120
     or public.contact_enrichment_retry_delay_seconds(3) <> 240 then
    raise exception 'backoff exponencial incorrecto';
  end if;

  insert into public.contact_enrichment_logs (proceso, estado)
  values ('test_pipeline', 'procesando') returning id into v_log_id;
  insert into public.contact_enrichment_runs (log_id, trigger_source, jobs_total)
  values (v_log_id, 'manual', 1) returning id into v_run_id;
  insert into public.contact_enrichment_jobs (run_id, source)
  values (v_run_id, 'profiles');

  begin
    insert into public.contact_enrichment_jobs (run_id, source)
    values (v_run_id, 'profiles');
    raise exception 'se permitio duplicar un trabajo de la misma fuente';
  exception
    when unique_violation then null;
  end;

  select job_id into v_job_id from public.contact_enrichment_claim_job();
  if v_job_id is null then raise exception 'worker no reclamo el trabajo'; end if;
  perform public.contact_enrichment_fail_job(v_job_id, 'fallo controlado');
  select status, available_at into v_job_status, v_available_at
  from public.contact_enrichment_jobs where id = v_job_id;
  if v_job_status <> 'retry' then raise exception 'fallo de lote no quedo reintentable'; end if;
  if v_available_at < now() + interval '50 seconds' then
    raise exception 'fallo de lote no respeto backoff';
  end if;

  begin
    insert into public.contact_enrichment_logs (proceso, estado)
    values ('test_pipeline_duplicate', 'procesando') returning id into v_log_id;
    insert into public.contact_enrichment_runs (log_id, trigger_source, jobs_total)
    values (v_log_id, 'manual', 1);
    raise exception 'se permitieron dos corridas activas';
  exception
    when unique_violation then null;
  end;
end
$test$;

rollback;
