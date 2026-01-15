-- Vista para mostrar licitaciones abiertas por producto (estilo Lici)
-- ====================================================================

-- Vista que agrupa licitaciones activas por producto del inventario
CREATE OR REPLACE VIEW licitaciones_por_producto AS
WITH productos_keywords AS (
  -- Extraer keywords de cada producto del inventario
  SELECT 
    i.id as producto_id,
    i.sku,
    i.nombre_producto,
    i.categoria,
    i.keywords,
    -- Generar keywords desde nombre y categoría
    ARRAY(
      SELECT DISTINCT unnest(
        ARRAY_CAT(
          COALESCE(i.keywords, ARRAY[]::text[]),
          ARRAY[
            LOWER(i.nombre_producto),
            LOWER(i.categoria)
          ] || 
          string_to_array(LOWER(i.nombre_producto), ' ')
        )
      )
    ) as todas_keywords
  FROM inventory i
  WHERE i.activo = true
),
licitaciones_activas AS (
  -- Licitaciones y compras ágiles activas
  SELECT 
    codigo,
    nombre as titulo,
    organismo,
    monto as presupuesto,
    fecha_cierre,
    estado,
    'compra_agil' as tipo,
    link_oficial,
    match_score,
    match_encontrado,
    created_at
  FROM compras_agiles
  WHERE estado IN ('activa', 'publicada', 'abierta')
    AND (fecha_cierre IS NULL OR fecha_cierre > NOW())
  
  UNION ALL
  
  SELECT 
    id_licitacion as codigo,
    titulo,
    organismo,
    presupuesto,
    fecha_cierre,
    estado,
    'licitacion' as tipo,
    link_oficial,
    match_score,
    match_encontrado,
    created_at
  FROM licitaciones
  WHERE estado IN ('activa', 'publicada', 'abierta')
    AND (fecha_cierre IS NULL OR fecha_cierre > NOW())
),
matches AS (
  -- Calcular match entre productos e inventario
  SELECT DISTINCT
    pk.producto_id,
    pk.sku,
    pk.nombre_producto,
    pk.categoria,
    la.codigo as licitacion_codigo,
    la.titulo as licitacion_titulo,
    la.organismo,
    la.presupuesto,
    la.fecha_cierre,
    la.estado,
    la.tipo,
    la.link_oficial,
    la.match_score,
    la.match_encontrado,
    -- Calcular score de match basado en keywords
    CASE 
      WHEN la.match_encontrado = true AND la.match_score IS NOT NULL 
      THEN la.match_score
      ELSE 
        -- Match básico por keywords
        LEAST(
          100,
          (
            SELECT COUNT(*) * 20 
            FROM unnest(pk.todas_keywords) as kw
            WHERE LOWER(la.titulo) LIKE '%' || kw || '%'
          )
        )
    END as score_match
  FROM productos_keywords pk
  CROSS JOIN licitaciones_activas la
  WHERE 
    -- Match si hay keywords en común
    EXISTS (
      SELECT 1 
      FROM unnest(pk.todas_keywords) as kw
      WHERE LOWER(la.titulo) LIKE '%' || kw || '%'
    )
    OR la.match_encontrado = true
)
SELECT 
  producto_id,
  sku,
  nombre_producto,
  categoria,
  COUNT(DISTINCT licitacion_codigo) as total_licitaciones_abiertas,
  SUM(presupuesto) as presupuesto_total_estimado,
  MAX(score_match) as mejor_match_score,
  ARRAY_AGG(DISTINCT licitacion_codigo) as licitaciones_codigos,
  ARRAY_AGG(DISTINCT organismo) as organismos,
  JSON_AGG(
    DISTINCT jsonb_build_object(
      'codigo', licitacion_codigo,
      'titulo', licitacion_titulo,
      'organismo', organismo,
      'presupuesto', presupuesto,
      'fecha_cierre', fecha_cierre,
      'estado', estado,
      'tipo', tipo,
      'link_oficial', link_oficial,
      'match_score', score_match
    )
  ) as licitaciones_detalle
FROM matches
WHERE score_match >= 30  -- Solo matches con score >= 30%
GROUP BY producto_id, sku, nombre_producto, categoria
ORDER BY total_licitaciones_abiertas DESC, mejor_match_score DESC;

COMMENT ON VIEW licitaciones_por_producto IS 'Vista que muestra licitaciones abiertas agrupadas por producto del inventario (estilo Lici)';

-- Permisos
GRANT SELECT ON licitaciones_por_producto TO authenticated, anon;
