-- =====================================================
-- SECURITY FIX: Error-level issues
-- =====================================================

-- 1. FIX: clientes table - restrict SELECT to owner only
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Clientes can view own data" ON public.clientes;
DROP POLICY IF EXISTS "Clientes son visibles por su propietario" ON public.clientes;
DROP POLICY IF EXISTS "Users can view own cliente" ON public.clientes;
DROP POLICY IF EXISTS "Public can view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated can view clientes" ON public.clientes;

-- Create strict owner-only SELECT policy
CREATE POLICY "clientes_select_own_only" 
ON public.clientes 
FOR SELECT 
USING (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;


-- 2. FIX: empresas_billing table - restrict SELECT to owner only
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Public can view empresas_billing" ON public.empresas_billing;
DROP POLICY IF EXISTS "Authenticated can view empresas_billing" ON public.empresas_billing;
DROP POLICY IF EXISTS "Users can view billing" ON public.empresas_billing;
DROP POLICY IF EXISTS "empresas_billing_select" ON public.empresas_billing;

-- Create strict owner-only SELECT policy
CREATE POLICY "empresas_billing_select_own_only" 
ON public.empresas_billing 
FOR SELECT 
USING (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE public.empresas_billing ENABLE ROW LEVEL SECURITY;


-- 3. FIX: BI Views - Recreate with security_invoker = on

-- bi_oc_negocios_por_institucion
DROP VIEW IF EXISTS public.bi_oc_negocios_por_institucion;
CREATE VIEW public.bi_oc_negocios_por_institucion
WITH (security_invoker = on) AS
SELECT 
  oc.institucion_nombre,
  oc.institucion_rut,
  COUNT(*) as total_ordenes,
  SUM(oc.total) as monto_total,
  AVG(oc.total) as promedio_orden,
  COUNT(DISTINCT oc.proveedor_rut) as proveedores_distintos,
  MAX(oc.fecha_envio) as ultima_orden
FROM public.ordenes_compra oc
WHERE oc.institucion_nombre IS NOT NULL
GROUP BY oc.institucion_nombre, oc.institucion_rut
ORDER BY monto_total DESC NULLS LAST;

-- bi_oc_negocios_por_proveedor
DROP VIEW IF EXISTS public.bi_oc_negocios_por_proveedor;
CREATE VIEW public.bi_oc_negocios_por_proveedor
WITH (security_invoker = on) AS
SELECT 
  oc.proveedor_nombre,
  oc.proveedor_rut,
  COUNT(*) as total_ordenes,
  SUM(oc.total) as monto_total,
  AVG(oc.total) as promedio_orden,
  COUNT(DISTINCT oc.institucion_rut) as instituciones_distintas,
  MAX(oc.fecha_envio) as ultima_orden
FROM public.ordenes_compra oc
WHERE oc.proveedor_nombre IS NOT NULL
GROUP BY oc.proveedor_nombre, oc.proveedor_rut
ORDER BY monto_total DESC NULLS LAST;

-- bi_oc_productos
DROP VIEW IF EXISTS public.bi_oc_productos;
CREATE VIEW public.bi_oc_productos
WITH (security_invoker = on) AS
SELECT 
  oci.nombre_producto,
  oci.categoria,
  COUNT(*) as total_ventas,
  SUM(oci.cantidad) as cantidad_total,
  SUM(oci.total_neto) as monto_total,
  AVG(oci.precio_unitario_neto) as precio_promedio,
  MIN(oci.precio_unitario_neto) as precio_minimo,
  MAX(oci.precio_unitario_neto) as precio_maximo
FROM public.ordenes_compra_items oci
WHERE oci.nombre_producto IS NOT NULL
GROUP BY oci.nombre_producto, oci.categoria
ORDER BY total_ventas DESC;

-- bi_oc_precios_producto_proveedor
DROP VIEW IF EXISTS public.bi_oc_precios_producto_proveedor;
CREATE VIEW public.bi_oc_precios_producto_proveedor
WITH (security_invoker = on) AS
SELECT 
  oci.nombre_producto,
  oc.proveedor_nombre,
  oc.proveedor_rut,
  COUNT(*) as veces_vendido,
  AVG(oci.precio_unitario_neto) as precio_promedio,
  MIN(oci.precio_unitario_neto) as precio_minimo,
  MAX(oci.precio_unitario_neto) as precio_maximo,
  MAX(oc.fecha_envio) as ultima_venta
FROM public.ordenes_compra_items oci
JOIN public.ordenes_compra oc ON oci.orden_compra_id = oc.id
WHERE oci.nombre_producto IS NOT NULL
GROUP BY oci.nombre_producto, oc.proveedor_nombre, oc.proveedor_rut
ORDER BY veces_vendido DESC;

-- dashboard_estado
DROP VIEW IF EXISTS public.dashboard_estado;
CREATE VIEW public.dashboard_estado
WITH (security_invoker = on) AS
SELECT
  (SELECT COUNT(*) FROM public.licitaciones) as total_licitaciones,
  (SELECT COUNT(*) FROM public.licitaciones WHERE match_encontrado = true) as con_match,
  (SELECT COUNT(*) FROM public.licitaciones WHERE fecha_cierre < (now() + interval '48 hours') AND estado = 'activa') as urgentes,
  (SELECT COUNT(*) FROM public.ofertas) as total_ofertas,
  (SELECT COUNT(*) FROM public.ofertas WHERE estado = 'enviada') as ofertas_enviadas,
  (SELECT COUNT(*) FROM public.ofertas WHERE estado = 'ganada') as ofertas_ganadas,
  (SELECT COALESCE(SUM(valor_total_oferta), 0) FROM public.ofertas WHERE estado = 'ganada') as monto_ganado,
  (SELECT COUNT(*) FROM public.ordenes_compra) as total_ordenes,
  (SELECT COALESCE(SUM(total), 0) FROM public.ordenes_compra) as monto_ordenes;

-- licitaciones_con_match (only using columns that exist in licitaciones table)
DROP VIEW IF EXISTS public.licitaciones_con_match;
CREATE VIEW public.licitaciones_con_match
WITH (security_invoker = on) AS
SELECT 
  l.id_licitacion,
  l.titulo,
  l.organismo,
  l.presupuesto,
  l.fecha_cierre,
  l.estado,
  l.match_score as score,
  l.match_encontrado,
  l.procesada,
  l.link_oficial,
  l.created_at
FROM public.licitaciones l
WHERE l.match_encontrado = true
ORDER BY l.match_score DESC NULLS LAST, l.fecha_cierre ASC;

-- licitaciones_urgentes
DROP VIEW IF EXISTS public.licitaciones_urgentes;
CREATE VIEW public.licitaciones_urgentes
WITH (security_invoker = on) AS
SELECT 
  l.id_licitacion,
  l.titulo,
  l.organismo,
  l.presupuesto,
  l.fecha_cierre,
  l.estado,
  l.match_score,
  l.match_encontrado,
  l.procesada,
  l.link_oficial,
  l.created_at
FROM public.licitaciones l
WHERE l.fecha_cierre < (now() + interval '48 hours')
  AND l.estado = 'activa'
ORDER BY l.fecha_cierre ASC;