-- Match producto-por-producto cuando la compra ágil tiene ítems.
-- Si compras_agiles_items tiene ítems de la compra, se matchea cada ítem contra
-- el inventario y se toma el mejor; si no hay ítems, se cae al título normalizado
-- (comportamiento anterior). Esto habilita el salto de calidad del match cuando
-- la extensión empieza a poblar los ítems (ver fix en la edge function
-- sync-compras-agiles). Sin ítems, el resultado es idéntico al anterior.
CREATE OR REPLACE FUNCTION public.generar_matches_ca(p_cliente uuid, p_umbral real DEFAULT 0.30)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE n integer;
BEGIN
  PERFORM set_config('pg_trgm.word_similarity_threshold', p_umbral::text, true);

  INSERT INTO public.ca_matches (compra_agil_codigo, cliente_id, inventario_id, score, listo,
                                 nombre_pedido, nombre_producto, precio_unitario, fecha_cierre)
  SELECT b.codigo, p_cliente, b.inv_id, round((b.sim*100)::numeric,1), (b.sim>=0.55),
         b.nombre, b.nombre_producto, b.precio_unitario, b.fecha_cierre
  FROM (
    SELECT DISTINCT ON (t.codigo)
           t.codigo, t.nombre, t.fecha_cierre, m.id AS inv_id, m.nombre_producto, m.precio_unitario, m.sim
    FROM (
      -- 1) Producto por producto cuando la compra tiene ítems
      SELECT ca.codigo, ca.nombre, ca.fecha_cierre, i.nombre_producto AS texto
      FROM public.compras_agiles ca
      JOIN public.compras_agiles_items i ON i.compra_agil_id = ca.id
      WHERE ca.fecha_cierre >= now() AND ca.estado ILIKE 'publicada'
        AND i.nombre_producto IS NOT NULL
      UNION ALL
      -- 2) Título normalizado cuando NO hay ítems (quita códigos y paréntesis)
      SELECT ca.codigo, ca.nombre, ca.fecha_cierre,
             nullif(trim(regexp_replace(regexp_replace(regexp_replace(
               upper(ca.nombre), '\([^)]*\)', ' ', 'g'),
               '[0-9]{2,}[-–][0-9–-]{3,}', ' ', 'g'),
               '[[:space:]]+', ' ', 'g')), '') AS texto
      FROM public.compras_agiles ca
      WHERE ca.fecha_cierre >= now() AND ca.estado ILIKE 'publicada' AND ca.nombre IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.compras_agiles_items i WHERE i.compra_agil_id = ca.id)
    ) t
    CROSS JOIN LATERAL (
      SELECT id, nombre_producto, precio_unitario, word_similarity(nombre_producto, t.texto) AS sim
      FROM public.cliente_inventario
      WHERE cliente_id = p_cliente AND t.texto IS NOT NULL AND nombre_producto %> t.texto
      ORDER BY nombre_producto <->> t.texto
      LIMIT 1
    ) m
    ORDER BY t.codigo, m.sim DESC
  ) b
  ON CONFLICT (compra_agil_codigo, cliente_id) DO UPDATE
    SET inventario_id=excluded.inventario_id, score=excluded.score, listo=excluded.listo,
        nombre_producto=excluded.nombre_producto, precio_unitario=excluded.precio_unitario,
        fecha_cierre=excluded.fecha_cierre;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;
