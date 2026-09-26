-- Aviso cuando un cliente conecta su Google Drive.
-- Marca de "ya avisado" para no repetir, y RPC que devuelve las conexiones
-- nuevas SIN tokens (solo quién conectó y con qué correo de Google).
alter table public.google_drive_conexiones
  add column if not exists avisado boolean not null default false;
-- Baseline: las conexiones ya existentes no se re-avisan.
update public.google_drive_conexiones set avisado = true where avisado = false;
create index if not exists idx_gdrive_conexiones_avisado
  on public.google_drive_conexiones (avisado) where avisado = false;

-- Conexiones nuevas por avisar, con nombre/correo del cliente resuelto.
-- SECURITY DEFINER + service_role: no expone tokens. Bloqueada a service_role.
create or replace function public.drive_conexiones_por_avisar()
returns table(user_id uuid, google_email text, conectado_en timestamptz,
              nombre text, email_app text, scope text)
language sql security definer set search_path to 'public'
as $$
  select g.user_id, g.google_email, g.created_at,
         coalesce(p.full_name, c.nombre_responsable),
         coalesce(p.email, c.email, c.email_contacto),
         g.scope
  from public.google_drive_conexiones g
  left join public.profiles p on p.id = g.user_id
  left join public.clientes c on c.user_id = g.user_id
  where g.avisado = false
  order by g.created_at;
$$;

revoke all on function public.drive_conexiones_por_avisar() from public, anon, authenticated;
grant execute on function public.drive_conexiones_por_avisar() to service_role;
