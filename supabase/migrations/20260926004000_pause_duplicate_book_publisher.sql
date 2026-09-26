-- El job se creó manualmente para vigilar el token de Meta, pero versiones
-- antiguas de la función interpretaban la llamada como una publicación real.
-- El publicador diario oficial permanece activo; este job queda pausado hasta
-- desplegar y verificar el modo solo_chequear_token.
do $$
declare
  duplicate_job_id bigint;
begin
  select jobid into duplicate_job_id
  from cron.job
  where jobname = 'vigilar-token-meta'
  limit 1;

  if duplicate_job_id is not null then
    perform cron.alter_job(duplicate_job_id, active := false);
  end if;
end $$;

-- Las reseñas deben provenir de testimonios reales y autorizados. Se preservan
-- para revisión, pero el publicador no las seleccionará como pendientes.
update public.viral_agent_calendario
set estado = 'requiere_testimonio_verificado'
where estado = 'pendiente'
  and (
    pilar ilike '%prueba social%'
    or caption ~* '(ojalá lo hubiera leído|por fin alguien|recomendé a todo mi equipo|guía interna para las nuevas postulaciones)'
  );
