-- FIX crítico del match de licitaciones.
--
-- Problema: match-lic-horario (generar_matches_lic_todo) recomputaba TODAS las
-- ~4.235 licitaciones activas contra las 32k filas de cliente_inventario cada
-- hora, con lookups trigram KNN. Excedía el statement_timeout de 2 min y FALLABA
-- cada corrida -> solo 16% de las activas tenía match_score (matches
-- desactualizados / incompletos).
--
-- Solución: match INCREMENTAL. Solo se procesan las activas SIN score todavía
-- (nuevas). A las que no matchean se les pone score 0 (no null) para no
-- reprocesarlas. Así el cron horario es rápido (solo arrivals) y el backfill
-- inicial se hizo en trozos.

create or replace function public.generar_matches_lic_pendientes(p_umbral real default 0.45, p_limite int default 300)
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform set_config('statement_timeout', '300000', true);        -- 5 min
  perform set_config('pg_trgm.word_similarity_threshold', '0.35', true);

  with objetivo as (
    select l.id, l.codigo,
           public.f_unaccent(lower(nullif(trim(regexp_replace(regexp_replace(
             l.nombre,'\([^)]*\)',' ','g'),'[[:space:]]+',' ','g')),''))) as texto,
           exists (select 1 from public.licitaciones_bi_items i where i.licitacion_id = l.id) as tiene_items
    from public.licitaciones_bi l
    where l.estado ilike 'publicada' and l.fecha_cierre > now()
      and l.match_score is null and l.nombre is not null
    order by l.fecha_publicacion desc nulls last
    limit greatest(1, least(coalesce(p_limite,300), 1000))
  ),
  por_item as (
    select o.codigo, max(greatest(
      case when exists (select 1 from public.cliente_inventario ci
        where ci.codigo_producto is not null and it.codigo_producto is not null
          and ci.codigo_producto = it.codigo_producto) then 1.0::real else 0::real end,
      coalesce((select word_similarity(ci.nombre_norm, it.nombre_norm)
        from public.cliente_inventario ci
        where it.nombre_norm is not null and ci.nombre_norm %> it.nombre_norm
        order by ci.nombre_norm <->> it.nombre_norm limit 1), 0::real)
    )) as sim
    from objetivo o
    join public.licitaciones_bi_items it on it.licitacion_id = o.id
    where o.tiene_items
    group by o.codigo
  ),
  por_titulo as (
    select o.codigo,
      coalesce((select word_similarity(ci.nombre_norm, o.texto)
        from public.cliente_inventario ci
        where o.texto is not null and ci.nombre_norm %> o.texto
        order by ci.nombre_norm <->> o.texto limit 1), 0::real) as sim
    from objetivo o
    where not o.tiene_items
  ),
  combinado as (
    select codigo, max(sim) as sim from (
      select codigo, sim from por_item
      union all
      select codigo, sim from por_titulo
    ) u group by codigo
  )
  update public.licitaciones_bi l
  set match_score = case when c.sim > 0 then round((c.sim*100)::numeric,1) else 0 end,
      match_encontrado = (c.sim >= p_umbral),
      updated_at = now()
  from combinado c
  where l.codigo = c.codigo;
  get diagnostics n = row_count; return n;
end $$;

create or replace function public.generar_matches_lic_bg()
returns integer language plpgsql security definer set search_path = public as $$
begin
  return public.generar_matches_lic_pendientes(0.45, 500);
end $$;

grant execute on function public.generar_matches_lic_pendientes(real,int) to authenticated;
grant execute on function public.generar_matches_lic_bg() to authenticated;

-- Cron horario apuntado al match incremental (rápido):
--   select cron.schedule('match-lic-horario','17 * * * *','select public.generar_matches_lic_bg();');
