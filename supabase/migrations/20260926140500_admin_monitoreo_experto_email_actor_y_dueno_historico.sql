-- Dos hallazgos de Codex sobre el fix anterior (resolver la empresa dueña por
-- vendedores.invitado_por):
-- 1) coalesce(c.email, u.email) ahora antepone el email del DUEÑO (porque c
--    pasó a ser su fila) sobre el de quien realmente preguntó, así que todo
--    el equipo aparecía bajo el mismo correo. Se invierte el orden: primero
--    el email real de quien actuó (u, siempre el auth.users del actor), y
--    c.email solo como respaldo si u.email viniera null.
-- 2) El filtro v.activo is true perdía la atribución histórica apenas el
--    dueño desactivaba a alguien: las consultas viejas de ese miembro
--    dejaban de verse bajo su empresa real. Para una vista histórica de
--    admin no corresponde exigir que la relación siga activa hoy — alcanza
--    con que haya existido (invitado_por no nulo), así que se saca esa
--    condición (a diferencia de cliente_owner_id(), que si necesita "activo
--    ahora" porque decide acceso en vivo, no historia).
create or replace function public.admin_experto_consultas(dias int default 7, lim int default 3000, buscar text default null)
returns table (
  id bigint, creado_en timestamptz, user_id uuid, empresa_nombre text, email text,
  huella text, modo text, licitacion text, pregunta text, respuesta text, ms int
)
language sql stable security definer set search_path = public, experto as $$
  select q.id, q.creado_en, q.user_id, c.empresa_nombre, coalesce(u.email, c.email),
    q.huella, q.modo, q.licitacion, q.pregunta, q.respuesta, q.ms
  from experto.consultas q
  left join public.clientes c on c.user_id = coalesce(
    (
      select v.invitado_por from public.vendedores v
      where v.user_id = q.user_id and v.invitado_por is not null
      order by v.updated_at desc nulls last limit 1
    ),
    q.user_id
  )
  left join auth.users u on u.id = q.user_id
  where coalesce(auth.jwt() ->> 'email', '') = 'evaras@firmavb.cl'
    and q.creado_en > now() - make_interval(days => dias)
    and (
      buscar is null or buscar = ''
      or q.pregunta ilike '%' || buscar || '%'
      or q.respuesta ilike '%' || buscar || '%'
      or c.empresa_nombre ilike '%' || buscar || '%'
      or c.email ilike '%' || buscar || '%'
      or u.email ilike '%' || buscar || '%'
      or q.licitacion ilike '%' || buscar || '%'
    )
  order by q.creado_en desc
  limit lim;
$$;
revoke execute on function public.admin_experto_consultas(int, int, text) from public, anon;
grant execute on function public.admin_experto_consultas(int, int, text) to authenticated;

create or replace function public.admin_evaristo_conversaciones(dias int default 7, lim int default 2000, buscar text default null)
returns table (
  id uuid, user_id uuid, empresa_nombre text, email text, canal text, titulo text,
  actualizado_en timestamptz, mensajes int, ultima_pregunta text
)
language sql stable security definer set search_path = public as $$
  select conv.id, conv.user_id, c.empresa_nombre, coalesce(u.email, c.email), conv.canal, conv.titulo,
    conv.actualizado_en,
    (select count(*)::int from public.evaristo_mensajes m where m.conversacion_id = conv.id),
    (select m.contenido from public.evaristo_mensajes m where m.conversacion_id = conv.id and m.rol = 'user' order by m.id desc limit 1)
  from public.evaristo_conversaciones conv
  left join public.clientes c on c.user_id = coalesce(
    (
      select v.invitado_por from public.vendedores v
      where v.user_id = conv.user_id and v.invitado_por is not null
      order by v.updated_at desc nulls last limit 1
    ),
    conv.user_id
  )
  left join auth.users u on u.id = conv.user_id
  where coalesce(auth.jwt() ->> 'email', '') = 'evaras@firmavb.cl'
    and conv.actualizado_en > now() - make_interval(days => dias)
    and (
      buscar is null or buscar = ''
      or c.empresa_nombre ilike '%' || buscar || '%'
      or c.email ilike '%' || buscar || '%'
      or u.email ilike '%' || buscar || '%'
      or conv.titulo ilike '%' || buscar || '%'
      or exists (
        select 1 from public.evaristo_mensajes m
        where m.conversacion_id = conv.id and m.rol = 'user' and m.contenido ilike '%' || buscar || '%'
      )
    )
  order by conv.actualizado_en desc
  limit lim;
$$;
revoke execute on function public.admin_evaristo_conversaciones(int, int, text) from public, anon;
grant execute on function public.admin_evaristo_conversaciones(int, int, text) to authenticated;
