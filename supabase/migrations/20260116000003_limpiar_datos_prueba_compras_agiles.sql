-- Script para limpiar datos de prueba/inventados de compras_agiles
-- y verificar que todas las compras tengan productos asociados

-- 1. Identificar compras ágiles que parecen ser de prueba/inventadas
-- Criterios para identificar datos de prueba:
-- - Códigos que no siguen el formato estándar de MercadoPúblico
-- - Nombres genéricos o de prueba
-- - Organismos que no existen o son genéricos
-- - Fechas muy antiguas o futuras
-- - Sin productos asociados

-- Crear una vista temporal para identificar compras sospechosas
CREATE OR REPLACE VIEW compras_agiles_sospechosas AS
SELECT 
  ca.id,
  ca.codigo,
  ca.nombre,
  ca.organismo,
  ca.created_at,
  ca.fecha_cierre,
  COUNT(li.id) as num_items
FROM public.compras_agiles ca
LEFT JOIN public.licitacion_items li ON li.licitacion_codigo = ca.codigo
WHERE 
  -- Códigos que no parecen reales (formato típico: números o letras-números)
  (ca.codigo !~ '^[0-9]+$' AND ca.codigo !~ '^[A-Z0-9-]+$')
  -- O nombres genéricos
  OR LOWER(ca.nombre) LIKE '%test%'
  OR LOWER(ca.nombre) LIKE '%prueba%'
  OR LOWER(ca.nombre) LIKE '%ejemplo%'
  OR LOWER(ca.nombre) LIKE '%dummy%'
  OR LOWER(ca.nombre) LIKE '%sample%'
  OR LOWER(ca.nombre) LIKE '%demo%'
  -- O organismos genéricos
  OR LOWER(ca.organismo) LIKE '%test%'
  OR LOWER(ca.organismo) LIKE '%prueba%'
  OR LOWER(ca.organismo) LIKE '%ejemplo%'
  OR ca.organismo = 'Organismo no especificado'
  -- O sin productos asociados (más de 30 días sin items)
  OR (COUNT(li.id) = 0 AND ca.created_at < NOW() - INTERVAL '30 days')
GROUP BY ca.id, ca.codigo, ca.nombre, ca.organismo, ca.created_at, ca.fecha_cierre;

-- 2. Identificar compras sin productos asociados
CREATE OR REPLACE VIEW compras_agiles_sin_productos AS
SELECT 
  ca.id,
  ca.codigo,
  ca.nombre,
  ca.organismo,
  ca.created_at,
  ca.fecha_cierre,
  COUNT(li.id) as num_items
FROM public.compras_agiles ca
LEFT JOIN public.licitacion_items li ON li.licitacion_codigo = ca.codigo
GROUP BY ca.id, ca.codigo, ca.nombre, ca.organismo, ca.created_at, ca.fecha_cierre
HAVING COUNT(li.id) = 0;

-- 3. Función para limpiar datos de prueba (NO ejecutar automáticamente, solo para revisión)
-- IMPORTANTE: Revisar manualmente antes de ejecutar DELETE
CREATE OR REPLACE FUNCTION revisar_datos_prueba_compras_agiles()
RETURNS TABLE(
  tipo TEXT,
  codigo TEXT,
  nombre TEXT,
  organismo TEXT,
  num_items BIGINT,
  created_at TIMESTAMPTZ,
  accion_sugerida TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- Compras sospechosas (posibles datos de prueba)
  SELECT 
    'SOSPECHOSA'::TEXT as tipo,
    cs.codigo,
    cs.nombre,
    cs.organismo,
    cs.num_items,
    cs.created_at,
    CASE 
      WHEN cs.num_items = 0 THEN 'ELIMINAR - Sin productos y parece de prueba'
      ELSE 'REVISAR - Verificar si es real'
    END as accion_sugerida
  FROM compras_agiles_sospechosas cs
  
  UNION ALL
  
  -- Compras sin productos (más de 7 días sin items)
  SELECT 
    'SIN_PRODUCTOS'::TEXT as tipo,
    csp.codigo,
    csp.nombre,
    csp.organismo,
    csp.num_items,
    csp.created_at,
    CASE 
      WHEN csp.created_at < NOW() - INTERVAL '7 days' THEN 'ELIMINAR - Sin productos por más de 7 días'
      ELSE 'REVISAR - Puede estar en proceso de scraping'
    END as accion_sugerida
  FROM compras_agiles_sin_productos csp
  WHERE csp.created_at < NOW() - INTERVAL '7 days'
  
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. Función para obtener estadísticas de compras ágiles
CREATE OR REPLACE FUNCTION estadisticas_compras_agiles()
RETURNS TABLE(
  total_compras BIGINT,
  compras_con_productos BIGINT,
  compras_sin_productos BIGINT,
  compras_sospechosas BIGINT,
  total_productos BIGINT,
  promedio_productos_por_compra NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT ca.id)::BIGINT as total_compras,
    COUNT(DISTINCT CASE WHEN li.id IS NOT NULL THEN ca.id END)::BIGINT as compras_con_productos,
    COUNT(DISTINCT CASE WHEN li.id IS NULL THEN ca.id END)::BIGINT as compras_sin_productos,
    (SELECT COUNT(*)::BIGINT FROM compras_agiles_sospechosas) as compras_sospechosas,
    COUNT(li.id)::BIGINT as total_productos,
    CASE 
      WHEN COUNT(DISTINCT CASE WHEN li.id IS NOT NULL THEN ca.id END) > 0 
      THEN ROUND(COUNT(li.id)::NUMERIC / COUNT(DISTINCT CASE WHEN li.id IS NOT NULL THEN ca.id END), 2)
      ELSE 0
    END as promedio_productos_por_compra
  FROM public.compras_agiles ca
  LEFT JOIN public.licitacion_items li ON li.licitacion_codigo = ca.codigo;
END;
$$ LANGUAGE plpgsql;

-- 5. Comentarios
COMMENT ON VIEW compras_agiles_sospechosas IS 'Compras ágiles que parecen ser datos de prueba o inventados';
COMMENT ON VIEW compras_agiles_sin_productos IS 'Compras ágiles sin productos asociados en licitacion_items';
COMMENT ON FUNCTION revisar_datos_prueba_compras_agiles() IS 'Función para revisar compras que pueden ser datos de prueba. Revisar manualmente antes de eliminar.';
COMMENT ON FUNCTION estadisticas_compras_agiles() IS 'Función para obtener estadísticas generales de compras ágiles';
