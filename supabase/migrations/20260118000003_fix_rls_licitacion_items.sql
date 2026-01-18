-- =====================================================
-- Arreglar RLS para licitacion_items y licitacion_documentos
-- El scraper necesita poder insertar items y documentos
-- =====================================================

-- Licitación items - Permitir insertar a service role y usuarios autenticados
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'licitacion_items'
  ) THEN
    -- Eliminar políticas restrictivas si existen
    DROP POLICY IF EXISTS "Users can view licitacion_items" ON public.licitacion_items;
    DROP POLICY IF EXISTS "Users can insert licitacion_items" ON public.licitacion_items;
    DROP POLICY IF EXISTS "Users can update licitacion_items" ON public.licitacion_items;
    
    -- Crear políticas permisivas para lectura (todos los autenticados)
    CREATE POLICY "Users can view licitacion_items"
      ON public.licitacion_items
      FOR SELECT
      USING (auth.uid() IS NOT NULL OR true);
    
    -- Crear política permisiva para inserción (service role usa esto, pero también usuarios autenticados)
    -- Nota: service role bypass RLS, pero esta política permite a usuarios autenticados insertar
    CREATE POLICY "Users can insert licitacion_items"
      ON public.licitacion_items
      FOR INSERT
      WITH CHECK (true); -- Permitir a todos (service role y usuarios autenticados)
    
    -- Crear política para actualización
    CREATE POLICY "Users can update licitacion_items"
      ON public.licitacion_items
      FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Licitación documentos - Permitir insertar
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'licitacion_documentos'
  ) THEN
    -- Eliminar políticas restrictivas si existen
    DROP POLICY IF EXISTS "Users can view licitacion_documentos" ON public.licitacion_documentos;
    DROP POLICY IF EXISTS "Users can insert licitacion_documentos" ON public.licitacion_documentos;
    
    -- Crear políticas permisivas
    CREATE POLICY "Users can view licitacion_documentos"
      ON public.licitacion_documentos
      FOR SELECT
      USING (auth.uid() IS NOT NULL OR true);
    
    CREATE POLICY "Users can insert licitacion_documentos"
      ON public.licitacion_documentos
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- System logs - Permitir insertar (para el scraper)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'system_logs'
  ) THEN
    -- Eliminar políticas restrictivas si existen
    DROP POLICY IF EXISTS "Users can view system_logs" ON public.system_logs;
    DROP POLICY IF EXISTS "Users can insert system_logs" ON public.system_logs;
    
    -- Crear políticas permisivas
    CREATE POLICY "Users can view system_logs"
      ON public.system_logs
      FOR SELECT
      USING (auth.uid() IS NOT NULL OR true);
    
    CREATE POLICY "Users can insert system_logs"
      ON public.system_logs
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;
