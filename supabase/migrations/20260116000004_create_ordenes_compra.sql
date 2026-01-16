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

-- Políticas RLS para ordenes_compra
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

-- Políticas RLS para orden_compra_items
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
