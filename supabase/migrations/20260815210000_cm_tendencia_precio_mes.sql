-- Tendencia de precio en el tiempo por producto (grano mensual), pre-agregada
-- (materializada) para lecturas instantáneas, igual que el resto del módulo CM.
drop materialized view if exists public.mv_cm_producto_mes cascade;
create materialized view public.mv_cm_producto_mes as
  select public.mp_tipo_oc(oc.codigo)                    as tipo_origen,
         lower(btrim(i.producto))                        as producto_key,
         date_trunc('month', oc.fecha_emision)::date     as mes,
         count(*)                                        as ordenes,
         sum(coalesce(i.valor_total,0))                  as monto_total,
         avg(i.precio_unitario)                          as precio_prom,
         min(i.precio_unitario)                          as precio_min,
         max(i.precio_unitario)                          as precio_max
  from public.ordenes_compra_items i
  join public.ordenes_compra oc on oc.codigo = i.numero_oc
  where nullif(btrim(i.producto),'') is not null
    and oc.fecha_emision is not null
    and i.precio_unitario is not null
  group by 1, 2, 3;
create unique index ux_mv_cm_prod_mes on public.mv_cm_producto_mes (tipo_origen, producto_key, mes);
create index ix_mv_cm_prod_mes_key on public.mv_cm_producto_mes (producto_key);
revoke all on public.mv_cm_producto_mes from anon, authenticated;

-- Incluir la nueva MV en el refresco (cron cada 15 min).
create or replace function public.refrescar_cm_bi()
returns void language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view concurrently public.mv_cm_producto;
  refresh materialized view concurrently public.mv_cm_producto_proveedor;
  refresh materialized view concurrently public.mv_cm_producto_comprador;
  refresh materialized view concurrently public.mv_cm_producto_mes;
exception when others then
  refresh materialized view public.mv_cm_producto;
  refresh materialized view public.mv_cm_producto_proveedor;
  refresh materialized view public.mv_cm_producto_comprador;
  refresh materialized view public.mv_cm_producto_mes;
end;
$$;

-- RPC: serie temporal de precio de un producto.
create or replace function public.cm_producto_tendencia(
  p_producto_key text, p_tipo text default 'convenio_marco'
) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_agg(x order by x.mes) from (
      select mes, ordenes, monto_total,
             round(precio_prom)::bigint as precio_prom,
             precio_min, precio_max
      from public.mv_cm_producto_mes
      where producto_key = p_producto_key and (p_tipo is null or tipo_origen = p_tipo)
      order by mes
    ) x
  ), '[]'::jsonb);
$$;

grant execute on function public.cm_producto_tendencia(text,text) to authenticated;
