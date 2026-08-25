-- Config y calendario del agente de marketing del libro (viral-agent).
-- RLS habilitado sin policies: nadie vía anon/authenticated puede leer ni
-- escribir; solo el service_role (usado por la Edge Function) tiene acceso.

create table if not exists public.viral_agent_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.viral_agent_config enable row level security;

create table if not exists public.viral_agent_calendario (
  dia int primary key,
  red text not null,
  formato text not null,
  pilar text not null,
  caption text not null,
  hashtags text not null,
  cta text not null,
  imagen_url text not null,
  estado text not null default 'pendiente',
  publicado_at timestamptz
);
alter table public.viral_agent_calendario enable row level security;
