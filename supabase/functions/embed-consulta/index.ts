import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claveMistral, embeber } from "../_shared/embeddings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Vector de UN texto (lo que el cliente escribió en el buscador), para cruzarlo
// contra cliente_inventario.embedding por coseno. Mismo proveedor y modelo que
// embed-items (_shared/embeddings.ts): si no, los vectores no son comparables.
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    if (!req.headers.get('Authorization')?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Falta autenticación' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { texto } = await req.json().catch(() => ({ texto: '' }));
    if (!texto || typeof texto !== 'string' || !texto.trim()) {
      return new Response(JSON.stringify({ error: 'Falta el texto a buscar' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // La clave se lee con service role solo para este paso; nunca sale al cliente.
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const apiKey = await claveMistral(admin);
    const [embedding] = await embeber([texto.trim().slice(0, 300)], apiKey);
    return new Response(JSON.stringify({ embedding }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || 'Error generando el embedding' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
