-- Sinónimos del match de compra ágil (y licitaciones) reactivados.
--
-- cliente_inventario.busqueda_match (nombre + palabras_clave/sinónimos, con su índice
-- trigram) se creó en 20260813010000_match_ca_sinonimos_negativas.sql, pero las reescrituras
-- posteriores de generar_matches_ca_items/generar_matches_ca/generar_matches_lic_*
-- (20260915213000 en adelante) dejaron de usarlo: match_sim() solo compara nombre_norm
-- (el nombre real del producto), así que un pedido como "cartucho de tinta" nunca calzaba
-- con un producto "Tóner HP" aunque "cartucho de tinta" estuviera entre sus sinónimos.
-- El bono de +0.10 que se agregó después solo exige que la palabra clave aparezca LITERAL
-- en el texto pedido (dirección contraria a un sinónimo real, y solo aplica a candidatos
-- que ya pasaron el filtro por nombre) — no resolvía el caso.
--
-- Esta migración:
--  1) Normaliza busqueda_match con f_unaccent (igual que nombre_norm en ambos lados;
--     antes "tóner" en el sinónimo no calzaba con "toner" en el pedido, ya sin tilde).
--  2) match_sim() ahora toma el MEJOR puntaje entre nombre real y sinónimos (busqueda_match),
--     y el filtro trigram de cada función deja pasar un candidato si alguno de los dos calza.
--  3) Se recalculan los matches abiertos; los cron de match-ca-horario / match-ca-items-horario
--     (cada 20 min) los rellenan solos con la regla nueva.

-- ── 1) busqueda_match normalizado (sin tilde), igual criterio que nombre_norm ───────────
create or replace function public.cliente_inventario_set_busqueda()
returns trigger language plpgsql as $$
begin
  new.busqueda_match := public.f_unaccent(lower(coalesce(new.nombre_producto, '') || ' ' ||
                                          coalesce(array_to_string(new.palabras_clave, ' '), '')));
  return new;
end $$;

update public.cliente_inventario
set busqueda_match = public.f_unaccent(lower(coalesce(nombre_producto, '') || ' ' ||
                                        coalesce(array_to_string(palabras_clave, ' '), '')));

-- ── 2) match_sim con sinónimos: greatest(similitud por nombre [+ bono código], similitud por sinónimos) ──
create or replace function public.match_sim(
  p_inv_norm text, p_inv_busqueda text, p_inv_cod text, p_item_norm text, p_item_cod text
) returns real language sql immutable as $$
  select case
    when p_item_norm is null then 0::real
    else greatest(
      case
        when p_inv_norm is null then 0::real
        when p_inv_cod is not null and p_item_cod is not null and p_inv_cod = p_item_cod
             and strict_word_similarity(p_inv_norm, p_item_norm) >= 0.30
          then 0.5::real + 0.5::real * strict_word_similarity(p_inv_norm, p_item_norm)
        else strict_word_similarity(p_inv_norm, p_item_norm)
      end,
      -- Sinónimos: se compara sin exigir borde de palabra estricto (word_similarity, no
      -- strict_word_similarity) porque un sinónimo suele ser una frase suelta, no
      -- gramaticalmente calzada con el pedido.
      case when p_inv_busqueda is null then 0::real else word_similarity(p_item_norm, p_inv_busqueda) end
    )
  end;
$$;

-- ===== Compras ágiles: ítem por ítem, por cliente =====
create or replace function public.generar_matches_ca_items(p_cliente uuid, p_umbral real default 0.30)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare n integer;
begin
  perform set_config('pg_trgm.strict_word_similarity_threshold', '0.45', true);
  perform set_config('pg_trgm.word_similarity_threshold', '0.45', true);
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
          public.match_sim(nombre_norm, busqueda_match, codigo_producto, i.nombre_norm, i.codigo_producto)
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
        and (nombre_norm %>> i.nombre_norm or busqueda_match %> i.nombre_norm
             or (i.codigo_producto is not null and codigo_producto = i.codigo_producto))
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

