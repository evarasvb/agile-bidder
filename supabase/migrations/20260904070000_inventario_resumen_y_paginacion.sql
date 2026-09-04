-- Inventario en servidor: la pantalla pide una página a la vez (antes bajaba
-- las 16.000 filas al navegador en 17 tandas) y los contadores salen de una
-- sola consulta.
create index if not exists idx_cliente_inventario_cliente_created
  on public.cliente_inventario (cliente_id, created_at desc);

create or replace function public.cliente_inventario_resumen()
returns json
language sql stable security invoker
set search_path = public
as $$
  select json_build_object(
    'total', count(*),
    'activos', count(*),
    'sin_stock', count(*) filter (where coalesce(stock_disponible, 0) = 0),
    'stock_bajo', count(*) filter (where stock_disponible > 0 and stock_disponible < 50),
    'incompletos', count(*) filter (where coalesce(descripcion, '') = '' or coalesce(imagen_url, '') = ''),
    'valor', coalesce(sum(coalesce(precio_unitario, 0) * coalesce(stock_disponible, 0)), 0),
    'categorias', coalesce((select json_agg(distinct categoria) from cliente_inventario i2
       where i2.categoria is not null and (i2.cliente_id = public.cliente_owner_id() or i2.cliente_id = auth.uid())), '[]'::json)
  )
  from cliente_inventario i
  where i.cliente_id = public.cliente_owner_id() or i.cliente_id = auth.uid();
$$;
revoke all on function public.cliente_inventario_resumen() from public, anon;
grant execute on function public.cliente_inventario_resumen() to authenticated;
