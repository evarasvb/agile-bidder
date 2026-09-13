-- Dashboard del cliente: todas las oportunidades y matches deben pertenecer a
-- la empresa resuelta por cliente_owner_id(). Antes estas RPC y los hooks del
-- frontend agregaban las tablas globales de MercadoPublico, por lo que un
-- cliente podia ver cifras y match_score calculados para otras empresas.

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
  with cliente as (
    select public.cliente_owner_id() as id
  ),
  matches as (
    select 'compra_agil'::text as tipo, m.compra_agil_codigo as codigo,
           max(m.score) as score
      from public.ca_item_matches m, cliente c
     where m.cliente_id = c.id
     group by m.compra_agil_codigo
    union all
    select 'licitacion'::text, m.licitacion_codigo, max(m.score)
      from public.lic_item_matches m, cliente c
     where m.cliente_id = c.id
     group by m.licitacion_codigo
  ),
  activas as (
    select m.tipo, m.codigo, m.score, ca.monto_estimado as monto
      from matches m
      join public.compras_agiles ca
        on m.tipo = 'compra_agil' and ca.codigo = m.codigo
     where ca.fecha_cierre > now()
       and coalesce(lower(ca.estado), '') not in ('adjudicada','desierta','descartada')
    union all
    select m.tipo, m.codigo, m.score, l.presupuesto_estimado
      from matches m
      join public.licitaciones_bi l
        on m.tipo = 'licitacion' and l.codigo = m.codigo
     where l.fecha_cierre > now()
       and coalesce(lower(l.estado), '') not in ('adjudicada','desierta','descartada')
  ),
  resultados as (
    select count(*) filter (where p.etapa::text in ('adjudicada','oc_emitida','pagada')) as ganadas,
           count(*) filter (where p.etapa::text in ('postulada','evaluacion','adjudicada','oc_emitida','pagada','perdida')) as postuladas
      from public.pipeline p
     where p.user_id = (select auth.uid())
  )
  select
    (select count(*) from activas),
    coalesce((select round(avg(score)) from activas), 0),
    coalesce((select sum(monto_estimado) from public.pipeline
              where user_id = (select auth.uid())
                and etapa::text in ('preparacion','postulada','evaluacion')), 0),
    coalesce((select round(100.0 * ganadas / nullif(postuladas, 0)) from resultados), 0);
$$;

