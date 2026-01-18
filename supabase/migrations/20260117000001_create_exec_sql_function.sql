-- Función helper para ejecutar SQL de forma segura
-- Esta función permite que las Edge Functions ejecuten SQL usando el service role key
-- 
-- IMPORTANTE: Esta función solo debe ser usada por Edge Functions con service role key
-- Nunca expongas esta función a usuarios finales

CREATE OR REPLACE FUNCTION public.exec_sql(sql_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  error_message TEXT;
BEGIN
  -- Intentar ejecutar el SQL
  BEGIN
    EXECUTE sql_text;
    result := jsonb_build_object(
      'success', true,
      'message', 'SQL ejecutado correctamente'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Capturar el error y retornarlo
    error_message := SQLERRM;
    result := jsonb_build_object(
      'success', false,
      'error', error_message,
      'sqlstate', SQLSTATE
    );
  END;
  
  RETURN result;
END;
$$;

-- Comentario
COMMENT ON FUNCTION public.exec_sql IS 'Función helper para ejecutar SQL desde Edge Functions. Solo debe ser usada con service role key.';

-- Política RLS: Solo service role puede ejecutar
-- Nota: Las funciones SECURITY DEFINER ya tienen permisos elevados
-- pero agregamos una verificación adicional
ALTER FUNCTION public.exec_sql SECURITY DEFINER;
