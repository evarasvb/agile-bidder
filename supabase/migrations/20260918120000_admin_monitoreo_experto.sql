-- Monitoreo del Experto para el admin: qué preguntan los clientes (con sesión,
-- suscritos o en plan free) y visitantes anónimos del landing (comodín), y qué
-- les respondimos. Junta las dos fuentes de conversación que ya existen:
--   experto.consultas                -> comodín del landing (anónimo, por huella)
--                                        + Libro del Experto (chat/matriz/estudio/
--                                        mapa/bajo_agua/informe).
--   evaristo_conversaciones/mensajes -> el asistente general "Don Evaristo"
--                                        (memoria; requiere sesión).
-- Mismo patrón que admin_traccion_resumen: RPC security-definer que revisa
-- auth.jwt()->>'email' adentro, sin depender de RLS de las tablas base.

create or replace function public.admin_experto_resumen()
returns jsonb
language sql stable security definer set search_path = public, experto as $$
  select case when (auth.jwt() ->> 'email') <> 'evaras@firmavb.cl' then null else jsonb_build_object(
    'consultas_total', (select count(*) from experto.consultas),
    'consultas_hoy', (select count(*) from experto.consultas where creado_en > now() - interval '1 day'),
    'consultas_7d', (select count(*) from experto.consultas where creado_en > now() - interval '7 days'),
    'anonimas_7d', (select count(*) from experto.consultas where creado_en > now() - interval '7 days' and user_id is null),
    'evaristo_mensajes_7d', (select count(*) from public.evaristo_mensajes where creado_en > now() - interval '7 days' and rol = 'user')
  ) end;
$$;
grant execute on function public.admin_experto_resumen() to authenticated;

create or replace function public.admin_experto_consultas(dias int default 7, lim int default 200, buscar text default null)
returns table (
  id bigint, creado_en timestamptz, user_id uuid, empresa_nombre text, email text,
  huella text, modo text, licitacion text, pregunta text, respuesta text, ms int
)
language sql stable security definer set search_path = public, experto as $$
  select q.id, q.creado_en, q.user_id, c.empresa_nombre, coalesce(c.email, u.email),
    q.huella, q.modo, q.licitacion, q.pregunta, q.respuesta, q.ms
  from experto.consultas q
  left join public.clientes c on c.user_id = q.user_id
  left join auth.users u on u.id = q.user_id
  where (auth.jwt() ->> 'email') = 'evaras@firmavb.cl'
    and q.creado_en > now() - make_interval(days => dias)
    and (
      buscar is null or buscar = ''
      or q.pregunta ilike '%' || buscar || '%'
      or q.respuesta ilike '%' || buscar || '%'
      or c.empresa_nombre ilike '%' || buscar || '%'
    )
  order by q.creado_en desc
  limit lim;
$$;
grant execute on function public.admin_experto_consultas(int, int, text) to authenticated;

create or replace function public.admin_evaristo_conversaciones(dias int default 7, lim int default 100)
returns table (
  id uuid, user_id uuid, empresa_nombre text, email text, canal text, titulo text,
  actualizado_en timestamptz, mensajes int, ultima_pregunta text
)
language sql stable security definer set search_path = public as $$
  select conv.id, conv.user_id, c.empresa_nombre, coalesce(c.email, u.email), conv.canal, conv.titulo,
    conv.actualizado_en,
    (select count(*)::int from public.evaristo_mensajes m where m.conversacion_id = conv.id),
    (select m.contenido from public.evaristo_mensajes m where m.conversacion_id = conv.id and m.rol = 'user' order by m.id desc limit 1)
  from public.evaristo_conversaciones conv
  left join public.clientes c on c.user_id = conv.user_id
  left join auth.users u on u.id = conv.user_id
  where (auth.jwt() ->> 'email') = 'evaras@firmavb.cl'
    and conv.actualizado_en > now() - make_interval(days => dias)
  order by conv.actualizado_en desc
  limit lim;
$$;
grant execute on function public.admin_evaristo_conversaciones(int, int) to authenticated;

create or replace function public.admin_evaristo_mensajes(p_conversacion_id uuid)
returns table (id bigint, rol text, contenido text, creado_en timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.rol, m.contenido, m.creado_en
  from public.evaristo_mensajes m
  where (auth.jwt() ->> 'email') = 'evaras@firmavb.cl' and m.conversacion_id = p_conversacion_id
  order by m.id asc;
$$;
grant execute on function public.admin_evaristo_mensajes(uuid) to authenticated;
