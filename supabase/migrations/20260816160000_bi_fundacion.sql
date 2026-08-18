-- ============================================================================
-- Fundación del Power BI: agregados de proveedores y compradores desde la data
-- rica de ordenes_compra (ya enriquecida por enrich-oc-detalle). Vistas
-- materializadas indexadas + RPCs -> lecturas instantáneas. Revive los reportes
-- de Proveedores / Competidores / Compradores que antes leían tablas vacías.
-- ============================================================================

create index if not exists ix_oc_proveedor  on public.ordenes_compra (proveedor)  where proveedor is not null;
create index if not exists ix_oc_demandante on public.ordenes_compra (demandante) where demandante is not null;
create index if not exists ix_oci_numero_oc on public.ordenes_compra_items (numero_oc);

drop materialized view if exists public.mv_bi_proveedor cascade;
create materialized view public.mv_bi_proveedor as
  select coalesce(proveedor, proveedor_nombre) as proveedor,
         count(*) as ordenes, sum(coalesce(total,0)) as monto_total,
         count(distinct coalesce(demandante, organismo_comprador)) as compradores,
         max(fecha_emision) as ultima
  from public.ordenes_compra
  where last_scraped_at is not null and coalesce(proveedor, proveedor_nombre) is not null
  group by 1;
create unique index ux_mv_bi_proveedor on public.mv_bi_proveedor (proveedor);
create index ix_mv_bi_proveedor_monto on public.mv_bi_proveedor (monto_total desc);
create index ix_mv_bi_proveedor_trgm on public.mv_bi_proveedor using gin (proveedor gin_trgm_ops);

drop materialized view if exists public.mv_bi_comprador cascade;
create materialized view public.mv_bi_comprador as
  select coalesce(demandante, organismo_comprador) as comprador,
         count(*) as ordenes, sum(coalesce(total,0)) as monto_total,
         count(distinct coalesce(proveedor, proveedor_nombre)) as proveedores,
         max(fecha_emision) as ultima
  from public.ordenes_compra
  where last_scraped_at is not null and coalesce(demandante, organismo_comprador) is not null
  group by 1;
create unique index ux_mv_bi_comprador on public.mv_bi_comprador (comprador);
create index ix_mv_bi_comprador_monto on public.mv_bi_comprador (monto_total desc);
create index ix_mv_bi_comprador_trgm on public.mv_bi_comprador using gin (comprador gin_trgm_ops);

revoke all on public.mv_bi_proveedor, public.mv_bi_comprador from anon, authenticated;

-- Refresco (sumadas al cron cada 15 min).
create or replace function public.refrescar_cm_bi()
returns void language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view concurrently public.mv_cm_producto;
  refresh materialized view concurrently public.mv_cm_producto_proveedor;
  refresh materialized view concurrently public.mv_cm_producto_comprador;
  refresh materialized view concurrently public.mv_cm_producto_mes;
  refresh materialized view concurrently public.mv_bi_proveedor;
  refresh materialized view concurrently public.mv_bi_comprador;
exception when others then
  refresh materialized view public.mv_cm_producto;
  refresh materialized view public.mv_cm_producto_proveedor;
  refresh materialized view public.mv_cm_producto_comprador;
  refresh materialized view public.mv_cm_producto_mes;
  refresh materialized view public.mv_bi_proveedor;
  refresh materialized view public.mv_bi_comprador;
end;
$$;

-- Totales del mercado.
create or replace function public.bi_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'proveedores', (select count(*) from public.mv_bi_proveedor),
    'compradores', (select count(*) from public.mv_bi_comprador),
    'monto_total', (select coalesce(sum(monto_total),0) from public.mv_bi_proveedor),
    'ordenes',     (select coalesce(sum(ordenes),0) from public.mv_bi_proveedor)
  );
$$;

create or replace function public.bi_top_proveedores(termino text default '', limite int default 50)
returns jsonb language sql stable security definer set search_path = public as $$
  with tot as (select coalesce(sum(monto_total),0) m from public.mv_bi_proveedor),
  base as (select * from public.mv_bi_proveedor
           where nullif(btrim(termino),'') is null or proveedor ilike '%'||btrim(termino)||'%')
  select jsonb_build_object('total_mercado',(select m from tot),'total',(select count(*) from base),
    'items', coalesce((select jsonb_agg(x) from (
      select proveedor, ordenes, monto_total, compradores, ultima,
             round((monto_total / nullif((select m from tot),0) * 100)::numeric,2) as share
      from base order by monto_total desc nulls last limit greatest(1,least(coalesce(limite,50),200))
    ) x),'[]'::jsonb));
