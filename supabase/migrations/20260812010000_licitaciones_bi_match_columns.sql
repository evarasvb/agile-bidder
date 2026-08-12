-- El panel de oportunidades ahora lee las licitaciones desde `licitaciones_bi`
-- (tabla fresca alimentada por el sync oficial de Mercado Público) en lugar de la
-- antigua tabla `licitaciones`, que quedó congelada en 2026-04 (0 activas).
--
-- Para que la acción "descartar" del panel — y un futuro match de licitaciones —
-- tengan dónde escribir, se agregan las columnas de match que la tabla antigua ya
-- tenía. Son nulas por defecto y no afectan el sync existente.
alter table public.licitaciones_bi
  add column if not exists match_score numeric,
  add column if not exists match_encontrado boolean not null default false;