-- ===== Compras ágiles: mejor match a nivel de compra, por cliente =====
create or replace function public.generar_matches_ca(p_cliente uuid, p_umbral real default 0.45)
returns integer
language plpgsql set search_path to 'public', 'extensions'
as $$
declare n integer;
begin
  perform set_config('pg_trgm.strict_word_similarity_threshold', '0.45', true);
  perform set_config('pg_trgm.word_similarity_threshold', '0.45', true);
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
          public.match_sim(nombre_norm, busqueda_match, codigo_producto, t.texto, t.cod)
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
        and (nombre_norm %>> t.texto or busqueda_match %> t.texto
             or (t.cod is not null and codigo_producto = t.cod))
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

-- ===== Licitaciones: ítem por ítem, por cliente =====
create or replace function public.generar_matches_lic_items_cliente(p_cliente uuid, p_umbral real default 0.30)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare n integer;
begin
  perform set_config('pg_trgm.strict_word_similarity_threshold', '0.45', true);
  perform set_config('pg_trgm.word_similarity_threshold', '0.45', true);
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
             public.match_sim(nombre_norm, busqueda_match, codigo_producto, it.nombre_norm, it.codigo_producto) as sim
      from public.cliente_inventario
      where cliente_id = p_cliente and it.nombre_norm is not null
        and (nombre_norm %>> it.nombre_norm or busqueda_match %> it.nombre_norm
             or (it.codigo_producto is not null and codigo_producto = it.codigo_producto))
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

-- ===== Licitaciones: match global (todas las inventarios), pendientes =====
create or replace function public.generar_matches_lic_pendientes(p_umbral real default 0.45, p_limite integer default 300)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare n int;
begin
  perform set_config('statement_timeout', '300000', true);
  perform set_config('pg_trgm.strict_word_similarity_threshold', '0.35', true);
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
      select coalesce(max(public.match_sim(ci.nombre_norm, ci.busqueda_match, ci.codigo_producto, it.nombre_norm, it.codigo_producto)), 0::real) as sim
      from public.cliente_inventario ci
      where it.nombre_norm is not null
        and (ci.nombre_norm %>> it.nombre_norm or ci.busqueda_match %> it.nombre_norm)
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

-- ===== Licitaciones: match global (todos los inventarios) por lote =====
create or replace function public.generar_matches_lic_items(p_umbral real default 0.45, p_buckets integer default 1, p_bucket integer default 0)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare n integer;
begin
  perform set_config('pg_trgm.strict_word_similarity_threshold', '0.35', true);
  perform set_config('pg_trgm.word_similarity_threshold', '0.35', true);
  with por_item as (
    select l.codigo, max(m.sim) as sim
    from public.licitaciones_bi l
    join public.licitaciones_bi_items it on it.licitacion_id = l.id
    cross join lateral (
      select coalesce(max(public.match_sim(ci.nombre_norm, ci.busqueda_match, ci.codigo_producto, it.nombre_norm, it.codigo_producto)), 0::real) as sim
      from public.cliente_inventario ci
      where it.nombre_norm is not null
        and (ci.nombre_norm %>> it.nombre_norm or ci.busqueda_match %> it.nombre_norm)
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

-- ── 3) Recalcular lo abierto con sinónimos; los crones (cada 20 min) lo rellenan solos ──
delete from public.ca_item_matches m using public.compras_agiles ca
 where ca.codigo = m.compra_agil_codigo and ca.fecha_cierre > now();
delete from public.ca_matches m using public.compras_agiles ca
 where ca.codigo = m.compra_agil_codigo and ca.fecha_cierre > now();
delete from public.lic_item_matches m using public.licitaciones_bi l
 where l.codigo = m.licitacion_codigo and l.fecha_cierre > now();
update public.licitaciones_bi set match_score = null where fecha_cierre > now();
