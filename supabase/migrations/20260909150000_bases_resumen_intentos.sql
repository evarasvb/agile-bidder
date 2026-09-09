-- Resumen diferido: cada base guarda cuántas veces se intentó resumir; a la tercera se deja de intentar
-- (así una base que Gemini no puede resumir no bloquea la cola de las demás).
alter table public.bases_licitacion add column if not exists resumen_intentos integer not null default 0;
drop index if exists public.bases_licitacion_sin_resumen_idx;
create index if not exists bases_licitacion_sin_resumen_idx on public.bases_licitacion (creado_en) where resumen is null and resumen_intentos < 3;
