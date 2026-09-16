-- Licitaciones: el código ONU igual ya no vale 100 % de match (misma regla que compras ágiles,
-- migración 20260907180000). El código de producto es una categoría amplia; compartirlo aporta
-- una base de 50 % y el otro 50 % lo pone la similitud de texto contra la descripción del ítem.
-- generar_matches_lic_items_cliente (match por ítem y cliente) ya usa esta regla desde
-- 20260913090000; aquí se corrige el match global de licitaciones_bi.match_score
-- (generar_matches_lic_pendientes, cron horario) y las dos variantes de generar_matches_lic_items.

create or replace function public.generar_matches_lic_pendientes(p_umbral real default 0.45, p_limite integer default 300)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
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
    select o.codigo, max(m.sim) as sim
    from objetivo o
    join public.licitaciones_bi_items it on it.licitacion_id = o.id
    cross join lateral (
      select coalesce(max(
        case when ci.codigo_producto is not null and it.codigo_producto is not null and ci.codigo_producto = it.codigo_producto
             then 0.5::real + 0.5::real * coalesce(word_similarity(ci.nombre_norm, it.nombre_norm), 0::real)
             else coalesce(word_similarity(ci.nombre_norm, it.nombre_norm), 0::real) end), 0::real) as sim
      from public.cliente_inventario ci
      where (it.nombre_norm is not null and ci.nombre_norm %> it.nombre_norm)
         or (it.codigo_producto is not null and ci.codigo_producto = it.codigo_producto)
    ) m
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

create or replace function public.generar_matches_lic_items(p_umbral real default 0.45, p_buckets integer default 1, p_bucket integer default 0)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare n integer;
begin
  perform set_config('pg_trgm.word_similarity_threshold', '0.35', true);
  with por_item as (
    select l.codigo, max(m.sim) as sim
    from public.licitaciones_bi l
    join public.licitaciones_bi_items it on it.licitacion_id = l.id
    cross join lateral (
      select coalesce(max(
        case when ci.codigo_producto is not null and it.codigo_producto is not null and ci.codigo_producto = it.codigo_producto
             then 0.5::real + 0.5::real * coalesce(word_similarity(ci.nombre_norm, it.nombre_norm), 0::real)
             else coalesce(word_similarity(ci.nombre_norm, it.nombre_norm), 0::real) end), 0::real) as sim
      from public.cliente_inventario ci
      where (it.nombre_norm is not null and ci.nombre_norm %> it.nombre_norm)
         or (it.codigo_producto is not null and ci.codigo_producto = it.codigo_producto)
    ) m
    where (l.estado is null or l.estado ilike 'publicada' or l.estado ilike 'activa')
      and l.fecha_cierre > now()
      and (p_buckets <= 1 or mod(abs(hashtext(l.codigo)), p_buckets) = p_bucket)
    group by l.codigo
  )
  update public.licitaciones_bi l
  set match_score = case when p.sim > 0 then round((p.sim*100)::numeric,1) else null end,
      match_encontrado = (p.sim >= p_umbral), updated_at = now()
  from por_item p where l.codigo = p.codigo;
  get diagnostics n = row_count; return n;
end $$;

-- La variante de un solo parámetro queda como atajo de la anterior (misma regla).
create or replace function public.generar_matches_lic_items(p_umbral real default 0.45)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
begin
  return public.generar_matches_lic_items(p_umbral, 1, 0);
end $$;

-- Licitaciones abiertas con 100 % que pudo venir solo del código: se recalculan en el
-- próximo cron horario (match-lic-horario toma las que tienen match_score null).
update public.licitaciones_bi
   set match_score = null
 where fecha_cierre > now() and match_score >= 99;
