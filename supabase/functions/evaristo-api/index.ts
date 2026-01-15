// Evaristo API - Edge Function para ejecutar Evaristo remotamente
// ================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvaristoRequest {
  action: 'revisar' | 'mision' | 'status';
  mision_file?: string;
  api_keys?: {
    gemini?: string;
    deepseek?: string;
  };
}

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

    // Verificar token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parsear request
    const body: EvaristoRequest = await req.json();
    const { action, mision_file, api_keys } = body;

    // Obtener API keys desde secrets o request
    const geminiKey = api_keys?.gemini || Deno.env.get('GEMINI_API_KEY') || '';
    const deepseekKey = api_keys?.deepseek || Deno.env.get('DEEPSEEK_API_KEY') || '';

    if (action === 'status') {
      return new Response(
        JSON.stringify({
          status: 'online',
          has_gemini: !!geminiKey,
          has_deepseek: !!deepseekKey,
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ejecutar Evaristo usando Deno.run
    const evaristoPath = '/workspace/evaristo/evaristo_manager.py';
    
    let command: string[];
    if (action === 'revisar') {
      command = ['python3', evaristoPath, 'revisar'];
    } else if (action === 'mision' && mision_file) {
      command = ['python3', evaristoPath, 'mision', mision_file];
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action or missing mision_file' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Configurar variables de entorno
    const env: Record<string, string> = {
      ...Deno.env.toObject(),
    };
    
    if (geminiKey) env.GEMINI_API_KEY = geminiKey;
    if (deepseekKey) env.DEEPSEEK_API_KEY = deepseekKey;

    // Ejecutar Evaristo
    const process = Deno.run({
      cmd: command,
      env: env,
      stdout: 'piped',
      stderr: 'piped',
      cwd: '/workspace',
    });

    const [status, stdout, stderr] = await Promise.all([
      process.status(),
      process.output(),
      process.stderrOutput(),
    ]);

    process.close();

    const output = new TextDecoder().decode(stdout);
    const error = new TextDecoder().decode(stderr);

    // Obtener último reporte
    let lastReport = null;
    try {
      const reportFile = await Deno.readTextFile('/workspace/evaristo/reportes/resumen_latest.json');
      lastReport = JSON.parse(reportFile);
    } catch {
      // Reporte no disponible
    }

    return new Response(
      JSON.stringify({
        success: status.code === 0,
        exit_code: status.code,
        output: output,
        error: error || undefined,
        report: lastReport,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en evaristo-api:', error);
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
