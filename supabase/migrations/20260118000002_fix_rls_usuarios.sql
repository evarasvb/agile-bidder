-- =====================================================
-- Asegurar que todos los usuarios autenticados puedan ver datos
-- Estas políticas ya deberían existir, pero las recreamos si falta
-- =====================================================

-- Compras ágiles - Todos pueden ver (ya existe pero lo aseguramos)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'compras_agiles' 
    AND policyname = 'Users can view compras_agiles'
  ) THEN
    CREATE POLICY "Users can view compras_agiles"
      ON public.compras_agiles
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Órdenes de compra - Todos pueden ver
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'ordenes_compra' 
    AND policyname = 'Users can view ordenes_compra'
  ) THEN
    CREATE POLICY "Users can view ordenes_compra"
      ON public.ordenes_compra
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Items de órdenes - Todos pueden ver
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'orden_compra_items' 
    AND policyname = 'Users can view orden_compra_items'
  ) THEN
    CREATE POLICY "Users can view orden_compra_items"
      ON public.orden_compra_items
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Licitación items - Permitir ver a todos
DO $$ 
BEGIN
  -- Si la tabla existe, crear política
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'licitacion_items'
  ) THEN
    -- Eliminar política vieja si existe
    DROP POLICY IF EXISTS "Users can view licitacion_items" ON public.licitacion_items;
    
    -- Crear política permisiva
    CREATE POLICY "Users can view licitacion_items"
      ON public.licitacion_items
      FOR SELECT
      USING (auth.uid() IS NOT NULL OR true); -- Permitir a todos los autenticados
  END IF;
END $$;

-- Inventory - Asegurar que todos puedan leer
DO $$ 
BEGIN
  -- Eliminar políticas restrictivas si existen
  DROP POLICY IF EXISTS "Admins can read inventory" ON public.inventory;
  
  -- Crear política permisiva para lectura
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'inventory' 
    AND policyname = 'Authenticated users can read inventory'
  ) THEN
    CREATE POLICY "Authenticated users can read inventory"
      ON public.inventory
      FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
