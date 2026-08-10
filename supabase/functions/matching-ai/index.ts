import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InventarioProducto {
  id: string;
  sku: string;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  palabras_clave?: string[];
  precio_unitario: number;
  stock: number;
}

interface LicitacionInput {
  id_licitacion: string;
  titulo: string;
  organismo: string;
  presupuesto?: number;
  items?: Array<{
    nombre_producto: string;
    descripcion?: string;
    cantidad?: number;
  }>;
}

interface MatchingRequest {
  licitaciones: LicitacionInput[];
  inventario: InventarioProducto[];
}

interface ProductoMatch {
  producto_id: string;
  sku: string;
  nombre: string;
  score: number;
  razon: string;
}

interface MatchResult {
  licitacion_id: string;
  match_score: number;
  productos_match: ProductoMatch[];
  razon_general: string;
  recomendacion: 'ofertar' | 'revisar' | 'descartar';
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
    const { licitaciones, inventario }: MatchingRequest = await req.json();
    
    console.log(`Procesando ${licitaciones.length} licitaciones contra ${inventario.length} productos`);
    
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    // Endpoint compatible con OpenAI de Google Gemini (soporta tool-calling).
    const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

    const results: MatchResult[] = [];

    // Procesar cada licitación
    for (const licitacion of licitaciones) {
      console.log(`Analizando licitación: ${licitacion.id_licitacion}`);
      
      // Crear resumen del inventario para el prompt
      const inventarioResumen = inventario.map(p => 
        `- ${p.sku}: ${p.nombre} (${p.categoria || 'Sin categoría'}) - Stock: ${p.stock}, Precio: $${p.precio_unitario}`
      ).join('\n');

      // Crear resumen de items de licitación
      const itemsResumen = licitacion.items?.map(i => 
        `- ${i.nombre_producto}${i.descripcion ? `: ${i.descripcion}` : ''} ${i.cantidad ? `(Cantidad: ${i.cantidad})` : ''}`
      ).join('\n') || 'No hay items detallados';

      const prompt = `Analiza la compatibilidad entre estos productos de inventario y esta licitación pública chilena.

INVENTARIO DISPONIBLE:
${inventarioResumen}

LICITACIÓN:
- ID: ${licitacion.id_licitacion}
- Título: ${licitacion.titulo}
- Organismo: ${licitacion.organismo}
${licitacion.presupuesto ? `- Presupuesto: $${licitacion.presupuesto.toLocaleString('es-CL')}` : ''}

ITEMS SOLICITADOS:
${itemsResumen}

Analiza semánticamente qué productos del inventario coinciden con lo solicitado en la licitación.
Considera sinónimos, variaciones y productos relacionados.
Responde usando la función proporcionada.`;

      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GEMINI_MODEL,
          messages: [
            { 
              role: "system", 
              content: `Eres un experto en licitaciones públicas chilenas y análisis de compatibilidad de productos.
Tu trabajo es determinar qué productos de un inventario pueden satisfacer los requerimientos de una licitación.
Debes considerar:
1. Coincidencias exactas de productos
2. Productos similares o equivalentes
3. Categorías relacionadas
4. Análisis semántico del texto (sinónimos, variaciones)
5. Capacidad de stock para cumplir la demanda

Sé riguroso pero no descartes productos que podrían servir con pequeñas variaciones.` 
            },
            { role: "user", content: prompt }
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "reportar_match",
                description: "Reporta el resultado del análisis de compatibilidad entre inventario y licitación",
                parameters: {
                  type: "object",
                  properties: {
                    match_score: { 
                      type: "number", 
                      description: "Porcentaje de compatibilidad general (0-100). 80+ es alta, 50-79 es media, menos de 50 es baja" 
                    },
                    productos_match: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          producto_id: { type: "string", description: "ID del producto del inventario" },
                          sku: { type: "string", description: "SKU del producto" },
                          nombre: { type: "string", description: "Nombre del producto" },
                          score: { type: "number", description: "Score de match específico para este producto (0-100)" },
                          razon: { type: "string", description: "Razón breve de por qué este producto hace match" }
                        },
                        required: ["producto_id", "sku", "nombre", "score", "razon"]
                      },
                      description: "Lista de productos que coinciden con la licitación"
                    },
                    razon_general: { 
                      type: "string", 
                      description: "Explicación general de por qué hay o no hay match" 
                    },
                    recomendacion: {
                      type: "string",
                      enum: ["ofertar", "revisar", "descartar"],
                      description: "Recomendación: 'ofertar' (score >= 70), 'revisar' (score 40-69), 'descartar' (score < 40)"
                    }
                  },
                  required: ["match_score", "productos_match", "razon_general", "recomendacion"],
                  additionalProperties: false
                }
              }
            }
          ],
          tool_choice: { type: "function", function: { name: "reportar_match" } }
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.error("Rate limit exceeded");
          // Continuar con score 0 para esta licitación
          results.push({
            licitacion_id: licitacion.id_licitacion,
            match_score: 0,
            productos_match: [],
            razon_general: "Error de rate limit - reintentar más tarde",
            recomendacion: 'revisar'
          });
          continue;
        }
        if (response.status === 402 || response.status === 403) {
          console.error("Gemini API auth/quota error");
          throw new Error("Error de autenticación o cuota con la API de Gemini");
        }
        const errorText = await response.text();
        console.error("Gemini API error:", response.status, errorText);
        continue;
      }

      const data = await response.json();
      console.log("AI Response for", licitacion.id_licitacion, ":", JSON.stringify(data));

      // Extract tool call result
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const result = JSON.parse(toolCall.function.arguments);
        results.push({
          licitacion_id: licitacion.id_licitacion,
          match_score: result.match_score,
          productos_match: result.productos_match || [],
          razon_general: result.razon_general,
          recomendacion: result.recomendacion
        });
      } else {
        // Fallback si no hay tool call
        results.push({
          licitacion_id: licitacion.id_licitacion,
          match_score: 0,
          productos_match: [],
          razon_general: "No se pudo analizar - respuesta IA inválida",
          recomendacion: 'revisar'
        });
      }
    }

    console.log(`Matching completado. ${results.filter(r => r.match_score >= 50).length} de ${results.length} con match`);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Matching error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      results: []
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
