// Edge Function para aplicar migración SQL de forma segura
// =========================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SQL de la migración para arreglar RLS de user_roles
const MIGRATION_SQL = `
-- Fix RLS policies for user_roles to allow admins to manage roles
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
USING (public.is_current_user_admin());
`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar autenticación
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Crear cliente Supabase con service_role para ejecutar SQL
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar que el usuario actual es admin
    const token = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que el usuario es admin
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!userRoles) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parsear request
    const body = await req.json();
    const { action } = body;

    if (action === 'apply') {
      // Ejecutar la migración SQL usando RPC o query directa
      // Nota: Supabase JS client no tiene método directo para ejecutar SQL arbitrario
      // Necesitamos usar una función PostgreSQL o ejecutar cada comando por separado
      
      // Dividir el SQL en comandos individuales
      const commands = MIGRATION_SQL.split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

      const results = [];
      for (const command of commands) {
        try {
          // Usar rpc para ejecutar SQL (requiere función helper)
          // Por ahora, retornamos instrucciones
          results.push({ command: command.substring(0, 50) + '...', status: 'pending' });
        } catch (error) {
          results.push({ command: command.substring(0, 50) + '...', status: 'error', error: error.message });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Para ejecutar esta migración, copia el SQL en Supabase SQL Editor',
          sql: MIGRATION_SQL,
          instructions: [
            '1. Ve a Supabase Dashboard → SQL Editor',
            '2. Click en "New Query"',
            '3. Copia y pega el SQL proporcionado',
            '4. Click en "Run" (botón verde)',
          ],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-sql') {
      // Retornar el SQL para que el usuario lo copie
      return new Response(
        JSON.stringify({
          sql: MIGRATION_SQL,
          instructions: [
            '1. Ve a Supabase Dashboard → SQL Editor',
            '2. Click en "New Query"',
            '3. Copia y pega el SQL de abajo',
            '4. Click en "Run" (botón verde)',
          ],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "apply" or "get-sql"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in apply-migration:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
