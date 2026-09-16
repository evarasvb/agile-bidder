-- Paso 2 del caso ferretería: el match de compras ágiles ahora pondera MARCA y
-- PALABRAS CLAVE del inventario, no solo el nombre.
--
-- Diseño conservador (no baja la precisión):
--  * El conjunto de candidatos NO cambia: se sigue filtrando por similitud de
--    texto (word_similarity / pg_trgm) o por código ONU. Marca y palabras clave
--    NO agregan candidatos nuevos por sí solas.
--  * Solo SUMAN un bonus al puntaje cuando la marca del producto (p. ej. "Bosch")
--    o alguna de sus palabras clave aparece en el nombre solicitado. Así, entre
--    dos productos con texto parecido, gana el de la marca correcta, y un item
--    borderline con marca correcta cruza el umbral.
--  * El bonus por marca (+0.15) pesa más que el de palabra clave (+0.10). El
--    puntaje se topa en 1.0. Un match SOLO por marca/keyword (texto 0) no alcanza
--    el umbral (0.30), así que no genera falsos positivos.
--
-- Se comparan marca/keywords normalizadas con f_unaccent(lower(...)) contra el
-- nombre normalizado del pedido (nombre_norm / texto), igual criterio que el resto.

-- Nivel ITEM (lo que alimenta la columna "Oportunidades" del inventario y la bandeja).
CREATE OR REPLACE FUNCTION public.generar_matches_ca_items(p_cliente uuid, p_umbral real DEFAULT 0.30)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
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
          (case when i.codigo_producto is not null and codigo_producto is not null and codigo_producto = i.codigo_producto
               then 0.5::real + 0.5::real * coalesce(word_similarity(nombre_norm, i.nombre_norm), 0::real)
               else coalesce(word_similarity(nombre_norm, i.nombre_norm), 0::real) end)
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
        and (nombre_norm %> i.nombre_norm or (i.codigo_producto is not null and codigo_producto = i.codigo_producto))
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
$function$;

-- Nivel COMPRA (mejor producto para toda la compra ágil).
CREATE OR REPLACE FUNCTION public.generar_matches_ca(p_cliente uuid, p_umbral real DEFAULT 0.45)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
declare n integer;
begin
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
          (case when t.cod is not null and codigo_producto is not null and codigo_producto = t.cod
               then 0.5::real + 0.5::real * coalesce(word_similarity(nombre_norm, t.texto), 0::real)
               else coalesce(word_similarity(nombre_norm, t.texto), 0::real) end)
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
        and (nombre_norm %> t.texto or (t.cod is not null and codigo_producto = t.cod))
      order by sim desc limit 1
    ) m
    order by t.codigo, m.sim desc
  ) b
  on conflict (compra_agil_codigo, cliente_id) do update
    set inventario_id=excluded.inventario_id, score=excluded.score, listo=excluded.listo,
        nombre_producto=excluded.nombre_producto, precio_unitario=excluded.precio_unitario,
        fecha_cierre=excluded.fecha_cierre;
  get diagnostics n = row_count; return n;
end
$function$;
