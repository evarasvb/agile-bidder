-- ============================================
-- MIGRACIÓN 1: Limpiar datos de prueba
-- ============================================
-- Archivo: 20260116000003_limpiar_datos_prueba_compras_agiles.sql

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

-- Identificar compras sin productos asociados
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

-- Función para limpiar datos de prueba (NO ejecutar automáticamente, solo para revisión)
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

-- Función para obtener estadísticas de compras ágiles
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

-- Comentarios
COMMENT ON VIEW compras_agiles_sospechosas IS 'Compras ágiles que parecen ser datos de prueba o inventados';
COMMENT ON VIEW compras_agiles_sin_productos IS 'Compras ágiles sin productos asociados en licitacion_items';
COMMENT ON FUNCTION revisar_datos_prueba_compras_agiles() IS 'Función para revisar compras que pueden ser datos de prueba. Revisar manualmente antes de eliminar.';
COMMENT ON FUNCTION estadisticas_compras_agiles() IS 'Función para obtener estadísticas generales de compras ágiles';

-- ============================================
-- MIGRACIÓN 2: Crear tablas de órdenes de compra
-- ============================================
-- Archivo: 20260116000004_create_ordenes_compra.sql

-- Crear tabla de órdenes de compra
CREATE TABLE IF NOT EXISTS public.ordenes_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT,
  descripcion TEXT,
  institucion_nombre TEXT,
  institucion_rut TEXT,
  proveedor_nombre TEXT,
  proveedor_rut TEXT,
  total_neto NUMERIC(15,2),
  total NUMERIC(15,2),
  fecha_creacion TIMESTAMPTZ,
  fecha_envio TIMESTAMPTZ,
  fecha_aceptacion TIMESTAMPTZ,
  estado TEXT,
  link_oficial TEXT,
  datos_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear tabla de items de órdenes de compra
CREATE TABLE IF NOT EXISTS public.orden_compra_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_compra_codigo TEXT NOT NULL REFERENCES public.ordenes_compra(codigo) ON DELETE CASCADE,
  item_index INTEGER NOT NULL,
  producto_id TEXT,
  nombre_producto TEXT,
  descripcion TEXT,
  cantidad NUMERIC(10,2),
  unidad TEXT,
  precio_unitario NUMERIC(15,2),
  subtotal NUMERIC(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(orden_compra_codigo, item_index)
);

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_codigo ON public.ordenes_compra(codigo);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_institucion_rut ON public.ordenes_compra(institucion_rut);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_institucion_nombre ON public.ordenes_compra(institucion_nombre);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_proveedor_rut ON public.ordenes_compra(proveedor_rut);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_proveedor_nombre ON public.ordenes_compra(proveedor_nombre);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_fecha_creacion ON public.ordenes_compra(fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_estado ON public.ordenes_compra(estado);
CREATE INDEX IF NOT EXISTS idx_orden_compra_items_codigo ON public.orden_compra_items(orden_compra_codigo);

-- Habilitar RLS
ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orden_compra_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ordenes_compra (idempotente: DROP antes de CREATE)
DROP POLICY IF EXISTS "Users can view ordenes_compra" ON public.ordenes_compra;
DROP POLICY IF EXISTS "Users can insert ordenes_compra" ON public.ordenes_compra;
DROP POLICY IF EXISTS "Users can update ordenes_compra" ON public.ordenes_compra;

CREATE POLICY "Users can view ordenes_compra"
  ON public.ordenes_compra
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert ordenes_compra"
  ON public.ordenes_compra
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update ordenes_compra"
  ON public.ordenes_compra
  FOR UPDATE
  USING (true);

-- Políticas RLS para orden_compra_items (idempotente: DROP antes de CREATE)
DROP POLICY IF EXISTS "Users can view orden_compra_items" ON public.orden_compra_items;
DROP POLICY IF EXISTS "Users can insert orden_compra_items" ON public.orden_compra_items;
DROP POLICY IF EXISTS "Users can update orden_compra_items" ON public.orden_compra_items;

CREATE POLICY "Users can view orden_compra_items"
  ON public.orden_compra_items
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert orden_compra_items"
  ON public.orden_compra_items
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update orden_compra_items"
  ON public.orden_compra_items
  FOR UPDATE
  USING (true);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_ordenes_compra_updated_at ON public.ordenes_compra;
CREATE TRIGGER update_ordenes_compra_updated_at
  BEFORE UPDATE ON public.ordenes_compra
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentarios
COMMENT ON TABLE public.ordenes_compra IS 'Órdenes de compra de MercadoPúblico';
COMMENT ON TABLE public.orden_compra_items IS 'Items/productos de cada orden de compra';
COMMENT ON COLUMN public.ordenes_compra.codigo IS 'Código único de la orden de compra';
COMMENT ON COLUMN public.ordenes_compra.institucion_rut IS 'RUT de la institución que emite la OC';
COMMENT ON COLUMN public.ordenes_compra.proveedor_rut IS 'RUT del proveedor que recibe la OC';
COMMENT ON COLUMN public.orden_compra_items.orden_compra_codigo IS 'Código de la orden de compra (FK)';
