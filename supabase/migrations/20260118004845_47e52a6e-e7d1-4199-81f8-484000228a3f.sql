-- Fix SECURITY DEFINER views to use SECURITY INVOKER
-- This ensures views respect RLS policies of the querying user

-- Recreate calendario_eventos view with security_invoker
DROP VIEW IF EXISTS public.calendario_eventos;
CREATE VIEW public.calendario_eventos
WITH (security_invoker = on) AS
SELECT 
  lb.codigo,
  lb.nombre,
  lb.institucion_nombre,
  lb.presupuesto_estimado,
  lb.fecha_cierre as fecha_evento,
  'licitacion' as tipo_proceso,
  'cierre' as tipo_evento
FROM licitaciones_bi lb
WHERE lb.fecha_cierre >= NOW()
UNION ALL
SELECT
  ca.codigo::text,
  ca.nombre,
  ca.organismo as institucion_nombre,
  ca.monto as presupuesto_estimado,
  ca.fecha_cierre as fecha_evento,
  'compra_agil' as tipo_proceso,
  'cierre' as tipo_evento
FROM compras_agiles ca
WHERE ca.fecha_cierre >= NOW();

-- Recreate oportunidades_all view with security_invoker
DROP VIEW IF EXISTS public.oportunidades_all;
CREATE VIEW public.oportunidades_all
WITH (security_invoker = on) AS
SELECT 
  ca.codigo::text as codigo,
  ca.nombre,
  ca.organismo as institucion_nombre,
  ca.monto as presupuesto_estimado,
  ca.fecha_cierre,
  ca.created_at as fecha_publicacion,
  ca.estado,
  ca.link_oficial,
  ca.match_score,
  ca.match_encontrado,
  'compra_agil' as tipo_proceso,
  false as procesada
FROM compras_agiles ca
UNION ALL
SELECT 
  l.id_licitacion as codigo,
  l.titulo as nombre,
  l.organismo as institucion_nombre,
  l.presupuesto as presupuesto_estimado,
  l.fecha_cierre,
  l.created_at as fecha_publicacion,
  l.estado,
  l.link_oficial,
  l.match_score,
  l.match_encontrado,
  'licitacion' as tipo_proceso,
  l.procesada
FROM licitaciones l
UNION ALL
SELECT 
  lb.codigo,
  lb.nombre,
  lb.institucion_nombre,
  lb.presupuesto_estimado,
  lb.fecha_cierre,
  lb.fecha_publicacion,
  lb.estado,
  NULL as link_oficial,
  NULL as match_score,
  false as match_encontrado,
  'licitacion_bi' as tipo_proceso,
  false as procesada
FROM licitaciones_bi lb;

-- Recreate vendedor views with security_invoker
DROP VIEW IF EXISTS public.v_vendedor_dashboard;
CREATE VIEW public.v_vendedor_dashboard
WITH (security_invoker = on) AS
SELECT 
  v.id as vendedor_id,
  v.nombre,
  v.email,
  COALESCE(vi.total_asignadas, 0) as total_asignadas,
  COALESCE(vi.total_postuladas, 0) as total_postuladas,
  COALESCE(vi.total_adjudicadas, 0) as total_adjudicadas,
  COALESCE(vi.monto_adjudicado, 0) as monto_adjudicado,
  COALESCE(vi.tasa_adjudicacion, 0) as tasa_adjudicacion
FROM vendedores v
LEFT JOIN vendedor_indicadores vi ON v.id = vi.vendedor_id
WHERE v.activo = true;

DROP VIEW IF EXISTS public.v_calendario_vendedor;
CREATE VIEW public.v_calendario_vendedor
WITH (security_invoker = on) AS
SELECT 
  vc.id,
  vc.vendedor_id,
  v.nombre as vendedor_nombre,
  vc.titulo,
  vc.fecha_inicio,
  vc.fecha_fin,
  vc.tipo_evento,
  vc.color,
  va.licitacion_codigo,
  va.estado as estado_asignacion,
  va.monto_estimado
FROM vendedor_calendario vc
JOIN vendedores v ON vc.vendedor_id = v.id
LEFT JOIN vendedor_asignaciones va ON vc.asignacion_id = va.id;

DROP VIEW IF EXISTS public.v_reporte_equipo;
CREATE VIEW public.v_reporte_equipo
WITH (security_invoker = on) AS
SELECT 
  v.id as vendedor_id,
  v.nombre,
  v.email,
  v.rol,
  COUNT(va.id) as total_negocios,
  COUNT(CASE WHEN va.estado = 'postulado' THEN 1 END) as postulados,
  COUNT(CASE WHEN va.estado = 'adjudicado' THEN 1 END) as adjudicados,
  COALESCE(SUM(va.monto_estimado), 0) as monto_total,
  COALESCE(SUM(CASE WHEN va.estado = 'adjudicado' THEN va.monto_estimado ELSE 0 END), 0) as monto_adjudicado,
  CASE 
    WHEN COUNT(CASE WHEN va.estado = 'postulado' THEN 1 END) > 0 
    THEN ROUND(COUNT(CASE WHEN va.estado = 'adjudicado' THEN 1 END)::numeric / 
         NULLIF(COUNT(CASE WHEN va.estado = 'postulado' THEN 1 END), 0) * 100, 2)
    ELSE 0 
  END as tasa_adjudicacion
FROM vendedores v
LEFT JOIN vendedor_asignaciones va ON v.id = va.vendedor_id
WHERE v.activo = true
GROUP BY v.id, v.nombre, v.email, v.rol;

DROP VIEW IF EXISTS public.v_asignaciones_detalle;
CREATE VIEW public.v_asignaciones_detalle
WITH (security_invoker = on) AS
SELECT 
  va.id,
  va.vendedor_id,
  v.nombre as vendedor_nombre,
  v.email as vendedor_email,
  va.licitacion_id,
  va.licitacion_codigo,
  va.estado,
  va.monto_estimado,
  va.fecha_cierre,
  va.notas,
  va.created_at
FROM vendedor_asignaciones va
JOIN vendedores v ON va.vendedor_id = v.id;