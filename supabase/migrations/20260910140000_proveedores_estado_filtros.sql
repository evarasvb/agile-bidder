-- Filtros por rubro e institución para la página admin "Proveedores del Estado".
-- Dos vistas auxiliares de pares (proveedor×rubro, proveedor×institución) para filtrar
-- rápido, y la función de búsqueda ampliada. Se pueblan por REFRESH (runtime/cron semanal).
create extension if not exists pg_trgm;

-- Se pueblan al crearse (en un entorno nuevo las tablas base están vacías → instantáneo).
-- En producción ya existen pobladas, así que `if not exists` las deja intactas. Un cron
-- semanal las refresca junto con mv_proveedores_estado.
create materialized view if not exists public.mv_prov_rubro as
select distinct rut_proveedor, rubro_n1
from public.oc_lineas
where rut_proveedor is not null and rut_proveedor <> '' and rubro_n1 is not null and rubro_n1 <> '';
create index if not exists idx_prov_rubro_rubro on public.mv_prov_rubro(rubro_n1);
create index if not exists idx_prov_rubro_rut on public.mv_prov_rubro(rut_proveedor);

create materialized view if not exists public.mv_prov_institucion as
select distinct rut_proveedor, organismo_comprador
from public.ordenes_compra
where rut_proveedor is not null and rut_proveedor <> '' and organismo_comprador is not null and organismo_comprador <> '';
create index if not exists idx_prov_inst_rut on public.mv_prov_institucion(rut_proveedor);
create index if not exists idx_prov_inst_org_trgm on public.mv_prov_institucion using gin (organismo_comprador gin_trgm_ops);

drop function if exists public.proveedores_estado(text,int,int);
create or replace function public.proveedores_estado(
  q text default null, rubro text default null, institucion text default null, lim int default 50, off int default 0)
returns setof public.mv_proveedores_estado
language sql stable security definer set search_path = public as $$
  select p.* from public.mv_proveedores_estado p
  where (auth.jwt() ->> 'email') = 'evaras@firmavb.cl'
    and (q is null or q = '' or p.proveedor_nombre ilike '%'||q||'%' or p.rut_proveedor ilike '%'||q||'%')
    and (rubro is null or rubro = '' or exists (
      select 1 from public.mv_prov_rubro r where r.rut_proveedor = p.rut_proveedor and r.rubro_n1 = rubro))
    and (institucion is null or institucion = '' or exists (
      select 1 from public.mv_prov_institucion i where i.rut_proveedor = p.rut_proveedor and i.organismo_comprador ilike '%'||institucion||'%'))
  order by p.monto_2026 desc nulls last
  limit greatest(1, least(lim, 200)) offset greatest(0, off);
$$;
grant execute on function public.proveedores_estado(text,text,text,int,int) to authenticated;

create or replace function public.rubros_estado()
returns table(rubro text)
language sql stable security definer set search_path = public as $$
  select r from (select distinct rubro_n1 as r from public.mv_prov_rubro) s
  where (auth.jwt() ->> 'email') = 'evaras@firmavb.cl'
  order by r;
$$;
grant execute on function public.rubros_estado() to authenticated;