create or replace function public.dashboard_pipeline_por_estado()
returns table(estado text, cantidad bigint, monto numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select p.etapa::text as estado,
         count(*)::bigint as cantidad,
         coalesce(sum(p.monto_estimado), 0) as monto
    from public.pipeline p
   where p.user_id = (select auth.uid())
   group by p.etapa;
$$;

create or replace function public.dashboard_oportunidades_por_tipo_cliente()
returns table(tipo text, cantidad bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with cliente as (select public.cliente_owner_id() as id)
  select 'compra_agil'::text,
         count(distinct m.compra_agil_codigo)::bigint
    from public.ca_item_matches m
    join public.compras_agiles ca on ca.codigo = m.compra_agil_codigo
   where m.cliente_id = (select id from cliente)
     and ca.fecha_cierre > now()
     and coalesce(lower(ca.estado), '') not in ('adjudicada','desierta','descartada')
  union all
  select 'licitacion'::text,
         count(distinct m.licitacion_codigo)::bigint
    from public.lic_item_matches m
    join public.licitaciones_bi l on l.codigo = m.licitacion_codigo
   where m.cliente_id = (select id from cliente)
     and l.fecha_cierre > now()
     and coalesce(lower(l.estado), '') not in ('adjudicada','desierta','descartada');
$$;

create or replace function public.dashboard_cierres_cliente(p_limite integer default 10)
returns table(
  codigo text,
  nombre text,
  institucion text,
  fecha_cierre timestamptz,
  match_score numeric,
  etapa text,
  tipo text
)
language sql
stable
security invoker
set search_path = public
as $$
  with cliente as (select public.cliente_owner_id() as id),
  ca_match as (
    select m.compra_agil_codigo, max(m.score) as score
      from public.ca_item_matches m
     where m.cliente_id = (select id from cliente)
     group by m.compra_agil_codigo
  ),
  lic_match as (
    select m.licitacion_codigo, max(m.score) as score
      from public.lic_item_matches m
     where m.cliente_id = (select id from cliente)
     group by m.licitacion_codigo
  ),
  cierres as (
    select ca.codigo, ca.nombre, coalesce(ca.nombre_organismo, 'Sin organismo') as institucion,
           ca.fecha_cierre, m.score, coalesce(ca.estado, 'Publicada') as etapa,
           'Compra Ágil'::text as tipo
      from ca_match m
      join public.compras_agiles ca on ca.codigo = m.compra_agil_codigo
     where ca.fecha_cierre between now() and now() + interval '7 days'
    union all
    select l.codigo, l.nombre, coalesce(l.institucion_nombre, 'Sin organismo'),
           l.fecha_cierre, m.score, coalesce(l.estado, 'Publicada'), 'Licitación'::text
      from lic_match m
      join public.licitaciones_bi l on l.codigo = m.licitacion_codigo
     where l.fecha_cierre between now() and now() + interval '7 days'
  )
  select c.codigo, c.nombre, c.institucion, c.fecha_cierre,
         c.score as match_score, c.etapa, c.tipo
    from cierres c
   order by c.fecha_cierre asc
   limit greatest(1, least(coalesce(p_limite, 10), 50));
$$;

create or replace function public.dashboard_ultimos_matches_cliente(p_limite integer default 8)
returns table(
  codigo text,
  nombre text,
  institucion text,
  match_score numeric,
  tipo text,
  fecha timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with cliente as (select public.cliente_owner_id() as id),
  ca_match as (
    select m.compra_agil_codigo, max(m.score) as score, max(m.updated_at) as fecha
      from public.ca_item_matches m
     where m.cliente_id = (select id from cliente)
     group by m.compra_agil_codigo
  ),
  lic_match as (
    select m.licitacion_codigo, max(m.score) as score, max(m.updated_at) as fecha
      from public.lic_item_matches m
     where m.cliente_id = (select id from cliente)
     group by m.licitacion_codigo
  ),
  matches as (
    select ca.codigo, ca.nombre, coalesce(ca.nombre_organismo, 'Sin organismo') as institucion,
           m.score, 'Compra Ágil'::text as tipo, m.fecha
      from ca_match m
      join public.compras_agiles ca on ca.codigo = m.compra_agil_codigo
     where ca.fecha_cierre > now()
    union all
    select l.codigo, l.nombre, coalesce(l.institucion_nombre, 'Sin organismo'),
           m.score, 'Licitación'::text, m.fecha
      from lic_match m
      join public.licitaciones_bi l on l.codigo = m.licitacion_codigo
     where l.fecha_cierre > now()
  )
  select m.codigo, m.nombre, m.institucion, m.score as match_score, m.tipo, m.fecha
    from matches m
   where m.score >= 40
   order by m.fecha desc
   limit greatest(1, least(coalesce(p_limite, 8), 50));
$$;

revoke all on function public.dashboard_kpis() from public;
revoke all on function public.dashboard_pipeline_por_estado() from public;
revoke all on function public.dashboard_oportunidades_por_tipo_cliente() from public;
revoke all on function public.dashboard_cierres_cliente(integer) from public;
revoke all on function public.dashboard_ultimos_matches_cliente(integer) from public;

grant execute on function public.dashboard_kpis() to authenticated;
grant execute on function public.dashboard_pipeline_por_estado() to authenticated;
grant execute on function public.dashboard_oportunidades_por_tipo_cliente() to authenticated;
grant execute on function public.dashboard_cierres_cliente(integer) to authenticated;
grant execute on function public.dashboard_ultimos_matches_cliente(integer) to authenticated;
