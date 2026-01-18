-- Verificar y agregar columnas faltantes a ordenes_compra (la tabla ya existe desde migración anterior)
DO $$
BEGIN
  -- Agregar link_oficial si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ordenes_compra' 
    AND column_name = 'link_oficial'
  ) THEN
    ALTER TABLE public.ordenes_compra ADD COLUMN link_oficial TEXT;
  END IF;
  
  -- Agregar datos_json si no existe (puede llamarse raw_data en la versión anterior)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ordenes_compra' 
    AND column_name = 'datos_json'
  ) THEN
    ALTER TABLE public.ordenes_compra ADD COLUMN datos_json JSONB;
  END IF;
END $$;

-- Verificar si orden_compra_items existe, si no, crearla
-- Nota: La tabla ordenes_compra_items ya existe desde migración anterior con estructura diferente
-- Esta migración crea orden_compra_items (sin 's') como alternativa
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'orden_compra_items'
  ) THEN
    CREATE TABLE public.orden_compra_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      orden_compra_codigo TEXT NOT NULL,
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
    
    -- Agregar FK si la tabla ordenes_compra tiene columna codigo
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'ordenes_compra' 
      AND column_name = 'codigo'
    ) THEN
      ALTER TABLE public.orden_compra_items 
      ADD CONSTRAINT fk_orden_compra_items_codigo 
      FOREIGN KEY (orden_compra_codigo) 
      REFERENCES public.ordenes_compra(codigo) 
      ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Crear índices para búsquedas rápidas (solo si las columnas existen)
DO $$
BEGIN
  -- Índices condicionales para ordenes_compra
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ordenes_compra' AND column_name = 'codigo') THEN
    CREATE INDEX IF NOT EXISTS idx_ordenes_compra_codigo ON public.ordenes_compra(codigo);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ordenes_compra' AND column_name = 'institucion_rut') THEN
    CREATE INDEX IF NOT EXISTS idx_ordenes_compra_institucion_rut ON public.ordenes_compra(institucion_rut);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ordenes_compra' AND column_name = 'institucion_nombre') THEN
    CREATE INDEX IF NOT EXISTS idx_ordenes_compra_institucion_nombre ON public.ordenes_compra(institucion_nombre);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ordenes_compra' AND column_name = 'proveedor_rut') THEN
    CREATE INDEX IF NOT EXISTS idx_ordenes_compra_proveedor_rut ON public.ordenes_compra(proveedor_rut);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ordenes_compra' AND column_name = 'proveedor_nombre') THEN
    CREATE INDEX IF NOT EXISTS idx_ordenes_compra_proveedor_nombre ON public.ordenes_compra(proveedor_nombre);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ordenes_compra' AND column_name = 'fecha_creacion') THEN
    CREATE INDEX IF NOT EXISTS idx_ordenes_compra_fecha_creacion ON public.ordenes_compra(fecha_creacion DESC);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ordenes_compra' AND column_name = 'estado') THEN
    CREATE INDEX IF NOT EXISTS idx_ordenes_compra_estado ON public.ordenes_compra(estado);
  END IF;
  
  -- Índice para orden_compra_items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orden_compra_items') THEN
    CREATE INDEX IF NOT EXISTS idx_orden_compra_items_codigo ON public.orden_compra_items(orden_compra_codigo);
  END IF;
END $$;

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

-- Trigger para actualizar updated_at (solo si no existe)
DROP TRIGGER IF EXISTS update_ordenes_compra_updated_at ON public.ordenes_compra;
CREATE TRIGGER update_ordenes_compra_updated_at
  BEFORE UPDATE ON public.ordenes_compra
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentarios (solo si las columnas/tablas existen)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ordenes_compra') THEN
    EXECUTE 'COMMENT ON TABLE public.ordenes_compra IS ''Órdenes de compra de MercadoPúblico''';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ordenes_compra' AND column_name = 'codigo') THEN
      EXECUTE 'COMMENT ON COLUMN public.ordenes_compra.codigo IS ''Código único de la orden de compra''';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ordenes_compra' AND column_name = 'institucion_rut') THEN
      EXECUTE 'COMMENT ON COLUMN public.ordenes_compra.institucion_rut IS ''RUT de la institución que emite la OC''';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ordenes_compra' AND column_name = 'proveedor_rut') THEN
      EXECUTE 'COMMENT ON COLUMN public.ordenes_compra.proveedor_rut IS ''RUT del proveedor que recibe la OC''';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orden_compra_items') THEN
    EXECUTE 'COMMENT ON TABLE public.orden_compra_items IS ''Items/productos de cada orden de compra''';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orden_compra_items' AND column_name = 'orden_compra_codigo') THEN
      EXECUTE 'COMMENT ON COLUMN public.orden_compra_items.orden_compra_codigo IS ''Código de la orden de compra (FK)''';
    END IF;
  END IF;
END $$;
