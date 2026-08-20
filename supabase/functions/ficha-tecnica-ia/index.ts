import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductoInput {
  nombre: string;
  descripcion?: string | null;
  categoria?: string | null;
  unidad?: string | null;
  precio?: number | null;
  condiciones?: string | null;
}

interface FichaProducto {
  nombre: string;
  resumen: string;
  caracteristicas: Array<{ campo: string; valor: string }>;
  condiciones: string[];
  garantia: string;
  notas?: string;
}

// Verifica el JWT del usuario (mismas cabeceras que el resto de funciones).
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
    global: { headers: { Authorization: authHeader } },
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

// Ficha mínima construida SOLO con lo que ya tenemos del inventario. Es el
// respaldo si la IA no está disponible: el PDF nunca queda vacío.
function fichaFallback(p: ProductoInput): FichaProducto {
  const caracteristicas: Array<{ campo: string; valor: string }> = [];
  if (p.categoria) caracteristicas.push({ campo: 'Categoría', valor: p.categoria });
  if (p.unidad) caracteristicas.push({ campo: 'Unidad de venta', valor: p.unidad });
  if (typeof p.precio === 'number' && p.precio > 0) {
    caracteristicas.push({
      campo: 'Precio referencial neto',
      valor: new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(p.precio),
    });
  }
  return {
    nombre: p.nombre,
    resumen: p.descripcion?.trim() || `Ficha técnica de ${p.nombre}.`,
    caracteristicas,
    condiciones: [
      'Producto nuevo, en su embalaje original.',
      'Cumple con la normativa chilena vigente aplicable.',
      p.condiciones?.trim() || 'Entrega y despacho según las condiciones de la compra ágil.',
    ],
    garantia: 'Garantía del fabricante según corresponda al producto.',
  };
}

// Llama a Gemini (endpoint OpenAI-compatible) probando varios modelos, porque
// los nombres cambian con el tiempo y algunos quedan obsoletos (p.ej. 2.5-flash).
async function generarFichasConIA(productos: ProductoInput[]): Promise<FichaProducto[] | null> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) return null;

  const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  const candidatos = [
    Deno.env.get('GEMINI_MODEL') || '',
    'gemini-3.6-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash',
  ].filter(Boolean);

  const systemPrompt = `Eres un ingeniero de producto que redacta FICHAS TÉCNICAS para ofertas en Mercado Público (Chile).
A partir de la información de cada producto, redacta una ficha técnica clara, profesional y verosímil.
NO inventes marcas, modelos ni certificaciones específicas que no se puedan inferir; usa formulaciones genéricas cuando falte el dato.
Responde SOLO con un JSON válido, sin texto adicional, con esta estructura EXACTA:
{
  "fichas": [
    {
      "nombre": "nombre del producto",
      "resumen": "2-3 frases describiendo el producto y su uso",
      "caracteristicas": [{"campo": "Material", "valor": "..."}, {"campo": "Dimensiones", "valor": "..."}],
      "condiciones": ["condición comercial o técnica 1", "condición 2"],
      "garantia": "texto de garantía",
      "notas": "observaciones opcionales"
    }
  ]
}
Incluye entre 4 y 8 características por producto (las que apliquen: material, medidas, capacidad, color, normativa, uso, etc.).`;

  const userPrompt = `Genera las fichas técnicas de estos productos (mismo orden):\n${JSON.stringify(productos, null, 2)}`;

  for (const model of candidatos) {
    try {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: 4000,
        }),
      });
      if (!response.ok) continue;
      const aiResponse = await response.json();
      const content = aiResponse.choices?.[0]?.message?.content;
      if (!content) continue;
      const limpio = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(limpio);
      if (Array.isArray(parsed?.fichas) && parsed.fichas.length > 0) {
        return parsed.fichas as FichaProducto[];
      }
    } catch (_e) {
      // probamos el siguiente modelo
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await verifyAuth(req);
  if (authResult instanceof Response) return authResult;

  try {
    const body = await req.json() as { productos?: ProductoInput[] };
    const productos = (body.productos || []).filter((p) => p && p.nombre);

    if (productos.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No se recibieron productos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let fichas = await generarFichasConIA(productos);
    let fuente: 'ia' | 'inventario' = 'ia';

    // Si la IA falló o devolvió menos fichas que productos, completamos con el
    // respaldo para que siempre haya una ficha por producto.
    if (!fichas || fichas.length < productos.length) {
      fuente = fichas ? 'ia' : 'inventario';
      const base = fichas || [];
      fichas = productos.map((p, i) => base[i] ?? fichaFallback(p));
    }

    return new Response(
      JSON.stringify({ fichas, fuente }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('ficha-tecnica-ia error:', e);
    return new Response(
      JSON.stringify({ error: 'Error generando la ficha técnica' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
