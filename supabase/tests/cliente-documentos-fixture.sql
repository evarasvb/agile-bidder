-- Synthetic fixture only. Owner policies/check copied from the production catalog
-- read on 2026-10-08; Storage policies are loaded from the repository migration.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
create table public.clientes (
  id uuid primary key, user_id uuid, empresa_nombre text, rut text, direccion text
);
alter table public.clientes enable row level security;
create policy fixture_clientes_owner on public.clientes for select to authenticated
  using (user_id = (select auth.uid()));
create table public.cliente_documentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id),
  tipo text, tipo_codigo text, nombre text, archivo_url text, descripcion text,
  constraint cliente_documentos_tipo_check check (tipo in ('ficha_tecnica', 'certificado', 'catalogo', 'otro'))
);
alter table public.cliente_documentos enable row level security;
create policy "Users can view their client documents" on public.cliente_documentos
  for select to authenticated using (cliente_id in (select id from public.clientes where user_id = (select auth.uid())));
create policy "Users can insert their client documents" on public.cliente_documentos
  for insert to authenticated with check (cliente_id in (select id from public.clientes where user_id = (select auth.uid())));
create policy "Users can update their client documents" on public.cliente_documentos
  for update to authenticated
  using (cliente_id in (select id from public.clientes where user_id = (select auth.uid())))
  with check (cliente_id in (select id from public.clientes where user_id = (select auth.uid())));
create policy "Users can delete their client documents" on public.cliente_documentos
  for delete to authenticated using (cliente_id in (select id from public.clientes where user_id = (select auth.uid())));
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant all on public.cliente_documentos to anon, authenticated, service_role;
grant select on public.clientes to anon, authenticated, service_role;
grant select, insert, delete on storage.objects to anon, authenticated, service_role;
