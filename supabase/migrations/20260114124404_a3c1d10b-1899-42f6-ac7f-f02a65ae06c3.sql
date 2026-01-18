-- Vista unificada de oportunidades (licitaciones + licitaciones_bi)
-- Vista condicional: solo se crea si las tablas tienen la estructura correcta

DO $$ 
BEGIN
  -- Verificar que ambas tablas existan y tengan las columnas necesarias
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'licitaciones' 
    AND column_name = 'id_licitacion'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'licitaciones_bi'
  ) THEN
    -- Crear la vista usando EXECUTE para construir el SQL dinámicamente
    EXECUTE '
    CREATE OR REPLACE VIEW public.oportunidades_all AS
    SELECT 
      id_licitacion AS codigo,
      titulo AS nombre,
      organismo AS institucion_nombre,
      estado,
      created_at AS fecha_publicacion,
      fecha_cierre,
      presupuesto AS presupuesto_estimado,
      match_score,
      match_encontrado,
      ''compra_agil'' AS tipo_proceso,
      link_oficial,
      procesada
    FROM public.licitaciones

    UNION ALL

    SELECT 
      codigo,
      nombre,
      institucion_nombre,
      estado,
      fecha_publicacion,
      fecha_cierre,
      presupuesto_estimado,
      NULL AS match_score,
      FALSE AS match_encontrado,
      ''licitacion'' AS tipo_proceso,
      NULL AS link_oficial,
      TRUE AS procesada
    FROM public.licitaciones_bi
    ';
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE NOTICE 'No se pudo crear la vista oportunidades_all: %', SQLERRM;
END $$;

-- Vista de calendario de eventos (solo si oportunidades_all existe)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'oportunidades_all'
  ) THEN
    DROP VIEW IF EXISTS public.calendario_eventos;
    EXECUTE '
    CREATE VIEW public.calendario_eventos AS
    SELECT 
      codigo,
      nombre,
      tipo_proceso,
      institucion_nombre,
      fecha_publicacion AS fecha_evento,
      ''apertura'' AS tipo_evento,
      presupuesto_estimado
    FROM public.oportunidades_all
    WHERE fecha_publicacion IS NOT NULL

    UNION ALL

    SELECT 
      codigo,
      nombre,
      tipo_proceso,
      institucion_nombre,
      fecha_cierre AS fecha_evento,
      ''cierre'' AS tipo_evento,
      presupuesto_estimado
    FROM public.oportunidades_all
    WHERE fecha_cierre IS NOT NULL
    ';
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE NOTICE 'No se pudo crear la vista calendario_eventos: %', SQLERRM;
END $$;
