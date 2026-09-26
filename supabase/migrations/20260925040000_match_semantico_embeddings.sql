-- Paso 1 del match semántico, parte B: la fórmula. Calibrada el 25-09-2026 con 649
-- ítems de compras ágiles y 300 productos vectorizados (gemini-embedding-001, 768 d):
--   coseno >= 0.80  -> mismo producto (plumón pizarra rojo vs blister plumón pizarra rojo 0.81,
--                      tijeras oficina vs tijera 0.80, calculadora vs calculadora 0.85)
--   0.70 - 0.80     -> misma familia, no siempre el mismo producto
--   <= 0.65         -> ruido (el piso de pares al azar está en 0.53-0.60)
-- Mapeo lineal: sem = (cos - 0.68) / 0.18, acotado a [0,1]  (0.70->0.11, 0.75->0.39,
-- 0.80->0.67, 0.86->1). El puntaje final es el mayor entre el texto (trigramas + sinónimos,
-- igual que antes) y el semántico; el bono por código ONU se aplica igual que al texto
-- (solo si la similitud ya es >= 0.30). Cuando falta un vector, queda el texto: nada
-- empeora mientras el robot embed-items termina de vectorizar.
-- Candidatos: a los de trigramas/sinónimos/código se suman los 5 vecinos más cercanos por
-- vector (HNSW con iterative scan, pgvector 0.8) para que aparezcan productos que no
-- comparten ninguna palabra con el ítem.

create or replace function public.match_sim_v3(
  p_inv_norm text, p_inv_busqueda text, p_inv_cod text, p_inv_emb extensions.vector,
  p_item_norm text, p_item_cod text, p_item_emb extensions.vector)
returns real language sql immutable as $$
  with s as (
    select public.match_sim(p_inv_norm, p_inv_busqueda, p_inv_cod, p_item_norm, p_item_cod) as texto,
           case when p_inv_emb is null or p_item_emb is null then 0::real
                else least(1::real, greatest(0::real,
                  (((1 - (p_inv_emb operator(extensions.<=>) p_item_emb)) - 0.68) / 0.18)::real)) end as sem
  )
  select greatest(texto,
           case when p_inv_cod is not null and p_item_cod is not null and p_inv_cod = p_item_cod and sem >= 0.30
                then 0.5::real + 0.5::real * sem else sem end)
  from s;
$$;

create or replace function public.generar_matches_ca_items(p_cliente uuid, p_umbral real default 0.30)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare n integer;
begin
  perform set_config('pg_trgm.strict_word_similarity_threshold', '0.45', true);
  perform set_config('pg_trgm.word_similarity_threshold', '0.45', true);
  perform set_config('hnsw.ef_search', '100', true);
  perform set_config('hnsw.iterative_scan', 'relaxed_order', true);
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
      select ci.id, ci.nombre_producto, ci.sku, ci.precio_unitario,
        least(1.0::real,
          public.match_sim_v3(ci.nombre_norm, ci.busqueda_match, ci.codigo_producto, ci.embedding,
                              i.nombre_norm, i.codigo_producto, i.embedding)
          + (case when ci.marca is not null and btrim(ci.marca) <> ''
                    and i.nombre_norm like '%' || public.f_unaccent(lower(ci.marca)) || '%'
                  then 0.15::real else 0::real end)
          + (case when ci.palabras_clave is not null and exists (
                    select 1 from unnest(ci.palabras_clave) k
                    where length(btrim(k)) >= 3
                      and i.nombre_norm like '%' || public.f_unaccent(lower(btrim(k))) || '%')
                  then 0.10::real else 0::real end)
        ) as sim
      from (
        select c1.id from public.cliente_inventario c1
        where c1.cliente_id = p_cliente
          and (c1.nombre_norm %>> i.nombre_norm or c1.busqueda_match %> i.nombre_norm
               or (i.codigo_producto is not null and c1.codigo_producto = i.codigo_producto))
        union
        select c2.id from (
          select c3.id from public.cliente_inventario c3
          where c3.cliente_id = p_cliente and c3.embedding is not null and i.embedding is not null
          order by c3.embedding operator(extensions.<=>) i.embedding
          limit 5
        ) c2
      ) cand
      join public.cliente_inventario ci on ci.id = cand.id
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
end $$;

