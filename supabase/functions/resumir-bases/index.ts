import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResumenRequest {
  texto: string;
  tipo?: 'bases' | 'requisitos' | 'productos';
}

interface ResumenResponse {
  resumen: string;
  requisitos: string[];
  productos: Array<{
    nombre: string;
    cantidad?: string;
    especificaciones?: string;
  }>;
  fechas: Array<{
    tipo: string;
    fecha: string;
  }>;
  garantias?: {
    seriedad?: string;
    fiel_cumplimiento?: string;
  };
  criterios_evaluacion?: string[];
}

// Verify authentication
async function verifyAuth(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return { userId: data.user.id };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authentication
  const authResult = await verifyAuth(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { userId } = authResult;
  console.log(`Authenticated user: ${userId} - Processing resumir-bases request`);

  try {
    const { texto, tipo = 'bases' } = await req.json() as ResumenRequest;

    if (!texto || texto.trim().length < 100) {
      return new Response(
        JSON.stringify({ error: 'El texto es demasiado corto para analizar' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Truncate text if too long (max ~30k chars to stay within token limits)
    const textoTruncado = texto.length > 30000 ? texto.substring(0, 30000) + '...' : texto;

    const systemPrompt = `Eres un asistente experto en licitaciones públicas de Chile (Mercado Público). 
Tu tarea es analizar documentos de bases de licitación y extraer información estructurada.

DEBES responder SOLO con un JSON válido sin ningún texto adicional. El JSON debe tener exactamente esta estructura:
{
  "resumen": "Resumen ejecutivo de 2-3 párrafos",
  "requisitos": ["lista de requisitos obligatorios"],
  "productos": [{"nombre": "nombre del producto", "cantidad": "cantidad si se especifica", "especificaciones": "especificaciones técnicas"}],
  "fechas": [{"tipo": "tipo de fecha (cierre, visita, preguntas, etc)", "fecha": "fecha en formato DD/MM/YYYY HH:mm"}],
  "garantias": {"seriedad": "monto o porcentaje", "fiel_cumplimiento": "monto o porcentaje"},
  "criterios_evaluacion": ["lista de criterios de evaluación y sus pesos"]
}`;

    const userPrompt = tipo === 'requisitos' 
      ? `Extrae SOLO los requisitos técnicos y administrativos de este documento:\n\n${textoTruncado}`
      : tipo === 'productos'
      ? `Extrae SOLO los productos o servicios solicitados de este documento:\n\n${textoTruncado}`
      : `Analiza completamente este documento de bases de licitación:\n\n${textoTruncado}`;

    console.log(`User ${userId} calling Lovable AI to summarize bases (${texto.length} chars)`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4000
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI gateway error:", response.status);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log(`User ${userId} - AI response received, parsing JSON...`);

    // Try to parse the JSON response
    let parsedResponse: ResumenResponse;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      parsedResponse = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Return a simplified response if parsing fails
      parsedResponse = {
        resumen: content,
        requisitos: [],
        productos: [],
        fechas: [],
        criterios_evaluacion: []
      };
    }

    return new Response(
      JSON.stringify(parsedResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in resumir-bases:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Error procesando el documento',
        resumen: '',
        requisitos: [],
        productos: [],
        fechas: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
