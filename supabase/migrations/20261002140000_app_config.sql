-- Config interna del servidor (secretos de bajo riesgo que leen las edge functions
-- con service_role). RLS habilitada SIN políticas: solo el service_role la lee.
-- Los valores (p. ej. CMF_API_KEY, TMC_SYNC_SECRET) se cargan por SQL fuera del
-- repo, nunca se versionan.
create table if not exists public.app_config (
  clave text primary key,
  valor text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
-- Sin policies a propósito: nadie con anon/authenticated puede leer estos valores.
