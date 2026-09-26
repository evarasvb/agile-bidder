-- RPC para el módulo Convenio Marco: devuelve las órdenes de compra donde un
-- proveedor vendió productos que calzan con la marca (palabra clave). Usa la
-- MISMA fuente que la detección de proveedores (ordenes_compra_items +
-- ordenes_compra), por lo que los resultados calzan con lo que se muestra en la
-- pestaña "Detectar proveedores". SECURITY DEFINER porque las tablas de OC
-- tienen RLS; los datos de OC son de mercado (globales), no por cliente.
create or replace function public.cm_ordenes_proveedor(
  p_proveedor text,
  p_termino text default null,
  p_tipo text default 'convenio_marco',
  limite int default 50
) returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(x order by x.fecha desc nulls last), '[]'::jsonb)
  from (
    select oc.codigo as codigo,
           coalesce(oc.organismo_comprador, oc.demandante) as organismo,
           coalesce(oc.fecha_emision, oc.fecha_envio_oc) as fecha,
           i.producto as producto,
           i.cantidad as cantidad,
           i.precio_unitario as precio_unitario,
           i.valor_total as valor_total,
           oc.link_oficial as link,
           oc.rut_proveedor as rut_proveedor
    from public.ordenes_compra_items i
    join public.ordenes_compra oc on oc.codigo = i.numero_oc
    where coalesce(oc.proveedor, oc.proveedor_nombre) = p_proveedor
      and (p_termino is null or i.producto ilike '%' || p_termino || '%')
      and (p_tipo is null or public.mp_tipo_oc(oc.codigo) = p_tipo)
    order by coalesce(oc.fecha_emision, oc.fecha_envio_oc) desc nulls last
    limit greatest(limite, 1)
  ) x;
$$;

grant execute on function public.cm_ordenes_proveedor(text, text, text, int) to authenticated;
