-- El código ONU igual ya no vale 100 % de match.
-- El código de producto de la ficha (ej. 14111500 "papel") es una categoría amplia: con la
-- regla anterior, "Pack de 10 libretas A7" calzaba al 100 % con "CARTULINA FLUORESCENTE"
-- solo por compartir código (56 de 280 matches nuevos el 07-09-2026 eran de este tipo).
-- Ahora el código igual aporta una base de 50 % y el resto lo pone la similitud de texto
-- contra lo que realmente piden (descripción del ítem): mismo código + texto parecido ≈ 100,
-- mismo código + texto distinto = 50 (visible pero honesto).

create or replace function public.generar_matches_ca_items(p_cliente uuid, p_umbral real default 0.30)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
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
        case when i.codigo_producto is not null and codigo_producto is not null and codigo_producto = i.codigo_producto
             then 0.5::real + 0.5::real * coalesce(word_similarity(nombre_norm, i.nombre_norm), 0::real)
             else coalesce(word_similarity(nombre_norm, i.nombre_norm), 0::real) end as sim
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
$$;

create or replace function public.generar_matches_ca(p_cliente uuid, p_umbral real default 0.45)
returns integer
language plpgsql set search_path to 'public', 'extensions'
as $$
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
        case when t.cod is not null and codigo_producto is not null and codigo_producto = t.cod
             then 0.5::real + 0.5::real * coalesce(word_similarity(nombre_norm, t.texto), 0::real)
             else coalesce(word_similarity(nombre_norm, t.texto), 0::real) end as sim
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
$$;

-- Los matches vigentes se recalculan con la fórmula nueva en la próxima pasada de los
-- crones match-ca-items-horario y match-ca-horario. Se borran los de compras abiertas para
-- que no quede ningún "100 %" solo por código.
delete from public.ca_item_matches m using public.compras_agiles ca
 where ca.codigo = m.compra_agil_codigo and ca.fecha_cierre > now();
delete from public.ca_matches m using public.compras_agiles ca
 where ca.codigo = m.compra_agil_codigo and ca.fecha_cierre > now();
