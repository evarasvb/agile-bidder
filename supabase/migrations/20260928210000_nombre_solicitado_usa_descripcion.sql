-- Bug de datos (no de matching): en compras_agiles_items y licitaciones_bi_items,
-- nombre_producto casi siempre es el nombre genérico de la categoría (ONU/UNSPSC,
-- igual para todos los ítems de una misma compra: ej. "Papel para fotocopiadora o
-- impresora" repetido en los 12 ítems de una compra que en realidad son sobre,
-- plumón, marcador, archivador, caja, papel, funda, lápiz...), mientras que
-- descripcion_producto/descripcion trae el texto real y distinto por ítem.
-- match_sim ya usa nombre_norm (que prioriza descripcion_producto/descripcion,
-- ver 20260916050000) para calcular el score, así que el match en sí es correcto.
-- Pero generar_matches_ca_items y generar_matches_lic_items_cliente guardaban
-- nombre_solicitado = i.nombre_producto (el genérico), no lo que realmente se pidió.
-- Resultado: el cliente ve "Solicitaron: Papel para fotocopiadora o impresora" con
-- un match de "Marcador de Pizarra" y parece un error, cuando el sistema sí acertó
-- sobre el texto real. Afecta ~99% de los ítems (94.655/94.733 en compras ágiles,
-- 75.560/76.233 en licitaciones) — no es un caso raro, es el patrón normal.
-- Se muestra en GenerarPropuestaModal (src/hooks/useCaItemMatches.ts, useLicItemMatches.ts).

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
           ca.codigo, i.id as item_id,
           coalesce(nullif(trim(i.descripcion_producto),''), i.nombre_producto) as nombre_solicitado,
           i.cantidad,
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
           l.codigo, it.id as item_id,
           coalesce(nullif(trim(it.descripcion),''), it.nombre_producto) as nombre_solicitado,
           it.cantidad,
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

-- Backfill inmediato de lo ya calculado (si no, queda con el nombre genérico hasta
-- el próximo cron match-ca-items-horario/match-lic-items-cliente-horario).
update public.ca_item_matches m
set nombre_solicitado = coalesce(nullif(trim(i.descripcion_producto),''), i.nombre_producto)
from public.compras_agiles_items i
where i.id = m.item_id
  and coalesce(nullif(trim(i.descripcion_producto),''), i.nombre_producto) is distinct from m.nombre_solicitado;

update public.lic_item_matches m
set nombre_solicitado = coalesce(nullif(trim(it.descripcion),''), it.nombre_producto)
from public.licitaciones_bi_items it
where it.id = m.item_id
  and coalesce(nullif(trim(it.descripcion),''), it.nombre_producto) is distinct from m.nombre_solicitado;
