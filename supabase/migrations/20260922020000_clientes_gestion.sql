-- Gestión comercial de clientes (mismo espíritu que instituciones_gestion):
-- pipeline, prioridad, notas y próxima acción para que Tracción deje de ser
-- solo lectura y sirva para GESTIONAR a quién contactar y qué sigue.
-- Sin políticas para "authenticated": se accede solo vía RPC security-definer
-- (mismo patrón ya probado en admin_clientes_actividad), porque clientes solo
-- tiene RLS de "dueño de su propia fila" y el admin necesita ver/editar todas.
create table if not exists public.clientes_gestion (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  estado text not null default 'nuevo' check (estado in ('nuevo','contactado','en_seguimiento','activo','en_riesgo','perdido')),
  prioridad int not null default 0 check (prioridad between 0 and 3), -- 0 normal, 1 baja, 2 media, 3 alta
  notas text,
  proxima_accion text,
  proxima_fecha timestamptz,
  etiquetas text[],
  actualizado_en timestamptz not null default now()
);
alter table public.clientes_gestion enable row level security;

drop function if exists public.admin_clientes_actividad(int);

create function public.admin_clientes_actividad(lim int default 20000)
returns table (
  id uuid, empresa_nombre text, email text, created_at timestamptz,
  plan text, industrias text[], palabras_clave_busqueda text[],
  items_inventario int, ofertas int, last_sign_in_at timestamptz,
  estado_gestion text, prioridad int, notas text, proxima_accion text,
  proxima_fecha timestamptz, etiquetas text[]
)
language sql stable security definer set search_path = public as $$
  select c.id, c.empresa_nombre, c.email, c.created_at, c.plan,
    c.industrias, c.palabras_clave_busqueda,
    (select count(*)::int from cliente_inventario ci where ci.cliente_id = c.id) as items_inventario,
    (select count(*)::int from cliente_ofertas co where co.cliente_id = c.id) as ofertas,
    u.last_sign_in_at,
    coalesce(g.estado, 'nuevo'), coalesce(g.prioridad, 0), g.notas, g.proxima_accion,
    g.proxima_fecha, g.etiquetas
  from clientes c
  left join auth.users u on u.id = c.user_id
  left join clientes_gestion g on g.cliente_id = c.id
  where (auth.jwt() ->> 'email') = 'evaras@firmavb.cl'
  order by u.last_sign_in_at asc nulls first
  limit greatest(1, least(lim, 20000));
$$;
revoke execute on function public.admin_clientes_actividad(int) from public, anon;
grant execute on function public.admin_clientes_actividad(int) to authenticated;

create or replace function public.admin_cliente_gestion_guardar(
  p_cliente_id uuid, p_estado text, p_prioridad int, p_notas text,
  p_proxima_accion text, p_proxima_fecha timestamptz, p_etiquetas text[]
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'evaras@firmavb.cl' then
    raise exception 'no autorizado';
  end if;
  insert into public.clientes_gestion (cliente_id, estado, prioridad, notas, proxima_accion, proxima_fecha, etiquetas, actualizado_en)
  values (p_cliente_id, p_estado, p_prioridad, p_notas, p_proxima_accion, p_proxima_fecha, p_etiquetas, now())
  on conflict (cliente_id) do update set
    estado = excluded.estado, prioridad = excluded.prioridad, notas = excluded.notas,
    proxima_accion = excluded.proxima_accion, proxima_fecha = excluded.proxima_fecha,
    etiquetas = excluded.etiquetas, actualizado_en = now();
end;
$$;
revoke execute on function public.admin_cliente_gestion_guardar(uuid, text, int, text, text, timestamptz, text[]) from public, anon;
grant execute on function public.admin_cliente_gestion_guardar(uuid, text, int, text, text, timestamptz, text[]) to authenticated;
