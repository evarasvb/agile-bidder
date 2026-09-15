-- La variable plpgsql "periodo" chocaba con la columna "periodo" de
-- vendedor_indicadores en ON CONFLICT ("column reference periodo is
-- ambiguous"): el cron indicadores-vendedores (jobid 34, 07:30 UTC) fallaba
-- todos los días y quedó desactivado. Se renombra la variable y se reactiva.
create or replace function public.recalcular_indicadores_vendedores(p_periodo text default null)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_periodo text := coalesce(p_periodo, to_char(now(), 'YYYY-MM'));
  afectadas integer;
begin
  with base as (
    select a.vendedor_id,
      count(*) as asignadas,
      count(*) filter (where a.estado in ('postulada','adjudicada','no_adjudicada')) as postuladas,
      count(*) filter (where a.estado = 'adjudicada') as adjudicadas,
      count(*) filter (where a.estado = 'no_adjudicada') as no_adjudicadas,
      coalesce(sum(a.monto_estimado) filter (where a.estado = 'adjudicada'), 0) as monto
    from public.vendedor_asignaciones a
    where to_char(a.fecha_asignacion, 'YYYY-MM') = v_periodo and a.vendedor_id is not null
    group by a.vendedor_id
  )
  insert into public.vendedor_indicadores
    (vendedor_id, periodo, total_asignadas, total_postuladas, total_adjudicadas,
     total_no_adjudicadas, monto_adjudicado, tasa_adjudicacion, tasa_postulacion, updated_at)
  select b.vendedor_id, v_periodo, b.asignadas, b.postuladas, b.adjudicadas, b.no_adjudicadas, b.monto,
    case when b.postuladas > 0 then round(100.0 * b.adjudicadas / b.postuladas, 2) else 0 end,
    case when b.asignadas  > 0 then round(100.0 * b.postuladas  / b.asignadas,  2) else 0 end,
    now()
  from base b
  on conflict (vendedor_id, periodo) do update set
    total_asignadas = excluded.total_asignadas,
    total_postuladas = excluded.total_postuladas,
    total_adjudicadas = excluded.total_adjudicadas,
    total_no_adjudicadas = excluded.total_no_adjudicadas,
    monto_adjudicado = excluded.monto_adjudicado,
    tasa_adjudicacion = excluded.tasa_adjudicacion,
    tasa_postulacion = excluded.tasa_postulacion,
    updated_at = now();

  get diagnostics afectadas = row_count;
  return afectadas;
end;
$function$;

revoke execute on function public.recalcular_indicadores_vendedores(text) from public, anon, authenticated;

-- Reactivar el cron (quedó inactivo por los fallos diarios).
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'indicadores-vendedores';
  if v_jobid is not null then
    perform cron.alter_job(v_jobid, active => true);
  end if;
end $$;
