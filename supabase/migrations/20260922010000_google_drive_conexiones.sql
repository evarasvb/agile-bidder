-- Conexión de Google Drive por usuario.
-- Los tokens (access/refresh) son secretos: la tabla tiene RLS habilitada SIN
-- políticas, así que solo el service_role (edge functions) puede leerla/escribirla.
-- El cliente nunca ve los tokens; consulta el estado con la función de abajo.
create table if not exists public.google_drive_conexiones (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_drive_conexiones enable row level security;
-- Sin policies a propósito: nadie con anon/authenticated puede tocar los tokens.

-- Estado de conexión para el frontend (sin exponer tokens).
create or replace function public.google_drive_estado()
returns table (conectado boolean, email text)
language sql
security definer
set search_path to 'public'
as $$
  select (c.user_id is not null) as conectado, c.google_email as email
  from (select auth.uid() as uid) u
  left join public.google_drive_conexiones c on c.user_id = u.uid;
$$;

grant execute on function public.google_drive_estado() to authenticated;
