-- Caché de fuentes externas del Modo Bajo el Agua (Ley del Lobby, Consultas al Mercado).
-- Evita repetir descargas: cada clave guarda el resultado y su fecha; la función decide cuándo refrescar.
create table if not exists public.experto_fuentes_cache (
  clave text primary key,
  datos jsonb not null,
  actualizado_en timestamptz not null default now()
);
alter table public.experto_fuentes_cache enable row level security;
-- Sin políticas: solo service_role (las funciones edge) lee y escribe.
create index if not exists experto_fuentes_cache_actualizado_idx on public.experto_fuentes_cache (actualizado_en);
