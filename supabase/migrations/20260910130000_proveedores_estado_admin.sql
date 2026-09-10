-- Página admin "Proveedores del Estado": inteligencia de quién le vende al Estado,
-- cuánto y a quién, agregada desde las órdenes de compra. Solo la ve el admin.
-- La vista se crea vacía y se puebla con REFRESH (runtime/cron): la agregación sobre
-- >1M órdenes excede el statement_timeout por defecto. Un cron semanal la mantiene al día.
create materialized view if not exists public.mv_proveedores_estado as
select
  rut_proveedor,
  max(proveedor_nombre) as proveedor_nombre,
  count(*)::int as n_ocs,
  count(*) filter (where fecha_emision >= '2026-01-01')::int as n_ocs_2026,
  sum(coalesce(total, monto_total, 0))::numeric as monto_total,
  sum(coalesce(total, monto_total, 0)) filter (where fecha_emision >= '2026-01-01')::numeric as monto_2026,
  max(fecha_emision) as ultima_fecha
from public.ordenes_compra
where rut_proveedor is not null and rut_proveedor <> ''
group by rut_proveedor
with no data;

create unique index if not exists uq_mv_prov_rut on public.mv_proveedores_estado(rut_proveedor);
create index if not exists idx_mv_prov_monto on public.mv_proveedores_estado(monto_2026 desc);

-- Solo el admin consulta esta data (RPC security-definer).
create or replace function public.proveedores_estado(q text default null, lim int default 50, off int default 0)
returns setof public.mv_proveedores_estado
language sql stable security definer set search_path = public as $$
  select * from public.mv_proveedores_estado
  where (auth.jwt() ->> 'email') = 'evaras@firmavb.cl'
    and (q is null or q = '' or proveedor_nombre ilike '%'||q||'%' or rut_proveedor ilike '%'||q||'%')
  order by monto_2026 desc nulls last
  limit greatest(1, least(lim, 200)) offset greatest(0, off);
$$;
grant execute on function public.proveedores_estado(text,int,int) to authenticated;

create or replace function public.proveedor_estado_detalle(p_rut text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when (auth.jwt() ->> 'email') = 'evaras@firmavb.cl' then jsonb_build_object(
    'rubros', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select rubro_n1 as rubro, count(*)::int as n, sum(monto_linea)::numeric as monto
        from oc_lineas where rut_proveedor = p_rut and rubro_n1 is not null
        group by rubro_n1 order by monto desc nulls last limit 10) x),
    'instituciones', (select coalesce(jsonb_agg(y), '[]'::jsonb) from (
        select organismo_comprador as institucion, count(*)::int as n, sum(coalesce(total, monto_total, 0))::numeric as monto
        from ordenes_compra where rut_proveedor = p_rut and organismo_comprador is not null
        group by organismo_comprador order by monto desc nulls last limit 10) y)
  ) else null end;
$$;
grant execute on function public.proveedor_estado_detalle(text) to authenticated;

-- Refresco semanal (lunes 12:00 UTC, tras la carga de datos abiertos).
-- (Se agenda en runtime con cron.schedule; documentado aquí para referencia.)
