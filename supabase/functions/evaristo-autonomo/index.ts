// Evaristo Autónomo - Edge Function para ejecución automática
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Email autorizado para Evaristo
const EVARISTO_AUTHORIZED_EMAIL = 'evaras@firmavb.cl';

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

    // Crear cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar token y email
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que el email sea el autorizado
    const userEmail = user.email?.toLowerCase() || '';
    if (userEmail !== EVARISTO_AUTHORIZED_EMAIL.toLowerCase()) {
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized',
          message: 'Solo el administrador autorizado puede acceder a Evaristo'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parsear request
    const body = await req.json();
    const { action, mision_file = 'mantenimiento_automatico.json', api_keys } = body;

    // Obtener API keys desde secrets o request
    const geminiKey = api_keys?.gemini || Deno.env.get('GEMINI_API_KEY') || '';
    const deepseekKey = api_keys?.deepseek || Deno.env.get('DEEPSEEK_API_KEY') || '';

    if (action === 'status') {
      return new Response(
        JSON.stringify({
          status: 'online',
          authorized: true,
          email: userEmail,
          has_gemini: !!geminiKey,
          has_deepseek: !!deepseekKey,
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ejecutar Evaristo
    // Nota: Esto requiere que Evaristo esté disponible en el entorno de Edge Functions
    // Por ahora, retornamos un mensaje indicando que se ejecutará
    // En producción, esto podría llamar a un servicio externo o usar Deno.run

    return new Response(
      JSON.stringify({
        success: true,
        message: `Misión "${mision_file}" programada para ejecución`,
        action,
        timestamp: new Date().toISOString(),
        note: "Para ejecución real, desplegar Evaristo como servicio separado o adaptar a TypeScript/Deno"
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error en evaristo-autonomo:', error);
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
