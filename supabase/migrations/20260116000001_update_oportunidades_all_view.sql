-- Update oportunidades_all view to include compras_agiles
CREATE OR REPLACE VIEW public.oportunidades_all AS
-- Compras Ágiles desde tabla compras_agiles
SELECT 
  codigo,
  nombre,
  organismo AS institucion_nombre,
  estado,
  created_at AS fecha_publicacion,
  fecha_cierre,
  monto AS presupuesto_estimado,
  match_score,
  match_encontrado,
  'compra_agil' AS tipo_proceso,
  link_oficial,
  match_encontrado AS procesada
FROM public.compras_agiles

UNION ALL

-- Licitaciones desde tabla licitaciones (legacy)
SELECT 
  id_licitacion AS codigo,
  titulo AS nombre,
  organismo AS institucion_nombre,
  estado,
  created_at AS fecha_publicacion,
  fecha_cierre,
  presupuesto AS presupuesto_estimado,
  match_score,
  match_encontrado,
  'compra_agil' AS tipo_proceso,
  link_oficial,
  procesada
FROM public.licitaciones

UNION ALL

-- Licitaciones grandes desde licitaciones_bi
SELECT 
  codigo,
  nombre,
  institucion_nombre,
  estado,
  fecha_publicacion,
  fecha_cierre,
  presupuesto_estimado,
  NULL AS match_score,
  FALSE AS match_encontrado,
  'licitacion' AS tipo_proceso,
  NULL AS link_oficial,
  TRUE AS procesada
FROM public.licitaciones_bi;

-- Update comment
COMMENT ON VIEW public.oportunidades_all IS 'Vista unificada de todas las oportunidades de licitación (compras ágiles desde compras_agiles y licitaciones grandes)';
