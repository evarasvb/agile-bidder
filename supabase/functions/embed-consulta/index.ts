import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Embedding de UN texto (lo que el cliente escribió en el buscador), para
// cruzarlo contra cliente_inventario.embedding por similitud de coseno. Se
// llama una vez por búsqueda (no por tecla) desde useBusquedaGlobal, solo
// cuando la búsqueda por texto encontró poco en el inventario.
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    if (!req.headers.get('Authorization')?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Falta autenticación' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Búsqueda inteligente no configurada' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { texto } = await req.json().catch(() => ({ texto: '' }));
    if (!texto || typeof texto !== 'string' || !texto.trim()) {
      return new Response(JSON.stringify({ error: 'Falta el texto a buscar' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const MODELOS = ['gemini-embedding-001', 'text-embedding-004'];
    let embedding: number[] | null = null;
    let ultimoError = '';
    for (const model of MODELOS) {
      const body: Record<string, unknown> = { model, input: texto.trim().slice(0, 300) };
      if (model === 'gemini-embedding-001') body.dimensions = 768;
      const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/embeddings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) { ultimoError = await resp.text().catch(() => ''); continue; }
      const j = await resp.json();
      const v = j.data?.[0]?.embedding;
      if (Array.isArray(v) && v.length) { embedding = v; break; }
      ultimoError = 'respuesta incompleta';
    }
    if (!embedding) throw new Error(`Gemini embeddings: ${ultimoError.slice(0, 300)}`);

    return new Response(JSON.stringify({ embedding }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || 'Error generando el embedding' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
