-- Precisión del match de licitaciones: sube el umbral de "match_encontrado" a
-- 0.45 para que el flag sea confiable. Antes (0.35) marcaba cientos de matches
-- por coincidencia de una sola palabra (ruido). El código ONU/UNSPSC exacto
-- sigue valiendo 100 y siempre cuenta como match. Se guarda el score aunque sea
-- bajo (para ordenar), pero solo se marca "con match" cuando es sólido (>=0.45)
-- o hay código exacto.
create or replace function public.generar_matches_lic_items(p_umbral real default 0.45)
returns integer
language plpgsql security definer set search_path = public
as $function$
declare n integer;
begin
  perform set_config('pg_trgm.word_similarity_threshold', '0.35', true);
  with por_item as (
    select l.codigo, max(greatest(
      case when exists (
        select 1 from public.cliente_inventario ci
        where ci.codigo_producto is not null and it.codigo_producto is not null
          and ci.codigo_producto = it.codigo_producto) then 1.0::real else 0::real end,
      coalesce((
        select word_similarity(ci.nombre_producto, it.nombre_producto)
        from public.cliente_inventario ci
        where it.nombre_producto is not null and ci.nombre_producto %> it.nombre_producto
        order by ci.nombre_producto <->> it.nombre_producto limit 1), 0::real)
    )) as sim
    from public.licitaciones_bi l
    join public.licitaciones_bi_items it on it.licitacion_id = l.id
    where (l.estado is null or l.estado ilike 'publicada' or l.estado ilike 'activa')
      and l.fecha_cierre > now()
    group by l.codigo
  )
  update public.licitaciones_bi l
  set match_score = case when p.sim > 0 then round((p.sim*100)::numeric,1) else null end,
      match_encontrado = (p.sim >= p_umbral),
      updated_at = now()
  from por_item p
  where l.codigo = p.codigo;
  get diagnostics n = row_count;
  return n;
end $function$;

create or replace function public.generar_matches_lic(
  p_umbral real default 0.45, p_buckets int default 1, p_bucket int default 0)
returns integer
language plpgsql security definer set search_path = public
as $function$
declare n integer;
begin
  perform set_config('pg_trgm.word_similarity_threshold', '0.35', true);
  with activas as (
    select l.codigo,
      nullif(trim(regexp_replace(regexp_replace(
        upper(l.nombre), '\([^)]*\)', ' ', 'g'),
        '[[:space:]]+', ' ', 'g')), '') as texto
    from public.licitaciones_bi l
    where (l.estado is null or l.estado ilike 'publicada' or l.estado ilike 'activa')
      and l.fecha_cierre > now()
      and l.nombre is not null
      and (p_buckets <= 1 or mod(abs(hashtext(l.codigo)), p_buckets) = p_bucket)
      and not exists (select 1 from public.licitaciones_bi_items i where i.licitacion_id = l.id)
  ),
  best as (
    select a.codigo, m.sim
    from activas a
    left join lateral (
      select word_similarity(ci.nombre_producto, a.texto) as sim
      from public.cliente_inventario ci
      where a.texto is not null and ci.nombre_producto %> a.texto
      order by ci.nombre_producto <->> a.texto limit 1
    ) m on true
  )
  update public.licitaciones_bi l
  set match_score = case when b.sim is not null and b.sim>0 then round((b.sim*100)::numeric,1) else null end,
      match_encontrado = (b.sim is not null and b.sim >= p_umbral),
      updated_at = now()
  from best b
  where l.codigo = b.codigo;
  get diagnostics n = row_count;
  return n;
end $function$;
