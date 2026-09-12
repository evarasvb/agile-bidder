-- Dashboard admin "Tracción": clientes nuevos, activación (inventario/ofertas) y
-- estado de las campañas en curso (webinar_invitacion, prospects). Solo lo ve el
-- admin (evaras@firmavb.cl), mismo patrón que proveedores_estado: RPC
-- security-definer que revisa auth.jwt()->>'email' adentro, para no depender de
-- RLS en tablas que hoy están pensadas para acceso por dueño (clientes) o sin RLS
-- de por sí (webinar_invitacion, prospects, auth.users).

create or replace function public.admin_traccion_resumen()
returns jsonb
language sql stable security definer set search_path = public as $$
  select case when (auth.jwt() ->> 'email') <> 'evaras@firmavb.cl' then null else jsonb_build_object(
    'clientes_total', (select count(*) from clientes),
    'clientes_7d', (select count(*) from clientes where created_at > now() - interval '7 days'),
    'clientes_30d', (select count(*) from clientes where created_at > now() - interval '30 days'),
    'activados', (select count(distinct ci.cliente_id) from cliente_inventario ci),
    'con_oferta', (select count(distinct co.cliente_id) from cliente_ofertas co),
    'plan_pro', (select count(*) from clientes where plan is not null and plan <> 'free'),
    'conectados_7d', (
      select count(*) from clientes c join auth.users u on u.id = c.user_id
      where u.last_sign_in_at > now() - interval '7 days'
    )
  ) end;
$$;
grant execute on function public.admin_traccion_resumen() to authenticated;

create or replace function public.admin_clientes_nuevos(dias int default 30, lim int default 100)
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
    and c.created_at > now() - (greatest(1, least(dias, 365)) || ' days')::interval
  order by c.created_at desc
  limit greatest(1, least(lim, 300));
$$;
grant execute on function public.admin_clientes_nuevos(int,int) to authenticated;

create or replace function public.admin_campanas_resumen()
returns jsonb
language sql stable security definer set search_path = public as $$
  select case when (auth.jwt() ->> 'email') <> 'evaras@firmavb.cl' then null else jsonb_build_object(
    'webinar', (
      select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb)
      from (select estado, count(*) as n from webinar_invitacion group by estado) w
    ),
    'webinar_por_campana', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select campana, count(*)::int as total,
          count(*) filter (where estado = 'enviado')::int as enviados,
          count(*) filter (where estado = 'pendiente')::int as pendientes,
          count(*) filter (where estado = 'baja')::int as bajas
        from webinar_invitacion group by campana order by total desc
      ) x
    ),
    'prospects', (
      select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb)
      from (select estado, count(*) as n from prospects group by estado) p
    ),
    'prospects_total', (select count(*) from prospects)
  ) end;
$$;
grant execute on function public.admin_campanas_resumen() to authenticated;
