-- Conexión de Gmail por usuario (para dejar borradores de cobro con adjuntos en
-- el correo del usuario). Mismo patrón que google_drive_conexiones: los tokens
-- (access/refresh) son secretos, la tabla tiene RLS habilitada SIN políticas, así
-- que solo el service_role (edge functions) la lee/escribe. El cliente nunca ve
-- los tokens; consulta el estado con la función de abajo.
create table if not exists public.gmail_conexiones (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gmail_conexiones enable row level security;
-- Sin policies a propósito: nadie con anon/authenticated puede tocar los tokens.

-- Estado de conexión para el frontend (sin exponer tokens).
create or replace function public.gmail_estado()
returns table (conectado boolean, email text)
language sql
security definer
set search_path to 'public'
as $$
  select (c.user_id is not null) as conectado, c.google_email as email
  from (select auth.uid() as uid) u
  left join public.gmail_conexiones c on c.user_id = u.uid;
$$;

grant execute on function public.gmail_estado() to authenticated;
