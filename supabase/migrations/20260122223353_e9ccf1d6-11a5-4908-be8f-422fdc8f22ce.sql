-- ===========================================
-- Security Fix: Error-Level Issues
-- ===========================================

-- =========================================
-- FIX 1: BI Views Security
-- Recreate views with security_invoker = on
-- =========================================

-- Drop and recreate views with security_invoker
DROP VIEW IF EXISTS bi_oc_negocios_por_institucion;
CREATE VIEW bi_oc_negocios_por_institucion 
WITH (security_invoker = on) AS
SELECT 
  institucion_rut,
  institucion_nombre,
  count(*) AS total_ordenes,
  sum(total_neto) AS monto_total,
  avg(total_neto) AS promedio_orden,
  count(DISTINCT proveedor_rut) AS proveedores_distintos,
  max(fecha_creacion) AS ultima_orden
FROM ordenes_compra oc
GROUP BY institucion_rut, institucion_nombre;

DROP VIEW IF EXISTS bi_oc_negocios_por_proveedor;
CREATE VIEW bi_oc_negocios_por_proveedor 
WITH (security_invoker = on) AS
SELECT 
  proveedor_rut,
  proveedor_nombre,
  count(*) AS total_ordenes,
  sum(total_neto) AS monto_total,
  avg(total_neto) AS promedio_orden,
  count(DISTINCT institucion_rut) AS instituciones_distintas,
  max(fecha_creacion) AS ultima_orden
FROM ordenes_compra oc
GROUP BY proveedor_rut, proveedor_nombre;

DROP VIEW IF EXISTS bi_oc_precios_producto_proveedor;
CREATE VIEW bi_oc_precios_producto_proveedor 
WITH (security_invoker = on) AS
SELECT 
  oci.nombre_producto,
  oc.proveedor_rut,
  oc.proveedor_nombre,
  count(*) AS veces_vendido,
  avg(oci.precio_unitario_neto) AS precio_promedio,
  min(oci.precio_unitario_neto) AS precio_minimo,
  max(oci.precio_unitario_neto) AS precio_maximo,
  max(oc.fecha_creacion) AS ultima_venta
FROM ordenes_compra_items oci
JOIN ordenes_compra oc ON oc.id = oci.orden_compra_id
GROUP BY oci.nombre_producto, oc.proveedor_rut, oc.proveedor_nombre;

DROP VIEW IF EXISTS bi_oc_productos;
CREATE VIEW bi_oc_productos 
WITH (security_invoker = on) AS
SELECT 
  nombre_producto,
  categoria,
  count(*) AS total_ventas,
  sum(cantidad) AS cantidad_total,
  sum(total_neto) AS monto_total,
  avg(precio_unitario_neto) AS precio_promedio,
  min(precio_unitario_neto) AS precio_minimo,
  max(precio_unitario_neto) AS precio_maximo
FROM ordenes_compra_items oci
GROUP BY nombre_producto, categoria;

-- Revoke public/anon access and grant only to authenticated users
REVOKE ALL ON bi_oc_negocios_por_institucion FROM anon, public;
GRANT SELECT ON bi_oc_negocios_por_institucion TO authenticated;

REVOKE ALL ON bi_oc_negocios_por_proveedor FROM anon, public;
GRANT SELECT ON bi_oc_negocios_por_proveedor TO authenticated;

REVOKE ALL ON bi_oc_precios_producto_proveedor FROM anon, public;
GRANT SELECT ON bi_oc_precios_producto_proveedor TO authenticated;

REVOKE ALL ON bi_oc_productos FROM anon, public;
GRANT SELECT ON bi_oc_productos TO authenticated;

-- =========================================
-- FIX 2: Inventory NULL user_id Bypass
-- =========================================

-- Drop the vulnerable policies that allow NULL user_id bypass
DROP POLICY IF EXISTS "Users can insert own inventory" ON inventory;
DROP POLICY IF EXISTS "Users can update own inventory or admin all" ON inventory;
DROP POLICY IF EXISTS "Users can delete own inventory or admin all" ON inventory;
DROP POLICY IF EXISTS "Users can view own inventory" ON inventory;

-- Recreate policies WITHOUT the NULL bypass vulnerability
-- Insert policy: User must set their own user_id
CREATE POLICY "Users can insert own inventory"
  ON inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Update policy: Only owner or admin, no NULL bypass
CREATE POLICY "Users can update own inventory or admin all"
  ON inventory
  FOR UPDATE
  TO authenticated
  USING ((user_id = auth.uid()) OR is_admin())
  WITH CHECK ((user_id = auth.uid()) OR is_admin());

-- Delete policy: Only owner or admin, no NULL bypass
CREATE POLICY "Users can delete own inventory or admin all"
  ON inventory
  FOR DELETE
  TO authenticated
  USING ((user_id = auth.uid()) OR is_admin());

-- View policy: Only owner or admin, no NULL bypass
CREATE POLICY "Users can view own inventory"
  ON inventory
  FOR SELECT
  TO authenticated
  USING ((user_id = auth.uid()) OR is_admin());