import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductoRow {
  id: string;
  sku: string | null;
  nombre_producto: string | null;
  nombre: string | null;
  descripcion: string | null;
  categoria: string | null;
  marca: string | null;
  imagen_url: string | null;
  palabras_clave: string[] | null;
}

interface EnriquecidoIA {
  descripcion?: string;
  palabras_clave?: string[];
  marca?: string;
  query_imagen?: string;
}

async function verifyUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (error || !data?.user) return null;
  return data.user.id;
}

// Genera, en un solo llamado, descripcion + palabras clave + query de imagen
// (en ingles, para mejores resultados de banco) para todos los productos.
async function enriquecerConIA(productos: ProductoRow[]): Promise<EnriquecidoIA[] | null> {
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

  const entrada = productos.map((p) => ({
    nombre: p.nombre_producto || p.nombre || '',
    categoria: p.categoria || '',
    marca: p.marca || '',
    descripcion_actual: p.descripcion || '',
  }));

  const systemPrompt = `Eres un especialista en catalogos de productos para ventas al Estado (Chile).
Para cada producto entrega:
- "descripcion": 2 a 3 frases claras y profesionales en espanol (uso, material/tipo, para que sirve). No inventes marcas ni modelos que no esten dados.
- "palabras_clave": 6 a 10 palabras genericas en espanol para el matching (sin marcas, sin medidas especificas).
- "marca": solo si es evidente por el nombre; si no, cadena vacia.
- "query_imagen": 2 a 4 palabras EN INGLES para buscar una foto de banco representativa (ej: "office chair", "safety helmet").
Responde SOLO con un JSON valido, sin texto extra, con esta forma EXACTA y EN EL MISMO ORDEN:
{ "items": [ { "descripcion": "...", "palabras_clave": ["..."], "marca": "", "query_imagen": "..." } ] }`;

  const userPrompt = `Productos:\n${JSON.stringify(entrada, null, 2)}`;

  for (const model of candidatos) {
    try {
      const resp = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
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
      if (!resp.ok) continue;
      const j = await resp.json();
      const content = j.choices?.[0]?.message?.content;
      if (!content) continue;
      const limpio = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(limpio);
      if (Array.isArray(parsed?.items)) return parsed.items as EnriquecidoIA[];
    } catch (_e) {
      // siguiente modelo
    }
  }
  return null;
}

