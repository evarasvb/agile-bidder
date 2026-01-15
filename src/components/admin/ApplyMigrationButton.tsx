// Componente para aplicar migración SQL desde el frontend
// =======================================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Database, Copy, Check } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

export function ApplyMigrationButton() {
  const [sql, setSql] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const getMigrationSQL = useMutation({
    mutationFn: async () => {
      // Leer el SQL directamente del archivo de migración
      // En producción, esto vendría de la Edge Function
      const migrationSQL = `-- Fix RLS policies for user_roles to allow admins to manage roles
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

      return { sql: migrationSQL };
    },
    onSuccess: (data) => {
      setSql(data.sql);
      toast.success('SQL obtenido correctamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al obtener SQL');
    },
  });

  const copyToClipboard = async () => {
    if (sql) {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      toast.success('SQL copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openSQLEditor = () => {
    // Obtener el project_id de la URL de Supabase
    const supabaseUrl = supabase.supabaseUrl;
    const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    
    if (projectId) {
      window.open(`https://supabase.com/dashboard/project/${projectId}/sql/new`, '_blank');
      toast.info('Abre Supabase SQL Editor en una nueva pestaña. Pega el SQL y ejecútalo.');
    } else {
      window.open('https://supabase.com/dashboard', '_blank');
      toast.info('Ve a tu proyecto en Supabase → SQL Editor. Pega el SQL y ejecútalo.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          onClick={() => getMigrationSQL.mutate()}
          disabled={getMigrationSQL.isPending}
        >
          {getMigrationSQL.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Cargando...
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              Aplicar Migración SQL
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aplicar Migración SQL - Fix RLS user_roles</DialogTitle>
          <DialogDescription>
            Esta migración arregla las políticas RLS para permitir a los admins gestionar roles de usuarios.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Instrucciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <ol className="list-decimal list-inside space-y-1">
                <li>Click en el botón "Copiar SQL" de abajo</li>
                <li>Ve a Supabase Dashboard → SQL Editor</li>
                <li>Click en "New Query"</li>
                <li>Pega el SQL copiado</li>
                <li>Click en "Run" (botón verde)</li>
                <li>Verifica que no haya errores</li>
              </ol>
            </CardContent>
          </Card>

          {sql && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">SQL de la Migración</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyToClipboard}
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
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                  <code>{sql}</code>
                </pre>
              </CardContent>
            </Card>
          )}

          {!sql && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Click en "Aplicar Migración SQL" para obtener el SQL</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
