-- Crear función helper para aplicar el fix de RLS
-- ===============================================

CREATE OR REPLACE FUNCTION public.apply_user_roles_rls_fix()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB := '{"success": true, "steps": []}'::JSONB;
  step_result TEXT;
BEGIN
  -- Paso 1: Eliminar políticas existentes
  BEGIN
    DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Authenticated users can view all roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
    step_result := 'Políticas eliminadas';
  EXCEPTION WHEN OTHERS THEN
    step_result := 'Error eliminando políticas: ' || SQLERRM;
  END;
  result := jsonb_set(result, '{steps}', (result->'steps') || jsonb_build_array(step_result));

  -- Paso 2: Crear función helper
  BEGIN
    EXECUTE '
    CREATE OR REPLACE FUNCTION public.is_current_user_admin()
    RETURNS BOOLEAN
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $inner$
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = ''admin''
      );
    $inner$;
    ';
    step_result := 'Función is_current_user_admin creada';
  EXCEPTION WHEN OTHERS THEN
    step_result := 'Error creando función: ' || SQLERRM;
  END;
  result := jsonb_set(result, '{steps}', (result->'steps') || jsonb_build_array(step_result));

  -- Paso 3: Crear política de SELECT
  BEGIN
    CREATE POLICY "Authenticated users can view all roles" 
    ON public.user_roles 
    FOR SELECT 
    TO authenticated
    USING (true);
    step_result := 'Política SELECT creada';
  EXCEPTION WHEN OTHERS THEN
    step_result := 'Error creando política SELECT: ' || SQLERRM;
  END;
  result := jsonb_set(result, '{steps}', (result->'steps') || jsonb_build_array(step_result));

  -- Paso 4: Crear política de INSERT
  BEGIN
    CREATE POLICY "Admins can insert roles" 
    ON public.user_roles 
    FOR INSERT 
    TO authenticated
    WITH CHECK (public.is_current_user_admin());
    step_result := 'Política INSERT creada';
  EXCEPTION WHEN OTHERS THEN
    step_result := 'Error creando política INSERT: ' || SQLERRM;
  END;
  result := jsonb_set(result, '{steps}', (result->'steps') || jsonb_build_array(step_result));

  -- Paso 5: Crear política de DELETE
  BEGIN
    CREATE POLICY "Admins can delete roles" 
    ON public.user_roles 
    FOR DELETE 
    TO authenticated
    USING (public.is_current_user_admin());
    step_result := 'Política DELETE creada';
  EXCEPTION WHEN OTHERS THEN
    step_result := 'Error creando política DELETE: ' || SQLERRM;
    result := jsonb_set(result, '{success}', 'false'::jsonb);
  END;
  result := jsonb_set(result, '{steps}', (result->'steps') || jsonb_build_array(step_result));

  RETURN result;
END;
$$;

-- Permitir a admins ejecutar esta función
GRANT EXECUTE ON FUNCTION public.apply_user_roles_rls_fix() TO authenticated;