// Busca hasta N fotos de banco en Pexels y devuelve sus URLs (para armar galería).
async function buscarFotosPexels(query: string, n = 3): Promise<string[]> {
  const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY');
  if (!PEXELS_API_KEY || !query) return [];
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${n}&orientation=square`;
    const resp = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
    if (!resp.ok) return [];
    const j = await resp.json();
    const fotos = (j?.photos || []) as Array<{ src?: Record<string, string> }>;
    return fotos
      .map((f) => f?.src?.large || f?.src?.medium || f?.src?.original || '')
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Fallback: Unsplash cuando Pexels no trae fotos (o no hay key de Pexels).
async function buscarFotosUnsplash(query: string, n: number): Promise<string[]> {
  const key = Deno.env.get('UNSPLASH_ACCESS_KEY');
  if (!key || !query) return [];
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${n}`;
    const r = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
    if (!r.ok) return [];
    const j = await r.json();
    return ((j?.results || []) as Array<{ urls?: Record<string, string> }>)
      .map((p) => p?.urls?.regular || p?.urls?.full || '')
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Pexels primero; si no alcanza, completamos con Unsplash.
async function buscarFotos(query: string, n: number): Promise<string[]> {
  const p = await buscarFotosPexels(query, n);
  if (p.length >= n) return p;
  const u = await buscarFotosUnsplash(query, n - p.length);
  return [...p, ...u].slice(0, n);
}

// Baja una imagen y la sube a nuestro bucket; devuelve { url, path } o null.
async function subirImagen(
  admin: any,
  clienteId: string,
  base: string,
  imgUrl: string,
  idx: number
): Promise<{ url: string; path: string } | null> {
  try {
    const imgResp = await fetch(imgUrl);
    if (!imgResp.ok) return null;
    const bytes = new Uint8Array(await imgResp.arrayBuffer());
    const safe = base.replace(/[^a-zA-Z0-9_-]/g, '_');
    const path = `enriquecidas/${clienteId}/${safe}-${Date.now()}-${idx}.jpg`;
    const { error } = await admin.storage
      .from('product-images')
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
    if (error) return null;
    const { data: pub } = admin.storage.from('product-images').getPublicUrl(path);
    return { url: pub.publicUrl, path };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const userId = await verifyUser(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json().catch(() => ({})) as { ids?: string[]; overwrite?: boolean; limite?: number };
    const overwrite = body.overwrite ?? false;
    // Con galería (hasta 3 fotos por producto) bajamos el lote para no exceder
    // el tiempo de la función; el usuario puede volver a ejecutarlo.
    const limite = Math.min(Math.max(body.limite ?? 8, 1), 12);

    // Cliente del usuario (para no tocar inventario ajeno).
    const { data: cli } = await admin.from('clientes').select('id').eq('user_id', userId).maybeSingle();
    if (!cli?.id) {
      return new Response(JSON.stringify({ error: 'Cliente no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Productos a enriquecer: los pedidos (si vienen ids) o los que estan
    // incompletos (sin descripcion o sin imagen).
    let q = admin
      .from('cliente_inventario')
      .select('id, sku, nombre_producto, nombre, descripcion, categoria, marca, imagen_url, palabras_clave')
      .eq('cliente_id', cli.id)
      .limit(limite);
    if (body.ids?.length) {
      q = q.in('id', body.ids);
    } else {
      q = q.or('descripcion.is.null,imagen_url.is.null');
    }
    const { data: productos, error: prodErr } = await q;
    if (prodErr) throw prodErr;
    if (!productos?.length) {
      return new Response(JSON.stringify({ procesados: 0, resultados: [], mensaje: 'Nada que enriquecer' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const iaItems = await enriquecerConIA(productos as ProductoRow[]);
    const fuenteTexto = iaItems ? 'ia' : 'sin_ia';

    const resultados: any[] = [];
    let conImagen = 0;

    for (let i = 0; i < productos.length; i++) {
      const p = productos[i] as ProductoRow;
      const ia = iaItems?.[i] || {};
      const update: Record<string, unknown> = {};

      // Descripcion (completar o sobrescribir).
      if (ia.descripcion && (overwrite || !p.descripcion)) {
        update.descripcion = ia.descripcion;
      }
      // Palabras clave (si no tiene).
      if (ia.palabras_clave?.length && (overwrite || !p.palabras_clave?.length)) {
        update.palabras_clave = ia.palabras_clave;
      }
      // Marca (si no tiene y la IA la infirio).
      if (ia.marca && (overwrite || !p.marca)) {
        update.marca = ia.marca;
      }

      // Imagen(es): armamos una galería de hasta 3 fotos. Solo si el producto no
      // tiene imagen (o overwrite). Bajamos de Pexels y subimos a nuestro bucket.
      let nuevaImagen: string | null = null;
      let fotosAgregadas = 0;
      if (overwrite || !p.imagen_url) {
        // Evitamos duplicar: si ya tiene galería y no es overwrite, no agregamos.
        const { count: yaTiene } = await admin
          .from('product_images')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', p.id)
          .eq('product_type', 'cliente_inventario');

        if (overwrite || !yaTiene) {
          const query = ia.query_imagen || p.nombre_producto || p.nombre || p.categoria || '';
          const urls = await buscarFotos(query, 3);
          for (let k = 0; k < urls.length; k++) {
            const subida = await subirImagen(admin, cli.id, p.sku || p.id, urls[k], k);
            if (!subida) continue;
            const esPrincipal = fotosAgregadas === 0;
            await admin.from('product_images').insert({
              product_id: p.id,
              product_type: 'cliente_inventario',
              image_url: subida.url,
              storage_path: subida.path,
              orden: k,
              es_principal: esPrincipal,
            });
            if (esPrincipal) nuevaImagen = subida.url;
            fotosAgregadas++;
          }
          if (nuevaImagen) {
            update.imagen_url = nuevaImagen;
            conImagen++;
          }
        }
      }

      if (Object.keys(update).length > 0) {
        await admin.from('cliente_inventario').update(update).eq('id', p.id).eq('cliente_id', cli.id);
      }

      resultados.push({
        id: p.id,
        nombre: p.nombre_producto || p.nombre,
        descripcion: (update.descripcion as string) ?? p.descripcion ?? null,
        imagen_url: nuevaImagen ?? p.imagen_url ?? null,
        con_imagen_nueva: !!nuevaImagen,
        fotos_agregadas: fotosAgregadas,
        actualizado: Object.keys(update).length > 0,
      });
    }

    return new Response(
      JSON.stringify({
        procesados: resultados.length,
        con_imagen: conImagen,
        fuente_texto: fuenteTexto,
        fuente_imagen: (Deno.env.get('PEXELS_API_KEY') || Deno.env.get('UNSPLASH_ACCESS_KEY')) ? 'pexels' : 'sin_api',
        resultados,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('enriquecer-inventario error:', e);
    return new Response(JSON.stringify({ error: 'Error enriqueciendo el inventario' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
