import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Candidata {
  url: string;       // imagen a guardar (grande)
  thumb: string;     // preview
  fuente: 'pexels' | 'unsplash';
  autor?: string;
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

async function pexels(query: string, n: number): Promise<Candidata[]> {
  const key = Deno.env.get('PEXELS_API_KEY');
  if (!key || !query) return [];
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${n}&orientation=square`;
    const r = await fetch(url, { headers: { Authorization: key } });
    if (!r.ok) return [];
    const j = await r.json();
    return ((j?.photos || []) as any[]).map((p) => ({
      url: p?.src?.large || p?.src?.medium || p?.src?.original,
      thumb: p?.src?.medium || p?.src?.small || p?.src?.tiny,
      fuente: 'pexels' as const,
      autor: p?.photographer,
    })).filter((c) => c.url);
  } catch {
    return [];
  }
}

async function unsplash(query: string, n: number): Promise<Candidata[]> {
  const key = Deno.env.get('UNSPLASH_ACCESS_KEY');
  if (!key || !query) return [];
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${n}`;
    const r = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
    if (!r.ok) return [];
    const j = await r.json();
    return ((j?.results || []) as any[]).map((p) => ({
      url: p?.urls?.regular || p?.urls?.full,
      thumb: p?.urls?.small || p?.urls?.thumb,
      fuente: 'unsplash' as const,
      autor: p?.user?.name,
    })).filter((c) => c.url);
  } catch {
    return [];
  }
}

// Pexels primero; si no alcanza (o no hay key), completamos con Unsplash.
async function buscarCandidatas(query: string, n: number): Promise<Candidata[]> {
  const p = await pexels(query, n);
  if (p.length >= n) return p.slice(0, n);
  const u = await unsplash(query, n - p.length);
  return [...p, ...u].slice(0, n);
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
    const body = await req.json().catch(() => ({})) as {
      action?: 'sugerir' | 'fijar';
      query?: string;
      productId?: string;
      imageUrl?: string;
      n?: number;
    };

    const { data: cli } = await admin.from('clientes').select('id').eq('user_id', userId).maybeSingle();
    if (!cli?.id) {
      return new Response(JSON.stringify({ error: 'Cliente no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- SUGERIR: devuelve candidatas para que el usuario elija ----
    if (body.action === 'sugerir') {
      let query = (body.query || '').trim();
      if (!query && body.productId) {
        const { data: prod } = await admin
          .from('cliente_inventario')
          .select('nombre_producto, nombre, categoria')
          .eq('id', body.productId)
          .eq('cliente_id', cli.id)
          .maybeSingle();
        query = prod?.nombre_producto || prod?.nombre || prod?.categoria || '';
      }
      const candidatas = await buscarCandidatas(query, Math.min(Math.max(body.n ?? 6, 1), 12));
      return new Response(
        JSON.stringify({ query, candidatas, fuentes: {
          pexels: !!Deno.env.get('PEXELS_API_KEY'),
          unsplash: !!Deno.env.get('UNSPLASH_ACCESS_KEY'),
        } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- FIJAR: baja la imagen elegida, la sube y la agrega a la galeria ----
    if (body.action === 'fijar') {
      if (!body.productId || !body.imageUrl) {
        return new Response(JSON.stringify({ error: 'Faltan productId o imageUrl' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Verificamos que el producto sea del cliente.
      const { data: prod } = await admin
        .from('cliente_inventario')
        .select('id, sku, imagen_url')
        .eq('id', body.productId)
        .eq('cliente_id', cli.id)
        .maybeSingle();
      if (!prod?.id) {
        return new Response(JSON.stringify({ error: 'Producto no encontrado' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const imgResp = await fetch(body.imageUrl);
      if (!imgResp.ok) throw new Error('No se pudo descargar la imagen');
      const bytes = new Uint8Array(await imgResp.arrayBuffer());
      const safe = (prod.sku || prod.id).replace(/[^a-zA-Z0-9_-]/g, '_');
      const path = `elegidas/${cli.id}/${safe}-${Date.now()}.jpg`;
      const { error: upErr } = await admin.storage
        .from('product-images')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = admin.storage.from('product-images').getPublicUrl(path);

      // Orden y principal: principal si aun no tiene imagen.
      const { count } = await admin
        .from('product_images')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', prod.id)
        .eq('product_type', 'cliente_inventario');
      const esPrincipal = !prod.imagen_url;
      await admin.from('product_images').insert({
        product_id: prod.id,
        product_type: 'cliente_inventario',
        image_url: pub.publicUrl,
        storage_path: path,
        orden: count || 0,
        es_principal: esPrincipal,
      });
      if (esPrincipal) {
        await admin.from('cliente_inventario').update({ imagen_url: pub.publicUrl }).eq('id', prod.id);
      }

      return new Response(
        JSON.stringify({ imagen_url: pub.publicUrl, es_principal: esPrincipal }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'action invalida' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('fotos-producto error:', e);
    return new Response(JSON.stringify({ error: 'Error en fotos-producto' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
