-- Arreglo de 20260916050000: en generar_matches_lic_pendientes (rama "por_titulo", licitaciones
-- sin ítems) se usó el operador <<->> que no existe en pg_trgm; la función fallaba al correr
-- ("operator does not exist: text <<->> text"). Se ordena por strict_word_similarity directamente.
create or replace function public.generar_matches_lic_pendientes(p_umbral real default 0.45, p_limite integer default 300)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare n int;
begin
  perform set_config('statement_timeout', '300000', true);
  perform set_config('pg_trgm.strict_word_similarity_threshold', '0.35', true);
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
    select o.codigo, max(m.sim) as sim
    from objetivo o
    join public.licitaciones_bi_items it on it.licitacion_id = o.id
    cross join lateral (
      select coalesce(max(public.match_sim(ci.nombre_norm, ci.codigo_producto, it.nombre_norm, it.codigo_producto)), 0::real) as sim
      from public.cliente_inventario ci
      where it.nombre_norm is not null and ci.nombre_norm %>> it.nombre_norm
    ) m
    where o.tiene_items
    group by o.codigo
  ),
  por_titulo as (
    select o.codigo,
      coalesce((select strict_word_similarity(ci.nombre_norm, o.texto)
        from public.cliente_inventario ci
        where o.texto is not null and ci.nombre_norm %>> o.texto
        order by strict_word_similarity(ci.nombre_norm, o.texto) desc limit 1), 0::real) as sim
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
