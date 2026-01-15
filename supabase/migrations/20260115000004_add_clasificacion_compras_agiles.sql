-- Agregar columnas de clasificación a compras_agiles
-- Clasificación según regla de negocio: 100 UTM = $6.975.100 CLP (Enero 2026)

-- Agregar columnas si no existen
DO $$ 
BEGIN
  -- Agregar nombre_organismo si no existe (campo real de BD)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'compras_agiles' 
    AND column_name = 'nombre_organismo'
  ) THEN
    ALTER TABLE public.compras_agiles 
    ADD COLUMN nombre_organismo TEXT;
    
    -- Migrar datos de organismo a nombre_organismo
    UPDATE public.compras_agiles
    SET nombre_organismo = organismo
    WHERE nombre_organismo IS NULL AND organismo IS NOT NULL;
  END IF;

  -- Agregar monto_estimado si no existe (campo real de BD)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'compras_agiles' 
    AND column_name = 'monto_estimado'
  ) THEN
    ALTER TABLE public.compras_agiles 
    ADD COLUMN monto_estimado NUMERIC(15,2);
    
    -- Migrar datos de monto a monto_estimado
    UPDATE public.compras_agiles
    SET monto_estimado = monto
    WHERE monto_estimado IS NULL AND monto IS NOT NULL;
  END IF;

  -- Agregar tipo_proceso si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'compras_agiles' 
    AND column_name = 'tipo_proceso'
  ) THEN
    ALTER TABLE public.compras_agiles 
    ADD COLUMN tipo_proceso VARCHAR(20) DEFAULT 'compra_agil';
  END IF;

  -- Agregar categoria si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'compras_agiles' 
    AND column_name = 'categoria'
  ) THEN
    ALTER TABLE public.compras_agiles 
    ADD COLUMN categoria VARCHAR(10) DEFAULT 'L1';
  END IF;
END $$;

-- Clasificar registros existentes según monto
-- UTM Enero 2026: $69.751 CLP
-- Umbral: 100 UTM = $6.975.100 CLP
-- Usar monto_estimado si existe, sino monto
UPDATE public.compras_agiles
SET 
  tipo_proceso = CASE
    WHEN COALESCE(monto_estimado, monto) IS NULL OR COALESCE(monto_estimado, monto) = 0 THEN 'compra_agil'
    WHEN COALESCE(monto_estimado, monto) <= 6975100 THEN 'compra_agil'  -- <= 100 UTM
    ELSE 'licitacion'  -- > 100 UTM
  END,
  categoria = CASE
    WHEN COALESCE(monto_estimado, monto) IS NULL OR COALESCE(monto_estimado, monto) = 0 THEN 'L1'
    WHEN COALESCE(monto_estimado, monto) <= 6975100 THEN 'L1'  -- < 100 UTM = Compra Ágil
    WHEN COALESCE(monto_estimado, monto) <= 69751000 THEN 'LE'  -- 100 a 1.000 UTM = Intermedia
    WHEN COALESCE(monto_estimado, monto) <= 348755000 THEN 'LP'  -- 1.000 a 5.000 UTM = Mayor
    ELSE 'LR'  -- > 5.000 UTM = Gran Compra
  END
WHERE tipo_proceso IS NULL OR categoria IS NULL;

-- Agregar comentarios
COMMENT ON COLUMN public.compras_agiles.tipo_proceso IS 'Tipo de proceso: compra_agil o licitacion según monto (umbral: 100 UTM = $6.975.100 CLP)';
COMMENT ON COLUMN public.compras_agiles.categoria IS 'Categoría según MercadoPúblico: L1 (<100 UTM), LE (100-1000 UTM), LP (1000-5000 UTM), LR (>5000 UTM)';

-- Crear índices para mejor performance en filtros
CREATE INDEX IF NOT EXISTS idx_compras_agiles_tipo_proceso ON public.compras_agiles(tipo_proceso);
CREATE INDEX IF NOT EXISTS idx_compras_agiles_categoria ON public.compras_agiles(categoria);
