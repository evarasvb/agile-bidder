-- Repositorio de documentos de la empresa para Experto Plus (anexos completados):
-- datos del representante legal y giros en clientes, bucket privado por usuario y checklist.
alter table public.clientes
  add column if not exists representante_nombre text,
  add column if not exists representante_rut text,
  add column if not exists giros text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos-empresa', 'documentos-empresa', false, 20971520, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

-- Cada usuario solo ve y escribe su carpeta (<user_id>/...).
drop policy if exists "documentos_empresa_insert" on storage.objects;
create policy "documentos_empresa_insert" on storage.objects for insert
  with check (bucket_id = 'documentos-empresa' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "documentos_empresa_select" on storage.objects;
create policy "documentos_empresa_select" on storage.objects for select
  using (bucket_id = 'documentos-empresa' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "documentos_empresa_delete" on storage.objects;
create policy "documentos_empresa_delete" on storage.objects for delete
  using (bucket_id = 'documentos-empresa' and (storage.foldername(name))[1] = auth.uid()::text);

-- Checklist del Plus: qué datos y documentos faltan para completar anexos.
create or replace function public.experto_plus_checklist(p_user_id uuid default auth.uid())
returns table (item text, obligatorio boolean, listo boolean)
language sql stable security definer set search_path = public as $$
  with c as (select * from public.clientes where user_id = p_user_id limit 1),
  d as (select tipo from public.cliente_documentos cd join c on cd.cliente_id = c.id)
  select * from (values
    ('razon_social', true, (select nullif(trim(empresa_nombre), '') is not null from c)),
    ('rut_empresa', true, (select nullif(trim(rut), '') is not null from c)),
    ('direccion', true, (select nullif(trim(direccion), '') is not null from c)),
    ('giros', true, (select nullif(trim(giros), '') is not null from c)),
    ('representante_nombre', true, (select nullif(trim(representante_nombre), '') is not null from c)),
    ('representante_rut', true, (select nullif(trim(representante_rut), '') is not null from c)),
    ('carpeta_tributaria', true, exists (select 1 from d where tipo = 'carpeta_tributaria')),
    ('vigencia_poderes', true, exists (select 1 from d where tipo = 'vigencia_poderes')),
    ('cedula_representante', true, exists (select 1 from d where tipo = 'cedula_representante')),
    ('escritura_constitucion', false, exists (select 1 from d where tipo = 'escritura_constitucion')),
    ('registro_proveedores', false, exists (select 1 from d where tipo = 'registro_proveedores'))
  ) v(item, obligatorio, listo);
$$;
grant execute on function public.experto_plus_checklist(uuid) to authenticated, service_role;
