-- Codex (PR #342): con más de 500 clientes, el orden ascendente + limit 500
-- descartaba justo a los que se conectaron más recientemente (quedaban fuera
-- del corte), rompiendo el propósito de la vista ("quién usa el sistema").
-- Se sube el tope a un valor que en la práctica es "todos" para la escala de
-- este negocio, en vez de truncar por el extremo equivocado.
create or replace function public.admin_clientes_actividad(lim int default 20000)
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
  limit greatest(1, least(lim, 20000));
$$;
revoke execute on function public.admin_clientes_actividad(int) from public, anon;
grant execute on function public.admin_clientes_actividad(int) to authenticated;
