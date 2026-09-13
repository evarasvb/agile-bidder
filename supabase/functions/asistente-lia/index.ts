import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pregunta, proceso_codigo, proceso_nombre, proceso_descripcion } = await req.json();

    if (!pregunta || typeof pregunta !== "string") {
      return new Response(
        JSON.stringify({ error: "Se requiere una pregunta válida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Crear cliente de Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Obtener información del proceso si hay código
    let contextoProceso = "";
    if (proceso_codigo) {
      // Buscar en compras_agiles
      const { data: compraAgil } = await supabaseClient
        .from("compras_agiles")
        .select("*")
        .eq("codigo", proceso_codigo)
        .single();

      if (compraAgil) {
        contextoProceso = `
Información del proceso:
- Código: ${compraAgil.codigo}
- Nombre: ${compraAgil.nombre}
- Organismo: ${compraAgil.organismo}
- Monto: ${compraAgil.monto ? `$${compraAgil.monto.toLocaleString('es-CL')}` : 'No especificado'}
- Estado: ${compraAgil.estado || 'No especificado'}
- Región: ${compraAgil.region || 'No especificada'}
- Descripción: ${compraAgil.descripcion || 'Sin descripción'}
- Fecha de cierre: ${compraAgil.fecha_cierre || 'No especificada'}
`;
      } else {
        // Buscar en licitaciones
        const { data: licitacion } = await supabaseClient
          .from("licitaciones")
          .select("*")
          .eq("id_licitacion", proceso_codigo)
          .single();

        if (licitacion) {
          contextoProceso = `
Información del proceso:
- Código: ${licitacion.id_licitacion}
- Título: ${licitacion.titulo}
- Organismo: ${licitacion.organismo}
- Presupuesto: ${licitacion.presupuesto ? `$${licitacion.presupuesto.toLocaleString('es-CL')}` : 'No especificado'}
- Estado: ${licitacion.estado || 'No especificado'}
`;
        }
      }

      // Obtener items del proceso
      if (proceso_codigo) {
        const { data: items } = await supabaseClient
          .from("licitacion_items")
          .select("*")
          .eq("licitacion_id", proceso_codigo)
          .limit(50);

        if (items && items.length > 0) {
          contextoProceso += `\n\nProductos solicitados:\n`;
          items.forEach((item, idx) => {
            contextoProceso += `${idx + 1}. ${item.nombre_producto}`;
            if (item.cantidad) contextoProceso += ` - Cantidad: ${item.cantidad}`;
            if (item.unidad) contextoProceso += ` ${item.unidad}`;
            if (item.descripcion) contextoProceso += `\n   Descripción: ${item.descripcion}`;
            contextoProceso += `\n`;
          });
        }
      }
    }

    // Construir prompt para la IA
    const systemPrompt = `Eres LIA, un asistente virtual experto en licitaciones públicas chilenas y compras del Estado. Tu trabajo es ayudar a los usuarios a entender las bases de licitación y responder sus preguntas de manera clara, concisa y útil.

Instrucciones:
1. Responde de manera amigable y profesional
2. Si no tienes la información, dilo claramente
3. Proporciona información específica cuando esté disponible
4. Sugiere acciones prácticas cuando sea relevante
5. Usa formato markdown para mejorar la legibilidad
6. Si la pregunta es sobre un proceso específico, usa el contexto proporcionado

Formato de respuesta:
- Usa negritas para destacar información importante
- Usa listas cuando sea apropiado
- Mantén las respuestas concisas pero completas`;

    const userPrompt = `${contextoProceso ? `\n${contextoProceso}\n` : ""}
Pregunta del usuario: ${pregunta}

Responde de manera clara y útil. Si hay información faltante, indícalo.`;

    // Llamar a la API de IA
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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en API de IA: ${response.status} - ${errorText}`);
    }

    const aiData = await response.json();
    const respuesta = aiData.choices?.[0]?.message?.content || "No pude generar una respuesta. Por favor, intenta de nuevo.";

    // Generar sugerencias basadas en la pregunta
    const sugerencias = generarSugerencias(pregunta, proceso_codigo ? true : false);

    return new Response(
      JSON.stringify({
        respuesta,
        sugerencias,
        confianza: 0.85,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error en asistente-lia:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Error al procesar la consulta",
        respuesta: "Lo siento, hubo un error al procesar tu pregunta. Por favor, intenta de nuevo.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generarSugerencias(pregunta: string, tieneProceso: boolean): string[] {
  const preguntaLower = pregunta.toLowerCase();
  const sugerencias: string[] = [];

  // Sugerencias basadas en el tipo de pregunta
  if (preguntaLower.includes("presupuesto") || preguntaLower.includes("monto") || preguntaLower.includes("precio")) {
    sugerencias.push("¿Cuál es el monto máximo que puedo ofertar?");
    sugerencias.push("¿Hay un presupuesto estimado?");
  } else if (preguntaLower.includes("producto") || preguntaLower.includes("item") || preguntaLower.includes("servicio")) {
    sugerencias.push("¿Qué especificaciones técnicas se requieren?");
    sugerencias.push("¿Hay productos alternativos aceptados?");
  } else if (preguntaLower.includes("plazo") || preguntaLower.includes("tiempo") || preguntaLower.includes("entrega")) {
    sugerencias.push("¿Cuál es el plazo mínimo de entrega?");
    sugerencias.push("¿Hay penalizaciones por retraso?");
  } else if (preguntaLower.includes("requisito") || preguntaLower.includes("condición") || preguntaLower.includes("documento")) {
    sugerencias.push("¿Qué documentos debo presentar?");
    sugerencias.push("¿Hay requisitos de experiencia?");
  } else {
    // Sugerencias generales
    sugerencias.push("¿Cuál es el presupuesto estimado?");
    sugerencias.push("¿Qué productos se necesitan?");
    if (tieneProceso) {
      sugerencias.push("¿Cuál es el plazo de entrega?");
      sugerencias.push("¿Hay condiciones especiales?");
    }
  }

  return sugerencias.slice(0, 4); // Máximo 4 sugerencias
}