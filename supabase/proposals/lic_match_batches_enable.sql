-- Apply only after installing lic_match_batches.sql and measuring a pilot.
-- Stop the old all-client transaction before enabling the bounded worker.
begin;
do $$ begin
  if exists (select 1 from cron.job j join cron.job_run_details d on d.jobid=j.jobid
    where j.jobname='match-lic-items-cliente-horario' and d.status='running') then
    raise exception 'Esperar a que termine el proceso anterior antes de activar lotes';
  end if;
end $$;
select cron.unschedule(jobid) from cron.job
  where jobname in ('match-lic-items-cliente-horario','match-lic-items-lotes');
select cron.schedule('match-lic-items-lotes','10 seconds',
  $job$ set statement_timeout='120s'; select firmavb_internal.procesar_lic_match_queue(10); $job$);
commit;
