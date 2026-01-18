-- Update oportunidades_all view to include compras_agiles
-- Vista condicional: solo se crea si las tablas tienen la estructura correcta
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'compras_agiles'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'licitaciones'
  ) THEN
    DROP VIEW IF EXISTS public.oportunidades_all;
    EXECUTE '
    CREATE VIEW public.oportunidades_all AS
    -- Compras Ágiles desde tabla compras_agiles
    SELECT 
      codigo,
      nombre,
      nombre_organismo AS institucion_nombre,
      estado,
      created_at AS fecha_publicacion,
      fecha_cierre,
      monto_estimado AS presupuesto_estimado,
      match_score,
      match_encontrado,
      ''compra_agil'' AS tipo_proceso,
      link_oficial,
      match_encontrado AS procesada
    FROM public.compras_agiles

    UNION ALL

    -- Licitaciones desde tabla licitaciones (legacy)
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
    WHERE EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = ''public'' 
      AND table_name = ''licitaciones''
      AND column_name = ''id_licitacion''
    )

    UNION ALL

    -- Licitaciones grandes desde licitaciones_bi
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
    WHERE EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = ''public'' 
      AND table_name = ''licitaciones_bi''
    )
    ';
    
    COMMENT ON VIEW public.oportunidades_all IS 'Vista unificada de todas las oportunidades de licitación (compras ágiles desde compras_agiles y licitaciones grandes)';
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE NOTICE 'No se pudo crear/actualizar la vista oportunidades_all: %', SQLERRM;
END $$;
