-- Fix: Agregar columna 'descripcion' a ordenes_compra si no existe
-- La migración original la incluía pero no fue aplicada correctamente
-- Error detectado: "Could not find the 'descripcion' column of 'ordenes_compra'"
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ordenes_compra' 
    AND column_name = 'descripcion'
  ) THEN
    ALTER TABLE public.ordenes_compra ADD COLUMN descripcion TEXT;
    RAISE NOTICE 'Columna descripcion agregada a ordenes_compra';
  ELSE
    RAISE NOTICE 'Columna descripcion ya existe en ordenes_compra';
  END IF;

  -- También agregar licitacion_codigo si no existe (necesaria para link con licitaciones)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ordenes_compra' 
    AND column_name = 'licitacion_codigo'
  ) THEN
    ALTER TABLE public.ordenes_compra ADD COLUMN licitacion_codigo TEXT;
    RAISE NOTICE 'Columna licitacion_codigo agregada a ordenes_compra';
  END IF;

  -- Agregar raw_data si no existe (para guardar datos completos de la API)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ordenes_compra' 
    AND column_name = 'raw_data'
  ) THEN
    ALTER TABLE public.ordenes_compra ADD COLUMN raw_data JSONB;
    RAISE NOTICE 'Columna raw_data agregada a ordenes_compra';
  END IF;
  
  -- Agregar moneda si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ordenes_compra' 
    AND column_name = 'moneda'
  ) THEN
    ALTER TABLE public.ordenes_compra ADD COLUMN moneda TEXT DEFAULT 'CLP';
    RAISE NOTICE 'Columna moneda agregada a ordenes_compra';
  END IF;
END $$;
