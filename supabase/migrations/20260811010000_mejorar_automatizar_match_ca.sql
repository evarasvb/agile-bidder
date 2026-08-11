-- =====================================================================
-- Mejora + automatización del match de Compras Ágiles (tabla ca_matches)
-- =====================================================================
-- Contexto: el match lo genera la función generar_matches_ca (similitud de
-- trigramas del título de la compra vs. inventario del cliente). Antes:
--   - Umbral 0.35 => poca cobertura (solo ~9 de las activas con match).
--   - Corría a mano (una sola vez).
-- Con esta migración: umbral 0.30 (más cobertura: ~23 de 76 activas) y el
-- match corre solo cada hora vía pg_cron.
-- Nota: las compras ágiles activas no traen ítems extraídos, así que el match
-- se basa en el título; la calidad tope está limitada por esos datos.

-- 1. Función mejorada: más cobertura (umbral 0.30). Mantiene el mejor producto
--    por compra (1 por compra/cliente, que es lo que consume el Panel).
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
  FROM (SELECT codigo, nombre, fecha_cierre FROM public.compras_agiles
        WHERE fecha_cierre >= now()
          AND estado ILIKE 'publicada' AND nombre IS NOT NULL) ca
  CROSS JOIN LATERAL (
    SELECT id, nombre_producto, precio_unitario, word_similarity(nombre_producto, ca.nombre) AS sim
    FROM public.cliente_inventario
    WHERE cliente_id = p_cliente AND nombre_producto %> ca.nombre
    ORDER BY nombre_producto <->> ca.nombre
    LIMIT 1
  ) m
  ON CONFLICT (compra_agil_codigo, cliente_id) DO UPDATE
    SET inventario_id=excluded.inventario_id, score=excluded.score, listo=excluded.listo,
        nombre_producto=excluded.nombre_producto, precio_unitario=excluded.precio_unitario,
        fecha_cierre=excluded.fecha_cierre;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;

-- 2. Wrapper: corre el match para todos los clientes de una pasada.
CREATE OR REPLACE FUNCTION public.generar_matches_ca_todos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE c record; total integer := 0;
BEGIN
  FOR c IN SELECT id FROM public.clientes LOOP
    total := total + public.generar_matches_ca(c.id, 0.30);
  END LOOP;
  RETURN total;
END $function$;

-- 3. Automatización con pg_cron: correr el match cada hora (minuto 7).
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'match-ca-horario') THEN
    PERFORM cron.unschedule('match-ca-horario');
  END IF;
  PERFORM cron.schedule('match-ca-horario', '7 * * * *',
                        $$ SELECT public.generar_matches_ca_todos(); $$);
END $cron$;
