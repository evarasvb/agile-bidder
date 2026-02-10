-- Agregar campos faltantes a cliente_inventario para lista de precios completa
DO $$
BEGIN
  -- Agregar proveedor si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cliente_inventario' 
    AND column_name = 'proveedor'
  ) THEN
    ALTER TABLE public.cliente_inventario ADD COLUMN proveedor TEXT;
    RAISE NOTICE 'Columna proveedor agregada a cliente_inventario';
  END IF;

  -- Agregar unidad_medida si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cliente_inventario' 
    AND column_name = 'unidad_medida'
  ) THEN
    ALTER TABLE public.cliente_inventario ADD COLUMN unidad_medida TEXT DEFAULT 'unidad';
    RAISE NOTICE 'Columna unidad_medida agregada a cliente_inventario';
  END IF;

  -- Agregar margen_objetivo si no existe (diferente de margen_minimo)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cliente_inventario' 
    AND column_name = 'margen_objetivo'
  ) THEN
    ALTER TABLE public.cliente_inventario ADD COLUMN margen_objetivo NUMERIC(5,2);
    RAISE NOTICE 'Columna margen_objetivo agregada a cliente_inventario';
  END IF;
END $$;

-- Índice para búsqueda por proveedor
CREATE INDEX IF NOT EXISTS idx_cliente_inventario_proveedor 
ON public.cliente_inventario(proveedor) 
WHERE proveedor IS NOT NULL;
