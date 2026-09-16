-- Fix de 3 bugs que introdujo la migración anterior (match_solo_descripcion_y_bono_codigo_condicional,
-- aplicada directo a la base sin pasar por este repo) detectados por revisión de código en la PR:
--
-- 1) generar_matches_ca_items y generar_matches_ca perdieron el bono de marca/palabras_clave
--    (agregado en 20260915213000_match_ca_marca_keywords.sql, caso ferretería) al ser
--    reemplazadas sin conservar esa lógica. Se restaura sobre la base de match_sim().
-- 2) Las 5 funciones de match dejaron el candidato SOLO detrás del umbral de similitud
--    (nombre_norm %>> ...), perdiendo el "or coincide el código de producto" que ya tenían
--    todas: un candidato con código exacto pero similitud de texto entre 0.30 y 0.45 nunca
--    llegaba a match_sim() para recibir su bono condicional. Se restaura el OR.
-- 3) generar_matches_lic_pendientes quedó con el operador inexistente `<<->>` (mezcla de
--    <<-> y <->>): el cron horario fallaría con "operator does not exist" apenas procesara
--    una licitación sin items. Corregido a `<->>>` (conmutador de similitud estricta),
--    igual patrón que usaba la versión anterior con similitud no estricta (`<->>`).
create or replace function public.generar_matches_ca_items(p_cliente uuid, p_umbral real default 0.30)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare n integer;
begin
  perform set_config('pg_trgm.strict_word_similarity_threshold', '0.45', true);
  insert into public.ca_item_matches (compra_agil_codigo, item_id, cliente_id, nombre_solicitado, cantidad,
                                       inventario_id, nombre_producto, sku, precio_unitario, score, fecha_cierre)
  select b.codigo, b.item_id, p_cliente, b.nombre_solicitado, b.cantidad,
         b.inv_id, b.nombre_producto, b.sku, b.precio_unitario, round((b.sim*100)::numeric,1), b.fecha_cierre
  from (
    select distinct on (i.id)
           ca.codigo, i.id as item_id, i.nombre_producto as nombre_solicitado, i.cantidad,
           ca.fecha_cierre, m.id as inv_id, m.nombre_producto, m.sku, m.precio_unitario, m.sim
    from public.compras_agiles ca
    join public.compras_agiles_items i on i.compra_agil_id = ca.id
    cross join lateral (
      select id, nombre_producto, sku, precio_unitario,
        least(1.0::real,
          public.match_sim(nombre_norm, codigo_producto, i.nombre_norm, i.codigo_producto)
          + (case when marca is not null and btrim(marca) <> ''
                    and i.nombre_norm like '%' || public.f_unaccent(lower(marca)) || '%'
                  then 0.15::real else 0::real end)
          + (case when palabras_clave is not null and exists (
                    select 1 from unnest(palabras_clave) k
                    where length(btrim(k)) >= 3
                      and i.nombre_norm like '%' || public.f_unaccent(lower(btrim(k))) || '%')
                  then 0.10::real else 0::real end)
        ) as sim
      from public.cliente_inventario
      where cliente_id = p_cliente and i.nombre_norm is not null
        and (nombre_norm %>> i.nombre_norm or (i.codigo_producto is not null and codigo_producto = i.codigo_producto))
      order by sim desc limit 1
    ) m
    where ca.fecha_cierre >= now() and ca.estado ilike 'publicada' and i.nombre_norm is not null
    order by i.id, m.sim desc
  ) b
  where b.sim >= p_umbral
  on conflict (item_id, cliente_id) do update
    set inventario_id=excluded.inventario_id, nombre_producto=excluded.nombre_producto, sku=excluded.sku,
        precio_unitario=excluded.precio_unitario, score=excluded.score, fecha_cierre=excluded.fecha_cierre,
        nombre_solicitado=excluded.nombre_solicitado, cantidad=excluded.cantidad, updated_at=now();
  get diagnostics n = row_count;
  return n;
end
$$;

