import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Edge Function para aplicar migraciones automáticamente
 * 
 * Esta función ejecuta SQL directamente usando el service role key
 * que tiene permisos completos en la base de datos.
 * 
 * Uso:
 *   POST /functions/v1/apply-migrations-auto
 *   Body: { sql: "SQL a ejecutar" }
 *   Headers: { Authorization: "Bearer <service_role_key>" }
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verificar autenticación
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar que el token sea el service role key
    if (token !== supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Invalid service role key' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parsear body
    const body = await req.json();
    const { sql, migration_name } = body;

    if (!sql) {
      return new Response(
        JSON.stringify({ error: 'SQL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Crear cliente de Supabase con service role (tiene permisos completos)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log(`Executing migration: ${migration_name || 'unnamed'}`);

    // Dividir SQL en statements individuales
    // Filtrar comentarios y líneas vacías
    const statements = sql
      .split(';')
      .map((s: string) => s.trim())
      .filter((s: string) => {
        const trimmed = s.trim();
        return trimmed.length > 0 && 
               !trimmed.startsWith('--') && 
               !trimmed.toLowerCase().startsWith('comment');
      })
      .map((s: string) => s + ';');

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Ejecutar cada statement usando el cliente de Supabase
    // Nota: Supabase JS client no permite ejecutar SQL arbitrario directamente
    // Necesitamos usar una función PostgreSQL helper o la Management API
    
    // Intentar usar una función helper si existe
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (!statement.trim() || statement.trim() === ';') continue;

      try {
        // Intentar ejecutar usando rpc (requiere función helper)
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql_text: statement 
        });

        if (error) {
          // Si exec_sql no existe, necesitamos crearla primero
          // Por ahora, retornamos el SQL para ejecución manual
          console.warn(`Statement ${i + 1} failed: ${error.message}`);
          results.push({
            statement: i + 1,
            success: false,
            error: error.message,
            sql: statement.substring(0, 100) + '...',
          });
          errorCount++;
        } else {
          results.push({
            statement: i + 1,
            success: true,
          });
          successCount++;
        }
      } catch (err) {
        console.error(`Error executing statement ${i + 1}:`, err);
        results.push({
          statement: i + 1,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          sql: statement.substring(0, 100) + '...',
        });
        errorCount++;
      }
    }

    // Si todas fallaron, retornar el SQL para ejecución manual
    if (errorCount === statements.length) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No se pudo ejecutar automáticamente. Se requiere función helper exec_sql.',
          sql: sql,
          instructions: [
            '1. Crea la función helper en Supabase:',
            '   CREATE OR REPLACE FUNCTION exec_sql(sql_text TEXT)',
            '   RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$',
            '   BEGIN EXECUTE sql_text; RETURN jsonb_build_object(\'success\', true); END; $$;',
            '2. O ejecuta el SQL manualmente en Supabase Dashboard → SQL Editor',
          ],
          results: results,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Migración ejecutada: ${successCount} statements exitosos, ${errorCount} errores`,
        results: results,
        summary: {
          total: statements.length,
          success: successCount,
          errors: errorCount,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in apply-migrations-auto:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
