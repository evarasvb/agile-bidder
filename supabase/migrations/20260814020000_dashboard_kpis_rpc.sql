-- PERFORMANCE del Dashboard: los hooks bajaban TODAS las filas de compras_agiles
-- (~77k) y licitaciones (~92k) al navegador cada 30s sólo para contar/sumar. Se
-- reemplaza por agregaciones en la BD (una sola llamada, sin transferir filas).
-- Además se lee `licitaciones_bi` (tabla fresca) en vez de `licitaciones` (muerta),
-- consistente con el panel de oportunidades.

-- KPIs del dashboard en una sola llamada.
create or replace function public.dashboard_kpis()
returns table(
  oportunidades_activas bigint,
  match_score_promedio numeric,
  monto_en_pipeline numeric,
  tasa_exito numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with opp as (
    select estado, match_encontrado, match_score, monto_estimado as monto, fecha_cierre
    from public.compras_agiles
    union all
    select estado, match_encontrado, match_score, presupuesto_estimado as monto, fecha_cierre
    from public.licitaciones_bi
  ),
  act as (
    select * from opp
    where fecha_cierre > now()
      and coalesce(lower(estado), '') not in ('adjudicada', 'desierta', 'descartada')
  )
  select
    (select count(*) from act),
    coalesce((select round(avg(match_score)) from opp
              where match_encontrado is true and match_score is not null), 0),
    coalesce((select sum(monto) from act), 0),
    coalesce((
      select round(100.0 * count(*) filter (where estado = 'ganada')
             / nullif(count(*) filter (where estado in ('enviada','ganada','perdida')), 0))
      from public.ofertas
    ), 0);
$$;

-- Pipeline agrupado por estado (para el gráfico), agregado en la BD.
create or replace function public.dashboard_pipeline_por_estado()
returns table(estado text, cantidad bigint, monto numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(lower(estado), 'sin_estado') as estado,
         count(*)::bigint as cantidad,
         coalesce(sum(monto), 0) as monto
  from (
    select estado, monto_estimado as monto from public.compras_agiles
    union all
    select estado, presupuesto_estimado as monto from public.licitaciones_bi
  ) x
  group by 1;
$$;
