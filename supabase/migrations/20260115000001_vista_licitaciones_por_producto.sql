-- Vista para mostrar licitaciones abiertas por producto (estilo Lici)
-- ====================================================================
-- Vista condicional: solo se crea si las tablas tienen la estructura correcta

DO $$ 
BEGIN
  -- Verificar que todas las tablas y columnas necesarias existan
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'inventory' 
    AND column_name = 'nombre_producto'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'compras_agiles'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'licitaciones'
  ) THEN
    DROP VIEW IF EXISTS public.licitaciones_por_producto;
    
    -- Crear la vista completa
    EXECUTE format('
    CREATE VIEW public.licitaciones_por_producto AS
    WITH productos_keywords AS (
      SELECT 
        i.id as producto_id,
        i.sku,
        i.nombre_producto,
        i.categoria,
        i.keywords,
        ARRAY(
          SELECT DISTINCT unnest(
            ARRAY_CAT(
              COALESCE(i.keywords, ARRAY[]::text[]),
              ARRAY[
                LOWER(i.nombre_producto),
                LOWER(i.categoria)
              ] || 
              string_to_array(LOWER(i.nombre_producto), '' '')
            )
          )
        ) as todas_keywords
      FROM public.inventory i
      WHERE i.activo = true
    ),
    licitaciones_activas AS (
      SELECT 
        codigo,
        nombre as titulo,
        organismo,
        monto as presupuesto,
        fecha_cierre,
        estado,
        %L as tipo,
        link_oficial,
        match_score,
        match_encontrado,
        created_at
      FROM public.compras_agiles
      WHERE estado IN (%L, %L, %L)
        AND (fecha_cierre IS NULL OR fecha_cierre > NOW())
      
      UNION ALL
      
      SELECT 
        id_licitacion as codigo,
        titulo,
        organismo,
        presupuesto,
        fecha_cierre,
        estado,
        %L as tipo,
        link_oficial,
        match_score,
        match_encontrado,
        created_at
      FROM public.licitaciones
      WHERE estado IN (%L, %L, %L)
        AND (fecha_cierre IS NULL OR fecha_cierre > NOW())
    ),
    matches AS (
      SELECT DISTINCT
        pk.producto_id,
        pk.sku,
        pk.nombre_producto,
        pk.categoria,
        la.codigo as licitacion_codigo,
        la.titulo as licitacion_titulo,
        la.organismo,
        la.presupuesto,
        la.fecha_cierre,
        la.estado,
        la.tipo,
        la.link_oficial,
        la.match_score,
        la.match_encontrado,
        CASE 
          WHEN la.match_encontrado = true AND la.match_score IS NOT NULL 
          THEN la.match_score
          ELSE 
            LEAST(
              100,
              (
                SELECT COUNT(*) * 20 
                FROM unnest(pk.todas_keywords) as kw
                WHERE LOWER(la.titulo) LIKE %L || kw || %L
              )
            )
        END as score_match
      FROM productos_keywords pk
      CROSS JOIN licitaciones_activas la
      WHERE 
        EXISTS (
          SELECT 1 
          FROM unnest(pk.todas_keywords) as kw
          WHERE LOWER(la.titulo) LIKE %L || kw || %L
        )
        OR la.match_encontrado = true
    )
    SELECT 
      producto_id,
      sku,
      nombre_producto,
      categoria,
      COUNT(DISTINCT licitacion_codigo) as total_licitaciones_abiertas,
      SUM(presupuesto) as presupuesto_total_estimado,
      MAX(score_match) as mejor_match_score,
      ARRAY_AGG(DISTINCT licitacion_codigo) as licitaciones_codigos,
      ARRAY_AGG(DISTINCT organismo) as organismos,
      JSON_AGG(
        DISTINCT jsonb_build_object(
          %L, licitacion_codigo,
          %L, licitacion_titulo,
          %L, organismo,
          %L, presupuesto,
          %L, fecha_cierre,
          %L, estado,
          %L, tipo,
          %L, link_oficial,
          %L, score_match
        )
      ) as licitaciones_detalle
    FROM matches
    WHERE score_match >= 30
    GROUP BY producto_id, sku, nombre_producto, categoria
    ORDER BY total_licitaciones_abiertas DESC, mejor_match_score DESC
    ',
    'compra_agil', 'activa', 'publicada', 'abierta',
    'licitacion', 'activa', 'publicada', 'abierta',
    '%', '%', '%', '%',
    'codigo', 'titulo', 'organismo', 'presupuesto', 'fecha_cierre', 'estado', 'tipo', 'link_oficial', 'match_score'
    );
    
    COMMENT ON VIEW public.licitaciones_por_producto IS 'Vista que muestra licitaciones abiertas agrupadas por producto del inventario (estilo Lici)';
    GRANT SELECT ON public.licitaciones_por_producto TO authenticated, anon;
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE NOTICE 'No se pudo crear la vista licitaciones_por_producto: %', SQLERRM;
END $$;
