-- El límite de 300/200 filas era un número arbitrario que pusimos nosotros al
-- escribir la pantalla, no una restricción de Supabase ni algo que afecte el
-- costo del plan (se cobra por uso de base de datos/transferencia, no por
-- cuántas filas devuelve una consulta puntual). Para una pantalla de uso
-- interno (un solo usuario) se sube a un valor mucho más generoso en vez de
-- construir paginación completa.
create or replace function public.admin_experto_consultas(dias int default 7, lim int default 3000, buscar text default null)
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
  select conv.id, conv.user_id, c.empresa_nombre, coalesce(c.email, u.email), conv.canal, conv.titulo,
    conv.actualizado_en,
    (select count(*)::int from public.evaristo_mensajes m where m.conversacion_id = conv.id),
    (select m.contenido from public.evaristo_mensajes m where m.conversacion_id = conv.id and m.rol = 'user' order by m.id desc limit 1)
  from public.evaristo_conversaciones conv
  left join public.clientes c on c.user_id = conv.user_id
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
