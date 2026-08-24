-- Resuelve la empresa DUEÑA (clientes.id) del usuario actual.
-- - Si el usuario es un miembro de equipo (vendedor activo), la empresa es la de
--   quien lo invitó (vendedores.invitado_por = clientes.user_id). Antes se usaba
--   la fila de `clientes` que useCliente() auto-crea para el miembro (vacía), así
--   que el miembro no veía matches y sus PDF salían con empresa placeholder.
-- - Si no es miembro, es dueño: su propia fila de `clientes`.
create or replace function public.cliente_owner_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (
      select c.id
      from public.vendedores v
      join public.clientes c on c.user_id = v.invitado_por
      where v.user_id = auth.uid()
        and v.activo is true
        and v.invitado_por is not null
      order by v.updated_at desc nulls last
      limit 1
    ),
    (
      select id from public.clientes
      where user_id = auth.uid()
      order by created_at asc
      limit 1
    )
  );
$function$;

grant execute on function public.cliente_owner_id() to authenticated, anon;
