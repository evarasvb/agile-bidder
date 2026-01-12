import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScoringRequest {
  cliente: {
    categoria_negocio: string;
    palabras_clave: string[];
    exclusiones: string[];
  };
  licitacion: {
    titulo: string;
    organismo: string;
    items: Array<{
      nombre_producto: string;
      descripcion?: string;
    }>;
  };
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authentication
  const authResult = await verifyAuth(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { userId } = authResult;
  console.log(`Authenticated user: ${userId}`);

  try {
    const { cliente, licitacion }: ScoringRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `Analiza la compatibilidad entre este cliente y esta licitación.

CLIENTE:
- Categoría de negocio: ${cliente.categoria_negocio}
- Palabras clave de productos: ${cliente.palabras_clave.join(', ')}
- Productos que NO vende: ${cliente.exclusiones.join(', ')}

LICITACIÓN:
- Título: ${licitacion.titulo}
- Organismo: ${licitacion.organismo}
- Items solicitados: ${licitacion.items.map(i => `${i.nombre_producto}: ${i.descripcion || ''}`).join('; ')}

Responde SOLO con un JSON usando la función proporcionada.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Eres un experto en licitaciones públicas chilenas. Analiza compatibilidad entre proveedores y licitaciones." },
          { role: "user", content: prompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "calcular_score",
              description: "Calcula el score de compatibilidad entre cliente y licitación",
              parameters: {
                type: "object",
                properties: {
                  score: { 
                    type: "number", 
                    description: "Porcentaje de compatibilidad (0-100)" 
                  },
                  razon: { 
                    type: "string", 
                    description: "Explicación breve del score" 
                  },
                  productos_match: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Lista de productos del cliente que coinciden" 
                  },
                  productos_faltantes: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Productos solicitados que el cliente no tiene" 
                  },
                  excluido: {
                    type: "boolean",
                    description: "True si la licitación pide algo que el cliente excluyó"
                  }
                },
                required: ["score", "razon", "productos_match", "productos_faltantes", "excluido"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "calcular_score" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI Response:", JSON.stringify(data));

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: simple scoring
    return new Response(JSON.stringify({
      score: 50,
      razon: "Análisis básico - revisar manualmente",
      productos_match: [],
      productos_faltantes: [],
      excluido: false
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Scoring error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      score: 0 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
