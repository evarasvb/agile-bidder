-- =====================================================
-- Eliminar datos de prueba de compras_agiles
-- Solo elimina registros claramente identificados como de prueba
-- =====================================================

-- Eliminar compras ágiles con códigos de prueba (método más simple)
DELETE FROM public.compras_agiles
WHERE 
  codigo LIKE 'CA-2025-%' OR
  codigo LIKE 'CA-2024-%' OR
  codigo LIKE 'TEST-%' OR
  codigo LIKE 'PRUEBA-%' OR
  codigo LIKE 'DEMO-%' OR
  codigo LIKE 'SAMPLE-%' OR
  codigo IN ('test', 'prueba', 'demo', 'sample') OR
  LOWER(nombre) LIKE '%test%' OR
  LOWER(nombre) LIKE '%prueba%' OR
  LOWER(nombre) LIKE '%ejemplo%' OR
  LOWER(nombre) LIKE '%dummy%' OR
  LOWER(nombre) LIKE '%sample%' OR
  LOWER(nombre) LIKE '%demo%';