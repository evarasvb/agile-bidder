// Componente mejorado para ejecutar migración SQL automáticamente
// =================================================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Database, Copy, Check, Play, AlertCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';

const FUNCTION_SQL = `-- Crear función helper para aplicar el fix de RLS
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
    CREATE OR REPLACE FUNCTION public.is_current_user_admin()
    RETURNS BOOLEAN
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
      );
    $$;
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

GRANT EXECUTE ON FUNCTION public.apply_user_roles_rls_fix() TO authenticated;`;

const FIX_SQL = `-- Fix RLS policies for user_roles to allow admins to manage roles
-- ================================================================

-- Drop ALL existing policies on user_roles to start fresh
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- Create function to check if current user is admin (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
$$;

-- Allow all authenticated users to view all roles (needed for admin panel)
CREATE POLICY "Authenticated users can view all roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (true);

-- Allow admins to insert roles for any user (using SECURITY DEFINER function)
CREATE POLICY "Admins can insert roles" 
ON public.user_roles 
FOR INSERT 
TO authenticated
WITH CHECK (public.is_current_user_admin());

-- Allow admins to delete roles for any user (using SECURITY DEFINER function)
CREATE POLICY "Admins can delete roles" 
ON public.user_roles 
FOR DELETE 
TO authenticated
USING (public.is_current_user_admin());`;

export function ExecuteMigrationDialog() {
  const [sql, setSql] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<'function' | 'fix' | null>(null);
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

  const executeRPC = useMutation({
    mutationFn: async () => {
      // @ts-ignore - La función RPC se crea dinámicamente
      const { data, error } = await supabase.rpc('apply_user_roles_rls_fix');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('✅ Migración aplicada correctamente');
      console.log('Resultado:', data);
      setIsOpen(false);
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: (error: any) => {
      console.error('Error ejecutando RPC:', error);
      if (error?.code === '42883' || error?.message?.includes('does not exist')) {
        setCurrentStep('function');
        setSql(FUNCTION_SQL);
        toast.warning('Primero necesitas crear la función helper. SQL listo para copiar.');
      } else {
        toast.error(error?.message || 'Error al ejecutar migración');
      }
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('SQL copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  const openSQLEditor = () => {
    if (projectId) {
      window.open(`https://supabase.com/dashboard/project/${projectId}/sql/new`, '_blank');
      toast.info('Abre Supabase SQL Editor. Pega el SQL y ejecútalo.');
    } else {
      window.open('https://supabase.com/dashboard', '_blank');
      toast.info('Ve a tu proyecto en Supabase → SQL Editor.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Database className="h-4 w-4 mr-2" />
          Aplicar Migración SQL
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ejecutar Migración SQL - Fix RLS user_roles</DialogTitle>
          <DialogDescription>
            Esta migración arregla las políticas RLS para permitir a los admins gestionar roles.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!currentStep && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ejecución Automática</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Intentaré ejecutar la migración automáticamente. Si falla, te mostraré el SQL para ejecutarlo manualmente.
                </p>
                <Button
                  onClick={() => executeRPC.mutate()}
                  disabled={executeRPC.isPending}
                  className="w-full"
                >
                  {executeRPC.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Ejecutando migración...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Ejecutar Automáticamente
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === 'function' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Primero necesitas crear la función helper. Ejecuta el SQL de abajo.
              </AlertDescription>
            </Alert>
          )}

          {sql && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {currentStep === 'function' 
                      ? 'SQL: Crear Función Helper (Ejecutar PRIMERO)'
                      : 'SQL: Aplicar Fix RLS (Ejecutar DESPUÉS)'}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(sql)}
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copiar SQL
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openSQLEditor}
                    >
                      Abrir SQL Editor
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-96">
                  <code>{sql}</code>
                </pre>
                {currentStep === 'function' && (
                  <div className="mt-4">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setCurrentStep('fix');
                        setSql(FIX_SQL);
                        toast.info('Ahora ejecuta este segundo SQL');
                      }}
                    >
                      Siguiente: Aplicar Fix RLS
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!sql && !currentStep && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Instrucciones Manuales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click en "Ejecutar Automáticamente" arriba</li>
                  <li>Si falla, copia el SQL que aparece</li>
                  <li>Ve a Supabase Dashboard → SQL Editor</li>
                  <li>Pega y ejecuta el SQL</li>
                  <li>Vuelve aquí y prueba de nuevo</li>
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
