-- Recálculo on-demand del match (tras cargar/editar inventario) corregido.
-- Antes generar_matches_ca_para_mi():
--   (P1) solo regeneraba ca_matches (nivel compra), NO ca_item_matches, que es
--        justo la tabla que leen el panel, el detalle y ahora la página de
--        Inventario → editar inventario no refrescaba lo que ve el cliente.
--   (P2) resolvía la empresa con user_id = auth.uid() directo, así que para un
--        usuario de EQUIPO (clientes.id != user_id) recalculaba el cliente
--        equivocado o cero. Las mutaciones de inventario ya usan cliente_owner_id().
--   (P2) los generadores son upsert-only: un producto que deja de calzar dejaba
--        su match viejo pegado indefinidamente (no se borraba).
-- Esta versión resuelve la empresa con cliente_owner_id(), reconcilia (borra los
-- matches del cliente y los regenera desde cero) y regenera AMBAS tablas.
create or replace function public.generar_matches_ca_para_mi()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cliente uuid;
  n integer;
begin
  v_cliente := public.cliente_owner_id();
  if v_cliente is null then
    return 0;
  end if;

  -- Reconciliar: sacar lo viejo del cliente para que no queden matches de
  -- productos que ya no calzan; luego regenerar (una sola transacción).
  delete from public.ca_matches where cliente_id = v_cliente;
  delete from public.ca_item_matches where cliente_id = v_cliente;

  n := public.generar_matches_ca(v_cliente);
  perform public.generar_matches_ca_items(v_cliente);
  return n;
end
$function$;

grant execute on function public.generar_matches_ca_para_mi() to authenticated;
