-- Reactivar el match global de licitaciones.
-- El cron match-lic-horario (job 21, generar_matches_lic_bg -> generar_matches_lic_pendientes
-- 500 por corrida) estaba INACTIVO desde el 24-08-2026: 3.767 licitaciones abiertas quedaron
-- sin match_score y el panel no podía mostrarles % de match (15-09-2026). Se reactiva y pasa
-- a cada 20 min (1.500/hora); una corrida de 500 tarda unos 30 s. El atraso se limpió a mano
-- con corridas de 1.000 el mismo día.
do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'match-lic-horario';
  if v_jobid is null then
    perform cron.schedule('match-lic-horario', '17,37,57 * * * *', 'select public.generar_matches_lic_bg();');
  else
    perform cron.alter_job(v_jobid, schedule := '17,37,57 * * * *', active := true);
  end if;
end $$;
