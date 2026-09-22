-- Actividad de TODOS los clientes (no solo los nuevos): para saber quién usa
-- el sistema y quién no. Mismo patrón/seguridad que admin_clientes_nuevos,
-- pero sin filtro de fecha de registro y ordenado por última conexión (los
-- que nunca se conectaron o llevan más tiempo sin entrar, primero).
create or replace function public.admin_clientes_actividad(lim int default 300)
returns table (
  id uuid, empresa_nombre text, email text, created_at timestamptz,
  plan text, industrias text[], palabras_clave_busqueda text[],
  items_inventario int, ofertas int, last_sign_in_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select c.id, c.empresa_nombre, c.email, c.created_at, c.plan,
    c.industrias, c.palabras_clave_busqueda,
    (select count(*)::int from cliente_inventario ci where ci.cliente_id = c.id) as items_inventario,
    (select count(*)::int from cliente_ofertas co where co.cliente_id = c.id) as ofertas,
    u.last_sign_in_at
  from clientes c
  left join auth.users u on u.id = c.user_id
  where (auth.jwt() ->> 'email') = 'evaras@firmavb.cl'
  order by u.last_sign_in_at asc nulls first
  limit greatest(1, least(lim, 1000));
$$;
revoke execute on function public.admin_clientes_actividad(int) from public, anon;
grant execute on function public.admin_clientes_actividad(int) to authenticated;
