-- El esquema experto no está expuesto por la API: las funciones de borde usan RPCs (solo service_role)
-- para listar, insertar y borrar documentos de trabajo, y para leer los entregables previos del libro.
create or replace function public.experto_documentos_listar(p_user_id uuid, p_codigo text)
returns table(id uuid, codigo text, nombre text, tipo text, caracteres integer, creado_en timestamptz)
language sql stable security definer set search_path to 'public', 'experto' as $$
  select d.id, d.codigo, d.nombre, d.tipo, d.caracteres, d.creado_en from experto.documentos d
  where d.user_id = p_user_id and (upper(d.codigo) = upper(p_codigo) or (nullif(p_codigo, '') is null and d.codigo is null))
  order by d.creado_en desc limit 50;
$$;
create or replace function public.experto_documento_insertar(p_user_id uuid, p_codigo text, p_nombre text, p_tipo text, p_storage_path text, p_texto text)
returns uuid language sql security definer set search_path to 'public', 'experto' as $$
  insert into experto.documentos (user_id, codigo, nombre, tipo, storage_path, texto, caracteres)
  values (p_user_id, nullif(upper(p_codigo), ''), p_nombre, p_tipo, p_storage_path, p_texto, length(p_texto)) returning id;
$$;
create or replace function public.experto_documento_borrar(p_user_id uuid, p_id uuid)
returns text language sql security definer set search_path to 'public', 'experto' as $$
  delete from experto.documentos d where d.id = p_id and d.user_id = p_user_id returning coalesce(d.storage_path, '');
$$;
create or replace function public.experto_entregables_texto(p_user_id uuid, p_codigo text)
returns table(modo text, respuesta text, creado_en timestamptz)
language sql stable security definer set search_path to 'public', 'experto' as $$
  select distinct on (c.modo) c.modo, c.respuesta, c.creado_en from experto.consultas c
  where c.user_id = p_user_id and upper(c.licitacion) = upper(p_codigo) and c.modo in ('informe', 'estudio', 'matriz')
  order by c.modo, c.creado_en desc;
$$;
revoke all on function public.experto_documentos_listar(uuid, text) from public, anon, authenticated;
revoke all on function public.experto_documento_insertar(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.experto_documento_borrar(uuid, uuid) from public, anon, authenticated;
revoke all on function public.experto_entregables_texto(uuid, text) from public, anon, authenticated;
grant execute on function public.experto_documentos_listar(uuid, text) to service_role;
grant execute on function public.experto_documento_insertar(uuid, text, text, text, text, text) to service_role;
grant execute on function public.experto_documento_borrar(uuid, uuid) to service_role;
grant execute on function public.experto_entregables_texto(uuid, text) to service_role;
