-- Hallazgos de Codex en PR #397: la pantalla /admin/experto-actividad ofrece
-- buscar por email/cliente y por licitación, pero admin_experto_consultas solo
-- filtraba por pregunta/respuesta/empresa_nombre — una búsqueda por email o
-- código de licitación no encontraba nada aunque existiera. Lo mismo le
-- faltaba a admin_evaristo_conversaciones (no tenía parámetro de búsqueda en
-- absoluto, así que el buscador de esa pestaña solo filtraba localmente las
-- 200 filas ya traídas, sin alcanzar conversaciones más viejas).

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

-- create or replace no reemplaza esta función: al agregar un parámetro nuevo
-- (buscar) queda como una sobrecarga aparte y la versión de 2 argumentos
-- quedaría duplicada sin uso. Se elimina esa versión vieja explícitamente.
drop function if exists public.admin_evaristo_conversaciones(int, int);

create or replace function public.admin_evaristo_conversaciones(dias int default 7, lim int default 100, buscar text default null)
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
