-- Normaliza el texto de la compra antes de matchear: quita los códigos internos
-- (ej. "03-002-340-0310") y el contenido entre paréntesis (ej. "(presentar
-- ficha técnica...)"), que ensucian la similitud de trigramas. Así el match se
-- enfoca en el nombre real del producto.
-- Ganancia medida: cobertura de compras ágiles activas con match 23 -> 24/76.
-- (El techo de calidad sigue limitado porque las activas no traen ítems
--  estructurados y muchas son productos fuera del catálogo del cliente.)
CREATE OR REPLACE FUNCTION public.generar_matches_ca(p_cliente uuid, p_umbral real DEFAULT 0.30)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE n integer;
BEGIN
  PERFORM set_config('pg_trgm.word_similarity_threshold', p_umbral::text, true);
  INSERT INTO public.ca_matches (compra_agil_codigo, cliente_id, inventario_id, score, listo,
                                 nombre_pedido, nombre_producto, precio_unitario, fecha_cierre)
  SELECT ca.codigo, p_cliente, m.id, round((m.sim*100)::numeric,1), (m.sim>=0.55),
         ca.nombre, m.nombre_producto, m.precio_unitario, ca.fecha_cierre
  FROM (
    SELECT codigo, nombre, fecha_cierre,
           nullif(trim(regexp_replace(
             regexp_replace(
               regexp_replace(upper(nombre), '\([^)]*\)', ' ', 'g'),
               '[0-9]{2,}[-–][0-9–-]{3,}', ' ', 'g'),
             '[[:space:]]+', ' ', 'g')), '') AS nombre_limpio
    FROM public.compras_agiles
    WHERE fecha_cierre >= now() AND estado ILIKE 'publicada' AND nombre IS NOT NULL
  ) ca
  CROSS JOIN LATERAL (
    SELECT id, nombre_producto, precio_unitario,
           word_similarity(nombre_producto, coalesce(ca.nombre_limpio, ca.nombre)) AS sim
    FROM public.cliente_inventario
    WHERE cliente_id = p_cliente
      AND nombre_producto %> coalesce(ca.nombre_limpio, ca.nombre)
    ORDER BY nombre_producto <->> coalesce(ca.nombre_limpio, ca.nombre)
    LIMIT 1
  ) m
  ON CONFLICT (compra_agil_codigo, cliente_id) DO UPDATE
    SET inventario_id=excluded.inventario_id, score=excluded.score, listo=excluded.listo,
        nombre_producto=excluded.nombre_producto, precio_unitario=excluded.precio_unitario,
        fecha_cierre=excluded.fecha_cierre;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;
