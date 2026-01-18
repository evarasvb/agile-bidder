-- Eliminar compras ágiles de prueba (versión simplificada para ejecución directa)
DELETE FROM public.compras_agiles
WHERE 
  codigo LIKE 'CA-2025-%' OR
  codigo LIKE 'CA-2024-%' OR
  codigo LIKE 'TEST-%' OR
  codigo LIKE 'PRUEBA-%' OR
  codigo LIKE 'DEMO-%' OR
  codigo LIKE 'SAMPLE-%' OR
  codigo IN ('test', 'prueba', 'demo', 'sample') OR
  LOWER(COALESCE(nombre_organismo, '')) = 'organismo no especificado' OR
  LOWER(COALESCE(organismo, '')) = 'organismo no especificado' OR
  LOWER(COALESCE(nombre_organismo, '')) = 'organismo de prueba' OR
  LOWER(COALESCE(organismo, '')) = 'organismo de prueba' OR
  LOWER(COALESCE(nombre, '')) LIKE '%test%' OR
  LOWER(COALESCE(nombre, '')) LIKE '%prueba%' OR
  LOWER(COALESCE(nombre, '')) LIKE '%ejemplo%' OR
  LOWER(COALESCE(nombre, '')) LIKE '%dummy%' OR
  LOWER(COALESCE(nombre, '')) LIKE '%sample%' OR
  LOWER(COALESCE(nombre, '')) LIKE '%demo%';