-- Pausa temporalmente el continuador que reintentaba cada dos minutos una
-- pieza en estado `ejecutando` y respondía 409 sin avanzar. La campaña y sus
-- envíos quedan intactos hasta desplegar una continuación con bloqueo atómico.
do $$
declare
  v_job_id bigint;
begin
  select jobid
  into v_job_id
  from cron.job
  where jobname = 'marketing-continuar-envios'
  limit 1;

  if v_job_id is not null then
    perform cron.alter_job(v_job_id, active := false);
  end if;
end
$$;
