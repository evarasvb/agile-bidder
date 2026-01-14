-- Vista unificada de oportunidades (licitaciones + licitaciones_bi)
CREATE OR REPLACE VIEW public.oportunidades_all AS
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

-- Vista de calendario de eventos (aperturas y cierres)
CREATE OR REPLACE VIEW public.calendario_eventos AS
SELECT 
  codigo,
  nombre,
  tipo_proceso,
  institucion_nombre,
  fecha_publicacion AS fecha_evento,
  'apertura' AS tipo_evento,
  presupuesto_estimado
FROM public.oportunidades_all
WHERE fecha_publicacion IS NOT NULL

UNION ALL

SELECT 
  codigo,
  nombre,
  tipo_proceso,
  institucion_nombre,
  fecha_cierre AS fecha_evento,
  'cierre' AS tipo_evento,
  presupuesto_estimado
FROM public.oportunidades_all
WHERE fecha_cierre IS NOT NULL;

-- Comentarios descriptivos
COMMENT ON VIEW public.oportunidades_all IS 'Vista unificada de todas las oportunidades de licitación (compras ágiles y licitaciones grandes)';
COMMENT ON VIEW public.calendario_eventos IS 'Vista de eventos de calendario para aperturas y cierres de licitaciones';