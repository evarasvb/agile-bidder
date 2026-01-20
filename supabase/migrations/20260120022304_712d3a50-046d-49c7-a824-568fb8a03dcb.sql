-- =============================================
-- 1. SISTEMA DE INSTITUCIONES
-- =============================================

-- Tabla: instituciones_dashboard (vista materializada como tabla)
CREATE TABLE IF NOT EXISTS public.instituciones_dashboard (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institucion_id UUID REFERENCES public.instituciones(id),
  total_compras INTEGER DEFAULT 0,
  monto_total_compras NUMERIC(15,2) DEFAULT 0,
  promedio_por_compra NUMERIC(15,2) DEFAULT 0,
  ultima_compra_fecha TIMESTAMP WITH TIME ZONE,
  tendencia_compras TEXT, -- 'creciente', 'estable', 'decreciente'
  categoria_gasto TEXT, -- 'alto', 'medio', 'bajo'
  score_oportunidad INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla: instituciones_gestion (seguimiento de gestión comercial)
CREATE TABLE IF NOT EXISTS public.instituciones_gestion (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institucion_id UUID REFERENCES public.instituciones(id),
  user_id UUID,
  estado_gestion TEXT DEFAULT 'sin_contactar', -- sin_contactar, contactado, en_negociacion, cliente, rechazado
  fecha_ultimo_contacto TIMESTAMP WITH TIME ZONE,
  proximo_seguimiento TIMESTAMP WITH TIME ZONE,
  notas TEXT,
  prioridad INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla: instituciones_interacciones (historial de interacciones)
CREATE TABLE IF NOT EXISTS public.instituciones_interacciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institucion_id UUID REFERENCES public.instituciones(id),
  gestion_id UUID REFERENCES public.instituciones_gestion(id),
  user_id UUID,
  tipo_interaccion TEXT NOT NULL, -- llamada, email, reunion, visita, otro
  descripcion TEXT,
  resultado TEXT,
  fecha_interaccion TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla: conducta_pago (historial de comportamiento de pago)
CREATE TABLE IF NOT EXISTS public.conducta_pago (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institucion_id UUID REFERENCES public.instituciones(id),
  promedio_dias_pago INTEGER,
  ordenes_pagadas_a_tiempo INTEGER DEFAULT 0,
  ordenes_pagadas_tardias INTEGER DEFAULT 0,
  monto_pendiente NUMERIC(15,2) DEFAULT 0,
  score_pago INTEGER DEFAULT 100, -- 0-100
  ultima_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================
-- 2. SISTEMA AUTO-BIDS
-- =============================================

-- Tabla: auto_bids_dashboard (configuración y métricas de auto-bids)
CREATE TABLE IF NOT EXISTS public.auto_bids_dashboard (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activo BOOLEAN DEFAULT false,
  total_bids_enviados INTEGER DEFAULT 0,
  total_bids_ganados INTEGER DEFAULT 0,
  monto_total_ganado NUMERIC(15,2) DEFAULT 0,
  tasa_exito NUMERIC(5,2) DEFAULT 0,
  ultimo_bid_fecha TIMESTAMP WITH TIME ZONE,
  configuracion JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla: auto_bid_items (items configurados para auto-bid)
CREATE TABLE IF NOT EXISTS public.auto_bid_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dashboard_id UUID REFERENCES public.auto_bids_dashboard(id),
  user_id UUID NOT NULL,
  producto_id UUID,
  nombre_producto TEXT NOT NULL,
  precio_minimo NUMERIC(15,2),
  precio_maximo NUMERIC(15,2),
  margen_objetivo NUMERIC(5,2) DEFAULT 15,
  activo BOOLEAN DEFAULT true,
  total_bids INTEGER DEFAULT 0,
  bids_ganados INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================
-- 3. COMPRAS AGILES ITEMS
-- =============================================

-- Tabla: compras_agiles_items (productos detallados de cada compra ágil)
CREATE TABLE IF NOT EXISTS public.compras_agiles_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compra_agil_id UUID REFERENCES public.compras_agiles(id),
  codigo_compra TEXT,
  nombre_producto TEXT NOT NULL,
  descripcion TEXT,
  cantidad INTEGER DEFAULT 1,
  unidad TEXT,
  precio_unitario NUMERIC(15,2),
  total NUMERIC(15,2),
  categoria TEXT,
  codigo_producto TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================
-- 4. PRODUCTOS (Catálogo para matching)
-- =============================================

CREATE TABLE IF NOT EXISTS public.productos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT,
  subcategoria TEXT,
  unidad_medida TEXT,
  precio_referencia NUMERIC(15,2),
  keywords TEXT[],
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índice para búsqueda de productos
CREATE INDEX IF NOT EXISTS idx_productos_nombre ON public.productos USING gin(to_tsvector('spanish', nombre));
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON public.productos(categoria);

-- =============================================
-- 5. BI ANALYTICS
-- =============================================

-- Vista: bi_oc_negocios_por_institucion
CREATE OR REPLACE VIEW public.bi_oc_negocios_por_institucion AS
SELECT 
  oc.institucion_nombre,
  oc.institucion_rut,
  COUNT(*) as total_ordenes,
  SUM(oc.total) as monto_total,
  AVG(oc.total) as promedio_orden,
  MAX(oc.fecha_creacion) as ultima_orden,
  COUNT(DISTINCT oc.proveedor_rut) as proveedores_distintos
FROM public.ordenes_compra oc
WHERE oc.institucion_nombre IS NOT NULL
GROUP BY oc.institucion_nombre, oc.institucion_rut
ORDER BY monto_total DESC NULLS LAST;

-- Vista: bi_oc_negocios_por_proveedor
CREATE OR REPLACE VIEW public.bi_oc_negocios_por_proveedor AS
SELECT 
  oc.proveedor_nombre,
  oc.proveedor_rut,
  COUNT(*) as total_ordenes,
  SUM(oc.total) as monto_total,
  AVG(oc.total) as promedio_orden,
  MAX(oc.fecha_creacion) as ultima_orden,
  COUNT(DISTINCT oc.institucion_rut) as instituciones_distintas
FROM public.ordenes_compra oc
WHERE oc.proveedor_nombre IS NOT NULL
GROUP BY oc.proveedor_nombre, oc.proveedor_rut
ORDER BY monto_total DESC NULLS LAST;

-- Vista: bi_oc_productos
CREATE OR REPLACE VIEW public.bi_oc_productos AS
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

-- Vista: bi_oc_precios_producto_proveedor
CREATE OR REPLACE VIEW public.bi_oc_precios_producto_proveedor AS
SELECT 
  oci.nombre_producto,
  oc.proveedor_nombre,
  oc.proveedor_rut,
  COUNT(*) as veces_vendido,
  AVG(oci.precio_unitario_neto) as precio_promedio,
  MIN(oci.precio_unitario_neto) as precio_minimo,
  MAX(oci.precio_unitario_neto) as precio_maximo,
  MAX(oc.fecha_creacion) as ultima_venta
FROM public.ordenes_compra_items oci
JOIN public.ordenes_compra oc ON oci.orden_compra_id = oc.id
WHERE oci.nombre_producto IS NOT NULL
GROUP BY oci.nombre_producto, oc.proveedor_nombre, oc.proveedor_rut
ORDER BY veces_vendido DESC;

-- =============================================
-- 6. VISTAS IMPORTANTES
-- =============================================

-- Vista: licitaciones_con_match
CREATE OR REPLACE VIEW public.licitaciones_con_match AS
SELECT 
  l.*,
  COALESCE(l.match_score, 0) as score
FROM public.licitaciones l
WHERE l.match_encontrado = true
ORDER BY l.match_score DESC NULLS LAST, l.fecha_cierre ASC NULLS LAST;

-- Vista: licitaciones_urgentes (cierran en 48 horas)
CREATE OR REPLACE VIEW public.licitaciones_urgentes AS
SELECT *
FROM public.licitaciones
WHERE fecha_cierre IS NOT NULL 
  AND fecha_cierre > now() 
  AND fecha_cierre < now() + interval '48 hours'
ORDER BY fecha_cierre ASC;

-- Vista: dashboard_estado
CREATE OR REPLACE VIEW public.dashboard_estado AS
SELECT 
  (SELECT COUNT(*) FROM public.licitaciones) as total_licitaciones,
  (SELECT COUNT(*) FROM public.licitaciones WHERE match_encontrado = true) as con_match,
  (SELECT COUNT(*) FROM public.licitaciones WHERE fecha_cierre > now() AND fecha_cierre < now() + interval '48 hours') as urgentes,
  (SELECT COUNT(*) FROM public.ofertas) as total_ofertas,
  (SELECT COUNT(*) FROM public.ofertas WHERE estado = 'enviada') as ofertas_enviadas,
  (SELECT COUNT(*) FROM public.ofertas WHERE estado = 'adjudicada') as ofertas_ganadas,
  (SELECT COALESCE(SUM(valor_total_oferta), 0) FROM public.ofertas WHERE estado = 'adjudicada') as monto_ganado,
  (SELECT COUNT(*) FROM public.ordenes_compra) as total_ordenes,
  (SELECT COALESCE(SUM(total), 0) FROM public.ordenes_compra) as monto_ordenes;

-- =============================================
-- 7. PLANES DE SUSCRIPCIÓN
-- =============================================

CREATE TABLE IF NOT EXISTS public.planes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  precio_mensual NUMERIC(10,2) NOT NULL,
  precio_anual NUMERIC(10,2),
  features JSONB DEFAULT '[]',
  limite_licitaciones INTEGER,
  limite_ofertas INTEGER,
  limite_usuarios INTEGER DEFAULT 1,
  tiene_auto_bid BOOLEAN DEFAULT false,
  tiene_bi_avanzado BOOLEAN DEFAULT false,
  tiene_api BOOLEAN DEFAULT false,
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insertar planes base
INSERT INTO public.planes (nombre, descripcion, precio_mensual, precio_anual, features, limite_licitaciones, limite_ofertas, tiene_auto_bid, tiene_bi_avanzado, orden)
VALUES 
  ('Free', 'Plan gratuito para empezar', 0, 0, '["5 licitaciones/mes", "1 usuario", "Soporte email"]'::jsonb, 5, 5, false, false, 1),
  ('Starter', 'Para pequeñas empresas', 29990, 299900, '["50 licitaciones/mes", "3 usuarios", "Auto-bid básico", "Soporte prioritario"]'::jsonb, 50, 50, true, false, 2),
  ('Professional', 'Para empresas en crecimiento', 79990, 799900, '["Licitaciones ilimitadas", "10 usuarios", "Auto-bid avanzado", "BI Analytics", "API acceso"]'::jsonb, NULL, NULL, true, true, 3),
  ('Enterprise', 'Solución empresarial', 199990, 1999900, '["Todo ilimitado", "Usuarios ilimitados", "Auto-bid premium", "BI avanzado", "API completa", "Account manager"]'::jsonb, NULL, NULL, true, true, 4)
ON CONFLICT (nombre) DO NOTHING;

-- =============================================
-- 8. RLS POLICIES
-- =============================================

-- Instituciones dashboard
ALTER TABLE public.instituciones_dashboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view instituciones_dashboard" ON public.instituciones_dashboard FOR SELECT TO authenticated USING (true);

-- Instituciones gestion
ALTER TABLE public.instituciones_gestion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their instituciones_gestion" ON public.instituciones_gestion FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

-- Instituciones interacciones
ALTER TABLE public.instituciones_interacciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their interacciones" ON public.instituciones_interacciones FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

-- Conducta pago
ALTER TABLE public.conducta_pago ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view conducta_pago" ON public.conducta_pago FOR SELECT TO authenticated USING (true);

-- Auto bids dashboard
ALTER TABLE public.auto_bids_dashboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their auto_bids" ON public.auto_bids_dashboard FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Auto bid items
ALTER TABLE public.auto_bid_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their auto_bid_items" ON public.auto_bid_items FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Compras agiles items
ALTER TABLE public.compras_agiles_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view compras_agiles_items" ON public.compras_agiles_items FOR SELECT TO authenticated USING (true);

-- Productos
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view productos" ON public.productos FOR SELECT TO authenticated USING (true);

-- Planes
ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view planes" ON public.planes FOR SELECT USING (true);