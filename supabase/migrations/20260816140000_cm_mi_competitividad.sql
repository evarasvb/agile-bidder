-- "Mi competitividad": cruza el inventario del cliente autenticado con los
-- productos del mercado (match por word_similarity + unaccent) y calcula su
-- posición de precio vs. el ganador. Devuelve el producto de mercado emparejado
-- y el % de coincidencia para que el usuario lo valide en la UI.
create or replace function public.cm_mi_competitividad(
  p_tipo text default 'convenio_marco', umbral real default 0.6
) returns jsonb
language sql stable security definer set search_path = public as $$
  with cli as (
    select id from public.clientes where user_id = auth.uid() limit 1
  ),
  inv as (
    select coalesce(nombre_producto, nombre) as nombre, precio_unitario
    from public.cliente_inventario
    where cliente_id = (select id from cli)
      and coalesce(nombre_producto, nombre) is not null
      and precio_unitario is not null and precio_unitario > 0
  ),
  matched as (
    select i.nombre as mi_producto, i.precio_unitario as mi_precio,
           m.producto as producto_cm, m.producto_key,
           m.precio_min as precio_ganador, m.precio_prom, m.proveedores, m.wsim
    from inv i
    cross join lateral (
      select producto, producto_key, precio_min, precio_prom, proveedores,
             word_similarity(unaccent(lower(i.nombre)), unaccent(lower(producto))) as wsim
      from public.mv_cm_producto
      where tipo_origen = coalesce(p_tipo, tipo_origen)
      order by word_similarity(unaccent(lower(i.nombre)), unaccent(lower(producto))) desc
      limit 1
    ) m
    where m.wsim >= umbral
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.diff_pct desc nulls last), '[]'::jsonb)
  from (
    select mi_producto, mi_precio, producto_cm, producto_key,
           precio_ganador, round(precio_prom)::bigint as precio_prom, proveedores,
           round(wsim::numeric, 2) as similitud,
           case when precio_ganador is not null and precio_ganador > 0
                then round(((mi_precio - precio_ganador) / precio_ganador * 100)::numeric, 1)
           end as diff_pct
    from matched
  ) x;
$$;

revoke all on function public.cm_mi_competitividad(text, real) from public;
grant execute on function public.cm_mi_competitividad(text, real) to authenticated;
