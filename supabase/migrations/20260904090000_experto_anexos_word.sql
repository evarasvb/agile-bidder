-- Anexos Word oficiales completados por el Experto conservando el formato (estilo NotebookLM:
-- el cliente sube el Word como fuente, el Experto lo rellena y deja en amarillo lo que debe validar).
create table if not exists experto.anexos_word (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  codigo text not null,
  documento_id uuid,
  nombre text not null,
  storage_path text not null,
  campos_validar integer not null default 0,
  campos jsonb not null default '[]'::jsonb,
  creado_en timestamptz not null default now()
);
create index if not exists idx_experto_anexos_word_user_codigo on experto.anexos_word (user_id, codigo, creado_en desc);
alter table experto.anexos_word enable row level security;

-- Ruta en storage de un documento de trabajo (solo la función, con service_role).
create or replace function public.experto_documento_ruta(p_user_id uuid, p_id uuid)
returns table(id uuid, codigo text, nombre text, tipo text, storage_path text)
language sql stable security definer set search_path to 'public', 'experto' as $$
  select d.id, d.codigo, d.nombre, d.tipo, d.storage_path from experto.documentos d
  where d.id = p_id and d.user_id = p_user_id;
$$;

-- Guarda el anexo completado (reemplaza una versión anterior del mismo nombre).
create or replace function public.experto_anexo_word_insertar(p_user_id uuid, p_codigo text, p_documento_id uuid, p_nombre text, p_storage_path text, p_campos_validar integer, p_campos jsonb)
returns uuid language sql security definer set search_path to 'public', 'experto' as $$
  delete from experto.anexos_word a where a.user_id = p_user_id and upper(a.codigo) = upper(p_codigo) and a.nombre = p_nombre;
  insert into experto.anexos_word (user_id, codigo, documento_id, nombre, storage_path, campos_validar, campos)
  values (p_user_id, upper(p_codigo), p_documento_id, p_nombre, p_storage_path, coalesce(p_campos_validar, 0), coalesce(p_campos, '[]'::jsonb)) returning id;
$$;

create or replace function public.experto_anexos_word_listar(p_user_id uuid, p_codigo text)
returns table(id uuid, nombre text, storage_path text, campos_validar integer, campos jsonb, creado_en timestamptz)
language sql stable security definer set search_path to 'public', 'experto' as $$
  select a.id, a.nombre, a.storage_path, a.campos_validar, a.campos, a.creado_en from experto.anexos_word a
  where a.user_id = p_user_id and upper(a.codigo) = upper(p_codigo) order by a.creado_en desc;
$$;

create or replace function public.experto_anexo_word_borrar(p_user_id uuid, p_id uuid)
returns text language sql security definer set search_path to 'public', 'experto' as $$
  delete from experto.anexos_word a where a.id = p_id and a.user_id = p_user_id returning a.storage_path;
$$;

revoke all on function public.experto_documento_ruta(uuid, uuid) from public, anon, authenticated;
revoke all on function public.experto_anexo_word_insertar(uuid, text, uuid, text, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.experto_anexos_word_listar(uuid, text) from public, anon, authenticated;
revoke all on function public.experto_anexo_word_borrar(uuid, uuid) from public, anon, authenticated;
grant execute on function public.experto_documento_ruta(uuid, uuid) to service_role;
grant execute on function public.experto_anexo_word_insertar(uuid, text, uuid, text, text, integer, jsonb) to service_role;
grant execute on function public.experto_anexos_word_listar(uuid, text) to service_role;
grant execute on function public.experto_anexo_word_borrar(uuid, uuid) to service_role;
