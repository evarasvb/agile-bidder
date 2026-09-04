-- Estas 3 RPC ya existen y funcionan en producción (usadas por el
-- PeriodoSelector de Proveedores/Compradores/Competidores), pero se habían
-- aplicado fuera del flujo de migraciones y no aparecían versionadas en el
-- repo (ver auditoría técnica: "drift de esquema"). Esta migración las deja
-- versionadas con exactamente la definición que ya corre en producción —
-- CREATE OR REPLACE es un no-op ahí, pero un entorno nuevo (staging, otro
-- desarrollador) ahora sí las tendría.

create or replace function public.bi_stats_rango(p_desde date default null::date, p_hasta date default null::date)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with base as (
    select coalesce(proveedor, proveedor_nombre) prov,
           coalesce(demandante, organismo_comprador) comp,
           coalesce(total, 0) monto
    from public.ordenes_compra
    where last_scraped_at is not null
      and coalesce(proveedor, proveedor_nombre) is not null
      and (p_desde is null or fecha_emision >= p_desde)
      and (p_hasta is null or fecha_emision <= p_hasta)
  )
  select jsonb_build_object(
    'proveedores', count(distinct prov),
    'compradores', count(distinct comp),
    'monto_total', coalesce(sum(monto), 0),
    'ordenes', count(*)
  ) from base;
$function$;

create or replace function public.bi_top_compradores_rango(termino text default ''::text, limite integer default 50, p_desde date default null::date, p_hasta date default null::date)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with base as (
    select coalesce(demandante, organismo_comprador) comprador,
           coalesce(total, 0) monto,
           coalesce(proveedor, proveedor_nombre) proveedor,
           fecha_emision
    from public.ordenes_compra
    where last_scraped_at is not null and coalesce(demandante, organismo_comprador) is not null
      and (p_desde is null or fecha_emision >= p_desde)
      and (p_hasta is null or fecha_emision <= p_hasta)
  ),
  agg as (
    select comprador, count(*) ordenes, sum(monto) monto_total,
           count(distinct proveedor) proveedores, max(fecha_emision) ultima
    from base group by comprador
  ),
  filt as (select * from agg where nullif(btrim(termino),'') is null or comprador ilike '%'||btrim(termino)||'%'),
  tot as (select coalesce(sum(monto_total),0) m from agg)
  select jsonb_build_object(
    'total_mercado', (select m from tot),
    'total', (select count(*) from filt),
    'items', coalesce((select jsonb_agg(x) from (
      select comprador, ordenes, monto_total, proveedores, ultima,
             round((monto_total / nullif((select m from tot),0) * 100)::numeric, 2) as share
      from filt order by monto_total desc nulls last
      limit greatest(1, least(coalesce(limite,50),200))
    ) x), '[]'::jsonb)
  );
$function$;

create or replace function public.bi_top_proveedores_rango(termino text default ''::text, limite integer default 50, p_desde date default null::date, p_hasta date default null::date)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with base as (
    select coalesce(proveedor, proveedor_nombre) proveedor,
           coalesce(total, 0) monto,
           coalesce(demandante, organismo_comprador) comprador,
           fecha_emision
    from public.ordenes_compra
    where last_scraped_at is not null and coalesce(proveedor, proveedor_nombre) is not null
      and (p_desde is null or fecha_emision >= p_desde)
      and (p_hasta is null or fecha_emision <= p_hasta)
  ),
  agg as (
    select proveedor, count(*) ordenes, sum(monto) monto_total,
           count(distinct comprador) compradores, max(fecha_emision) ultima
    from base group by proveedor
  ),
  filt as (select * from agg where nullif(btrim(termino),'') is null or proveedor ilike '%'||btrim(termino)||'%'),
  tot as (select coalesce(sum(monto_total),0) m from agg)
  select jsonb_build_object(
    'total_mercado', (select m from tot),
    'total', (select count(*) from filt),
    'items', coalesce((select jsonb_agg(x) from (
      select proveedor, ordenes, monto_total, compradores, ultima,
             round((monto_total / nullif((select m from tot),0) * 100)::numeric, 2) as share
      from filt order by monto_total desc nulls last
      limit greatest(1, least(coalesce(limite,50),200))
    ) x), '[]'::jsonb)
  );
$function$;

grant execute on function public.bi_stats_rango(date, date) to anon, authenticated;
grant execute on function public.bi_top_compradores_rango(text, integer, date, date) to anon, authenticated;
grant execute on function public.bi_top_proveedores_rango(text, integer, date, date) to anon, authenticated;
