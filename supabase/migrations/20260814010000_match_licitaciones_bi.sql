-- =====================================================================
-- Match de LICITACIONES (tabla licitaciones_bi) — puebla match_score
-- =====================================================================
-- Contexto: el Panel (`useOportunidadesPanel`) lee `licitaciones_bi.match_score`
-- y `match_encontrado`, pero esas columnas se crearon vacías y ningún proceso
-- las llenaba => las licitaciones salían SIEMPRE sin match.
--
-- Esta migración replica el mecanismo del match de compras ágiles
-- (`generar_matches_ca`): similitud de trigramas (pg_trgm) entre el TÍTULO de la
-- licitación y el inventario del cliente, guardando el mejor producto por
-- licitación. Es un match por texto (no por ítem): la tabla fresca
-- `licitaciones_bi` no trae ítems (los 259k de `licitacion_items` pertenecen a
-- la tabla antigua `licitaciones`, congelada). El match por ítem/línea requerirá
-- que el sync extraiga ítems a la tabla fresca (trabajo aparte).

create extension if not exists pg_trgm;

-- Índice GiST para el orden KNN (<->>). El GIN existente (idx_inv_nombre_trgm)
-- soporta el filtro %> pero no el KNN, que era el cuello de botella al escalar
-- de ~76 compras ágiles activas a ~4.300 licitaciones activas.
create index if not exists idx_inv_nombre_gist_trgm
  on public.cliente_inventario using gist (nombre_producto gist_trgm_ops);

-- Función de match para licitaciones activas.
--  p_umbral : umbral de word_similarity (0.35 corta el ruido de 1 sola palabra).
--  p_buckets/p_bucket : permiten poblar en tandas (mod(hashtext(codigo)))
--     sin exceder límites de tiempo puntuales; el cron usa p_buckets=1 (todo).
create or replace function public.generar_matches_lic(
  p_umbral real default 0.35, p_buckets int default 1, p_bucket int default 0)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare n integer;
begin
  perform set_config('pg_trgm.word_similarity_threshold', p_umbral::text, true);

  with activas as (
    select codigo,
           nullif(trim(regexp_replace(regexp_replace(
             upper(nombre), '\([^)]*\)', ' ', 'g'),
             '[[:space:]]+', ' ', 'g')), '') as texto
    from public.licitaciones_bi
    where (estado is null or estado ilike 'publicada' or estado ilike 'activa')
      and fecha_cierre > now()
      and nombre is not null
      and (p_buckets <= 1 or mod(abs(hashtext(codigo)), p_buckets) = p_bucket)
  ),
  best as (
    select a.codigo, m.sim
    from activas a
    left join lateral (
      select word_similarity(ci.nombre_producto, a.texto) as sim
      from public.cliente_inventario ci
      where a.texto is not null and ci.nombre_producto %> a.texto
      order by ci.nombre_producto <->> a.texto
      limit 1
    ) m on true
  )
  update public.licitaciones_bi l
  set match_score = case when b.sim is not null then round((b.sim*100)::numeric,1) else null end,
      match_encontrado = (b.sim is not null),
      updated_at = now()
  from best b
  where l.codigo = b.codigo;

  get diagnostics n = row_count;
  return n;
end $function$;

-- Automatización con pg_cron: correr el match cada hora (minuto 17), set completo.
do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'match-lic-horario') then
    perform cron.unschedule('match-lic-horario');
  end if;
  perform cron.schedule('match-lic-horario', '17 * * * *',
                        $$ select public.generar_matches_lic(0.35, 1, 0); $$);
end $cron$;
