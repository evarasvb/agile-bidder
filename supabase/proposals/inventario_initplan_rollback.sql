-- LOCAL PROPOSED ROLLBACK: restores exact original inventory policies and RPC.
-- Requires review before any external application.
begin;
alter policy inv_select_owner on public.cliente_inventario using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo_operativo());
alter policy inv_insert_owner on public.cliente_inventario with check (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo_operativo());
alter policy inv_update_owner on public.cliente_inventario using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo_operativo()) with check (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo_operativo());
alter policy inv_delete_owner on public.cliente_inventario using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo_operativo());
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

commit;
