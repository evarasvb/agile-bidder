import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  licitacion_id: string;
  question: string;
  chat_id?: string;
}

async function verifyAuth(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization' }),
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
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return { userId: data.user.id, supabase };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await verifyAuth(req);
  if (authResult instanceof Response) return authResult;

  const { userId, supabase } = authResult;

  try {
    const { licitacion_id, question, chat_id }: ChatRequest = await req.json();

    if (!licitacion_id || !question?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing licitacion_id or question' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${userId} asking about licitacion ${licitacion_id}: ${question.substring(0, 100)}`);

    // Fetch all processed documents for this licitacion
    const { data: documents, error: docError } = await supabase
      .from('documentos_licitacion')
      .select('filename, contenido_texto, secciones, resumen_automatico')
      .eq('licitacion_id', licitacion_id)
      .eq('status', 'ready');

    if (docError) throw docError;

    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({
          answer: 'No hay documentos procesados para esta licitación. Por favor sube las bases de licitación primero.',
          pages_referenced: [],
          chat_id: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context from documents
    const documentContext = documents.map((doc: any) => {
      let context = `=== DOCUMENTO: ${doc.filename} ===\n`;

      // Add automatic summary if available
      if (doc.resumen_automatico) {
        context += `\nRESUMEN AUTOMÁTICO:\n${JSON.stringify(doc.resumen_automatico, null, 2)}\n`;
      }

      // Add full text (truncated if needed)
      const texto = doc.contenido_texto || '';
      if (texto.length > 0) {
        // Max ~25k chars per document to stay within token limits
        context += `\nCONTENIDO:\n${texto.substring(0, 25000)}`;
        if (texto.length > 25000) {
          context += '\n[... texto truncado por longitud ...]';
        }
      }

      return context;
    }).join('\n\n');

    // Get existing chat history for context
    let existingMessages: any[] = [];
    if (chat_id) {
      const { data: chat } = await supabase
        .from('chat_licitacion')
        .select('mensajes')
        .eq('id', chat_id)
        .single();

      if (chat?.mensajes) {
        existingMessages = chat.mensajes;
      }
    }

    // Build conversation messages for AI
    const conversationHistory = existingMessages
      .slice(-6) // Last 3 Q&A pairs for context
      .map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

    const systemPrompt = `Eres un asistente experto en licitaciones públicas de Chile (Mercado Público).
Tu rol es responder preguntas sobre las bases de licitación que el usuario ha subido.

REGLAS:
1. Responde SIEMPRE en español
2. Basa tus respuestas EXCLUSIVAMENTE en el contenido de los documentos proporcionados
3. Si la información no está en los documentos, dilo claramente: "No encontré esta información en los documentos cargados"
4. Cuando cites información, indica la fuente (nombre del documento y sección/página si es posible)
5. Sé preciso con fechas, montos y requisitos — no inventes datos
6. Usa formato claro con listas y negritas cuando sea útil
7. Si el usuario pregunta algo ambiguo, responde lo mejor posible basado en el contexto

DOCUMENTOS DE LA LICITACIÓN:
${documentContext}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: question },
    ];

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de consultas excedido. Intenta de nuevo en unos minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const answer = aiResponse.choices?.[0]?.message?.content || 'No se pudo generar una respuesta.';

    // Extract referenced pages from the answer (simple heuristic)
    const pageRefs: number[] = [];
    const pageRegex = /(?:página|pág\.?|page|p\.)\s*(\d+)/gi;
    let pageMatch;
    while ((pageMatch = pageRegex.exec(answer)) !== null) {
      pageRefs.push(parseInt(pageMatch[1]));
    }

    // Save or update chat history
    const now = new Date().toISOString();
    const newMessages = [
      ...existingMessages,
      { role: 'user', content: question, timestamp: now },
      { role: 'assistant', content: answer, timestamp: now, pages_referenced: pageRefs },
    ];

    let finalChatId = chat_id;

    if (chat_id) {
      await supabase
        .from('chat_licitacion')
        .update({ mensajes: newMessages, updated_at: now })
        .eq('id', chat_id);
    } else {
      const { data: newChat, error: chatError } = await supabase
        .from('chat_licitacion')
        .insert({
          licitacion_id,
          user_id: userId,
          mensajes: newMessages,
        })
        .select('id')
        .single();

      if (chatError) throw chatError;
      finalChatId = newChat.id;
    }

    return new Response(
      JSON.stringify({
        answer,
        pages_referenced: pageRefs,
        chat_id: finalChatId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Chat failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