create or replace function public.generar_matches_ca(p_cliente uuid, p_umbral real default 0.45)
returns integer
language plpgsql set search_path to 'public', 'extensions'
as $$
declare n integer;
begin
  perform set_config('pg_trgm.strict_word_similarity_threshold', '0.45', true);
  perform set_config('pg_trgm.word_similarity_threshold', '0.45', true);
  perform set_config('hnsw.ef_search', '100', true);
  perform set_config('hnsw.iterative_scan', 'relaxed_order', true);
  insert into public.ca_matches (compra_agil_codigo, cliente_id, inventario_id, score, listo,
                                 nombre_pedido, nombre_producto, precio_unitario, fecha_cierre)
  select b.codigo, p_cliente, b.inv_id, round((b.sim*100)::numeric,1), (b.sim>=p_umbral),
         b.nombre, b.nombre_producto, b.precio_unitario, b.fecha_cierre
  from (
    select distinct on (t.codigo)
           t.codigo, t.nombre, t.fecha_cierre, m.id as inv_id, m.nombre_producto, m.precio_unitario, m.sim
    from (
      select ca.codigo, ca.nombre, ca.fecha_cierre, i.nombre_norm as texto, i.codigo_producto as cod, i.embedding as emb
      from public.compras_agiles ca
      join public.compras_agiles_items i on i.compra_agil_id = ca.id
      where ca.fecha_cierre >= now() and ca.estado ilike 'publicada' and i.nombre_norm is not null
      union all
      select ca.codigo, ca.nombre, ca.fecha_cierre,
             public.f_unaccent(lower(nullif(trim(regexp_replace(regexp_replace(regexp_replace(
               ca.nombre,'\([^)]*\)',' ','g'),'[0-9]{2,}[-–][0-9–-]{3,}',' ','g'),'[[:space:]]+',' ','g')),''))) as texto,
             null as cod, null::extensions.vector as emb
      from public.compras_agiles ca
      where ca.fecha_cierre >= now() and ca.estado ilike 'publicada' and ca.nombre is not null
        and not exists (select 1 from public.compras_agiles_items i where i.compra_agil_id = ca.id)
    ) t
    cross join lateral (
      select ci.id, ci.nombre_producto, ci.precio_unitario,
        least(1.0::real,
          public.match_sim_v3(ci.nombre_norm, ci.busqueda_match, ci.codigo_producto, ci.embedding, t.texto, t.cod, t.emb)
          + (case when ci.marca is not null and btrim(ci.marca) <> ''
                    and t.texto like '%' || public.f_unaccent(lower(ci.marca)) || '%'
                  then 0.15::real else 0::real end)
          + (case when ci.palabras_clave is not null and exists (
                    select 1 from unnest(ci.palabras_clave) k
                    where length(btrim(k)) >= 3
                      and t.texto like '%' || public.f_unaccent(lower(btrim(k))) || '%')
                  then 0.10::real else 0::real end)
        ) as sim
      from (
        select c1.id from public.cliente_inventario c1
        where c1.cliente_id = p_cliente and t.texto is not null
          and (c1.nombre_norm %>> t.texto or c1.busqueda_match %> t.texto
               or (t.cod is not null and c1.codigo_producto = t.cod))
        union
        select c2.id from (
          select c3.id from public.cliente_inventario c3
          where c3.cliente_id = p_cliente and c3.embedding is not null and t.emb is not null
          order by c3.embedding operator(extensions.<=>) t.emb
          limit 5
        ) c2
      ) cand
      join public.cliente_inventario ci on ci.id = cand.id
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
  perform set_config('pg_trgm.word_similarity_threshold', '0.45', true);
  perform set_config('hnsw.ef_search', '100', true);
  perform set_config('hnsw.iterative_scan', 'relaxed_order', true);
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
      select ci.id, ci.nombre_producto, ci.sku, ci.precio_unitario,
             public.match_sim_v3(ci.nombre_norm, ci.busqueda_match, ci.codigo_producto, ci.embedding,
                                 it.nombre_norm, it.codigo_producto, it.embedding) as sim
      from (
        select c1.id from public.cliente_inventario c1
        where c1.cliente_id = p_cliente
          and (c1.nombre_norm %>> it.nombre_norm or c1.busqueda_match %> it.nombre_norm
               or (it.codigo_producto is not null and c1.codigo_producto = it.codigo_producto))
        union
        select c2.id from (
          select c3.id from public.cliente_inventario c3
          where c3.cliente_id = p_cliente and c3.embedding is not null and it.embedding is not null
          order by c3.embedding operator(extensions.<=>) it.embedding
          limit 5
        ) c2
      ) cand
      join public.cliente_inventario ci on ci.id = cand.id
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
end $$;

-- Match global (sin cliente): máximo contra todo el inventario.
create or replace function public.generar_matches_lic_pendientes(p_umbral real default 0.45, p_limite integer default 300)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare n int;
begin
  perform set_config('statement_timeout', '300000', true);
  perform set_config('pg_trgm.strict_word_similarity_threshold', '0.35', true);
  perform set_config('pg_trgm.word_similarity_threshold', '0.35', true);
  perform set_config('hnsw.ef_search', '100', true);
  perform set_config('hnsw.iterative_scan', 'relaxed_order', true);
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
      select coalesce(max(public.match_sim_v3(ci.nombre_norm, ci.busqueda_match, ci.codigo_producto, ci.embedding,
                                              it.nombre_norm, it.codigo_producto, it.embedding)), 0::real) as sim
      from (
        select c1.id from public.cliente_inventario c1
        where it.nombre_norm is not null
          and (c1.nombre_norm %>> it.nombre_norm or c1.busqueda_match %> it.nombre_norm)
        union
        select c2.id from (
          select c3.id from public.cliente_inventario c3
          where c3.embedding is not null and it.embedding is not null
          order by c3.embedding operator(extensions.<=>) it.embedding
          limit 5
        ) c2
      ) cand
      join public.cliente_inventario ci on ci.id = cand.id
    ) m
    where o.tiene_items
    group by o.codigo
  ),
  por_titulo as (
    select o.codigo,
      coalesce((select greatest(
                  strict_word_similarity(ci.nombre_norm, o.texto),
                  case when ci.busqueda_match is null then 0::real else word_similarity(o.texto, ci.busqueda_match) end
                )
        from public.cliente_inventario ci
        where o.texto is not null
          and (ci.nombre_norm %>> o.texto or ci.busqueda_match %> o.texto)
        order by greatest(
                   strict_word_similarity(ci.nombre_norm, o.texto),
                   case when ci.busqueda_match is null then 0::real else word_similarity(o.texto, ci.busqueda_match) end
                 ) desc limit 1), 0::real) as sim
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
  perform set_config('pg_trgm.word_similarity_threshold', '0.35', true);
  perform set_config('hnsw.ef_search', '100', true);
  perform set_config('hnsw.iterative_scan', 'relaxed_order', true);
  with por_item as (
    select l.codigo, max(m.sim) as sim
    from public.licitaciones_bi l
    join public.licitaciones_bi_items it on it.licitacion_id = l.id
    cross join lateral (
      select coalesce(max(public.match_sim_v3(ci.nombre_norm, ci.busqueda_match, ci.codigo_producto, ci.embedding,
                                              it.nombre_norm, it.codigo_producto, it.embedding)), 0::real) as sim
      from (
        select c1.id from public.cliente_inventario c1
        where it.nombre_norm is not null
          and (c1.nombre_norm %>> it.nombre_norm or c1.busqueda_match %> it.nombre_norm)
        union
        select c2.id from (
          select c3.id from public.cliente_inventario c3
          where c3.embedding is not null and it.embedding is not null
          order by c3.embedding operator(extensions.<=>) it.embedding
          limit 5
        ) c2
      ) cand
      join public.cliente_inventario ci on ci.id = cand.id
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