create or replace function public.generar_matches_ca(p_cliente uuid, p_umbral real default 0.45)
returns integer
language plpgsql set search_path to 'public', 'extensions'
as $$
declare n integer;
begin
  perform set_config('pg_trgm.strict_word_similarity_threshold', '0.45', true);
  insert into public.ca_matches (compra_agil_codigo, cliente_id, inventario_id, score, listo,
                                 nombre_pedido, nombre_producto, precio_unitario, fecha_cierre)
  select b.codigo, p_cliente, b.inv_id, round((b.sim*100)::numeric,1), (b.sim>=p_umbral),
         b.nombre, b.nombre_producto, b.precio_unitario, b.fecha_cierre
  from (
    select distinct on (t.codigo)
           t.codigo, t.nombre, t.fecha_cierre, m.id as inv_id, m.nombre_producto, m.precio_unitario, m.sim
    from (
      select ca.codigo, ca.nombre, ca.fecha_cierre, i.nombre_norm as texto, i.codigo_producto as cod
      from public.compras_agiles ca
      join public.compras_agiles_items i on i.compra_agil_id = ca.id
      where ca.fecha_cierre >= now() and ca.estado ilike 'publicada' and i.nombre_norm is not null
      union all
      select ca.codigo, ca.nombre, ca.fecha_cierre,
             public.f_unaccent(lower(nullif(trim(regexp_replace(regexp_replace(regexp_replace(
               ca.nombre,'\([^)]*\)',' ','g'),'[0-9]{2,}[-–][0-9–-]{3,}',' ','g'),'[[:space:]]+',' ','g')),''))) as texto,
             null as cod
      from public.compras_agiles ca
      where ca.fecha_cierre >= now() and ca.estado ilike 'publicada' and ca.nombre is not null
        and not exists (select 1 from public.compras_agiles_items i where i.compra_agil_id = ca.id)
    ) t
    cross join lateral (
      select id, nombre_producto, precio_unitario,
        least(1.0::real,
          public.match_sim(nombre_norm, codigo_producto, t.texto, t.cod)
          + (case when marca is not null and btrim(marca) <> ''
                    and t.texto like '%' || public.f_unaccent(lower(marca)) || '%'
                  then 0.15::real else 0::real end)
          + (case when palabras_clave is not null and exists (
                    select 1 from unnest(palabras_clave) k
                    where length(btrim(k)) >= 3
                      and t.texto like '%' || public.f_unaccent(lower(btrim(k))) || '%')
                  then 0.10::real else 0::real end)
        ) as sim
      from public.cliente_inventario
      where cliente_id = p_cliente and t.texto is not null
        and (nombre_norm %>> t.texto or (t.cod is not null and codigo_producto = t.cod))
      order by sim desc limit 1
    ) m
    order by t.codigo, m.sim desc
  ) b
  on conflict (compra_agil_codigo, cliente_id) do update
    set inventario_id=excluded.inventario_id, score=excluded.score, listo=excluded.listo,
        nombre_producto=excluded.nombre_producto, precio_unitario=excluded.precio_unitario,
        fecha_cierre=excluded.fecha_cierre;
  get diagnostics n = row_count; return n;
end $$;

create or replace function public.generar_matches_lic_items_cliente(p_cliente uuid, p_umbral real default 0.30)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare n integer;
begin
  perform set_config('pg_trgm.strict_word_similarity_threshold', '0.45', true);
  insert into public.lic_item_matches (licitacion_codigo, item_id, cliente_id, nombre_solicitado, cantidad,
                                        inventario_id, nombre_producto, sku, precio_unitario, score, fecha_cierre)
  select b.codigo, b.item_id, p_cliente, b.nombre_solicitado, b.cantidad,
         b.inv_id, b.nombre_producto, b.sku, b.precio_unitario, round((b.sim*100)::numeric,1), b.fecha_cierre
  from (
    select distinct on (it.id)
           l.codigo, it.id as item_id, it.nombre_producto as nombre_solicitado, it.cantidad,
           l.fecha_cierre, m.id as inv_id, m.nombre_producto, m.sku, m.precio_unitario, m.sim
    from public.licitaciones_bi l
    join public.licitaciones_bi_items it on it.licitacion_id = l.id
    cross join lateral (
      select id, nombre_producto, sku, precio_unitario,
             public.match_sim(nombre_norm, codigo_producto, it.nombre_norm, it.codigo_producto) as sim
      from public.cliente_inventario
      where cliente_id = p_cliente and it.nombre_norm is not null
        and (nombre_norm %>> it.nombre_norm or (it.codigo_producto is not null and codigo_producto = it.codigo_producto))
      order by sim desc limit 1
    ) m
    where (l.estado is null or l.estado ilike 'publicada' or l.estado ilike 'activa')
      and l.fecha_cierre > now() and it.nombre_norm is not null
    order by it.id, m.sim desc
  ) b
  where b.sim >= p_umbral
  on conflict (item_id, cliente_id) do update
    set inventario_id=excluded.inventario_id, nombre_producto=excluded.nombre_producto, sku=excluded.sku,
        precio_unitario=excluded.precio_unitario, score=excluded.score, fecha_cierre=excluded.fecha_cierre,
        nombre_solicitado=excluded.nombre_solicitado, cantidad=excluded.cantidad, updated_at=now();
  get diagnostics n = row_count;
  return n;
end
$$;

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
      where (it.nombre_norm is not null and ci.nombre_norm %>> it.nombre_norm)
         or (it.codigo_producto is not null and ci.codigo_producto = it.codigo_producto)
    ) m
    where o.tiene_items
    group by o.codigo
  ),
  por_titulo as (
    select o.codigo,
      coalesce((select strict_word_similarity(ci.nombre_norm, o.texto)
        from public.cliente_inventario ci
        where o.texto is not null and ci.nombre_norm %>> o.texto
        order by ci.nombre_norm <->>> o.texto limit 1), 0::real) as sim
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
  perform set_config('pg_trgm.strict_word_similarity_threshold', '0.35', true);
  with por_item as (
    select l.codigo, max(m.sim) as sim
    from public.licitaciones_bi l
    join public.licitaciones_bi_items it on it.licitacion_id = l.id
    cross join lateral (
      select coalesce(max(public.match_sim(ci.nombre_norm, ci.codigo_producto, it.nombre_norm, it.codigo_producto)), 0::real) as sim
      from public.cliente_inventario ci
      where (it.nombre_norm is not null and ci.nombre_norm %>> it.nombre_norm)
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
