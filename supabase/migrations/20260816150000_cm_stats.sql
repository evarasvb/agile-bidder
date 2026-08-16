-- Totales del módulo Convenio Marco por origen (para el header del explorador).
-- Lee las vistas materializadas -> instantáneo.
create or replace function public.cm_stats(p_tipo text default 'convenio_marco')
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'productos',   (select count(*) from public.mv_cm_producto where p_tipo is null or tipo_origen = p_tipo),
    'monto_total', (select coalesce(sum(monto_total),0) from public.mv_cm_producto where p_tipo is null or tipo_origen = p_tipo),
    'proveedores', (select count(distinct proveedor) from public.mv_cm_producto_proveedor where p_tipo is null or tipo_origen = p_tipo),
    'compradores', (select count(distinct comprador) from public.mv_cm_producto_comprador where p_tipo is null or tipo_origen = p_tipo)
  );
$$;
revoke all on function public.cm_stats(text) from public;
grant execute on function public.cm_stats(text) to authenticated;
