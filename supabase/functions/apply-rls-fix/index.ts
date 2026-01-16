// Edge Function para aplicar el fix de RLS directamente
// ====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar que el usuario es admin
    const token = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar admin
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

    // Ejecutar la función PostgreSQL helper que aplica el fix
    const { data, error } = await supabaseAdmin.rpc('apply_user_roles_rls_fix');

    if (error) {
      console.error('Error ejecutando función:', error);
      
      // Si la función no existe, retornar SQL para ejecución manual
      if (error.code === '42883' || error.message.includes('does not exist')) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'La función helper no existe. Ejecuta primero la migración 20260115000003_create_apply_rls_fix_function.sql',
            sql: `
-- Primero ejecuta esta migración para crear la función helper:
-- supabase/migrations/20260115000003_create_apply_rls_fix_function.sql

-- Luego ejecuta esta migración:
-- supabase/migrations/20260115000002_fix_user_roles_rls.sql
            `.trim(),
            instructions: [
              '1. Ejecuta primero: 20260115000003_create_apply_rls_fix_function.sql',
              '2. Luego ejecuta: 20260115000002_fix_user_roles_rls.sql',
              '3. O usa el botón "Aplicar Migración SQL" en la UI',
            ],
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: data?.success !== false,
        message: 'Migración aplicada correctamente',
        steps: data?.steps || [],
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in apply-rls-fix:', error);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