$$;

create or replace function public.bi_top_compradores(termino text default '', limite int default 50)
returns jsonb language sql stable security definer set search_path = public as $$
  with tot as (select coalesce(sum(monto_total),0) m from public.mv_bi_comprador),
  base as (select * from public.mv_bi_comprador
           where nullif(btrim(termino),'') is null or comprador ilike '%'||btrim(termino)||'%')
  select jsonb_build_object('total_mercado',(select m from tot),'total',(select count(*) from base),
    'items', coalesce((select jsonb_agg(x) from (
      select comprador, ordenes, monto_total, proveedores, ultima,
             round((monto_total / nullif((select m from tot),0) * 100)::numeric,2) as share
      from base order by monto_total desc nulls last limit greatest(1,least(coalesce(limite,50),200))
    ) x),'[]'::jsonb));
$$;

-- Detalle (OJO: el parámetro NO puede llamarse 'nombre': ordenes_compra tiene
-- una columna 'nombre' que lo sombrearía. Usar p_nombre.)
create or replace function public.bi_proveedor_detalle(p_nombre text, limite int default 12)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'productos', coalesce((select jsonb_agg(x) from (
      select i.producto, count(*) as lineas, sum(coalesce(i.valor_total,0)) as monto, round(avg(i.precio_unitario)) as precio_prom
      from public.ordenes_compra oc join public.ordenes_compra_items i on i.numero_oc = oc.codigo
      where coalesce(oc.proveedor, oc.proveedor_nombre) = p_nombre and i.producto is not null
      group by i.producto order by monto desc nulls last limit limite) x), '[]'::jsonb),
    'compradores', coalesce((select jsonb_agg(x) from (
      select coalesce(oc.demandante, oc.organismo_comprador) as comprador, count(*) as ordenes, sum(coalesce(oc.total,0)) as monto
      from public.ordenes_compra oc
      where coalesce(oc.proveedor, oc.proveedor_nombre) = p_nombre and coalesce(oc.demandante, oc.organismo_comprador) is not null
      group by 1 order by monto desc nulls last limit limite) x), '[]'::jsonb));
$$;

create or replace function public.bi_comprador_detalle(p_nombre text, limite int default 12)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'productos', coalesce((select jsonb_agg(x) from (
      select i.producto, count(*) as lineas, sum(coalesce(i.valor_total,0)) as monto, round(avg(i.precio_unitario)) as precio_prom
      from public.ordenes_compra oc join public.ordenes_compra_items i on i.numero_oc = oc.codigo
      where coalesce(oc.demandante, oc.organismo_comprador) = p_nombre and i.producto is not null
      group by i.producto order by monto desc nulls last limit limite) x), '[]'::jsonb),
    'proveedores', coalesce((select jsonb_agg(x) from (
      select coalesce(oc.proveedor, oc.proveedor_nombre) as proveedor, count(*) as ordenes, sum(coalesce(oc.total,0)) as monto
      from public.ordenes_compra oc
      where coalesce(oc.demandante, oc.organismo_comprador) = p_nombre and coalesce(oc.proveedor, oc.proveedor_nombre) is not null
      group by 1 order by monto desc nulls last limit limite) x), '[]'::jsonb));
$$;

revoke all on function public.bi_stats() from public;
revoke all on function public.bi_top_proveedores(text,int) from public;
revoke all on function public.bi_top_compradores(text,int) from public;
revoke all on function public.bi_proveedor_detalle(text,int) from public;
revoke all on function public.bi_comprador_detalle(text,int) from public;
grant execute on function public.bi_stats() to authenticated;
grant execute on function public.bi_top_proveedores(text,int) to authenticated;
grant execute on function public.bi_top_compradores(text,int) to authenticated;
grant execute on function public.bi_proveedor_detalle(text,int) to authenticated;
grant execute on function public.bi_comprador_detalle(text,int) to authenticated;
