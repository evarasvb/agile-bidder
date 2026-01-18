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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'SERVICE_ROLE_KEY no configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar todas las compras con códigos de prueba
    const codigosPrueba = [
      'CA-2025-%',
      'CA-2024-%',
      'TEST-%',
      'PRUEBA-%',
      'DEMO-%',
      'SAMPLE-%'
    ];

    let todasComprasPrueba: any[] = [];

    // Buscar por cada patrón
    for (const patron of codigosPrueba) {
      const { data, error } = await supabase
        .from('compras_agiles')
        .select('id, codigo, nombre')
        .ilike('codigo', patron);

      if (error) {
        console.warn(`Error al buscar con patrón ${patron}:`, error.message);
        continue;
      }

      if (data && data.length > 0) {
        todasComprasPrueba = [...todasComprasPrueba, ...data];
      }
    }

    if (todasComprasPrueba.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          deleted: 0, 
          message: 'No se encontraron datos de prueba para eliminar' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Eliminar todos usando los IDs
    const ids = todasComprasPrueba.map(c => c.id);
    
    const { error: deleteError } = await supabase
      .from('compras_agiles')
      .delete()
      .in('id', ids);

    if (deleteError) {
      throw deleteError;
    }

    // Verificar resultado
    const { count: countFinal } = await supabase
      .from('compras_agiles')
      .select('*', { count: 'exact', head: true });

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted: ids.length,
        totalRestante: countFinal || 0,
        mensaje: `Eliminados ${ids.length} registros de prueba exitosamente`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
