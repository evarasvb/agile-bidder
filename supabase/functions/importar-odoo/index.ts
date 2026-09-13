import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Llamada JSON-RPC genérica a Odoo.
async function odooRpc(baseUrl: string, service: string, method: string, args: unknown[]): Promise<any> {
  const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args } }),
  });
  if (!resp.ok) throw new Error(`Odoo HTTP ${resp.status}`);
  const j = await resp.json();
  if (j.error) throw new Error(j.error?.data?.message || 'Error de Odoo');
  return j.result;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
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
    const limite = Math.min(Math.max(body.limite ?? 15, 1), 40);

    const { data: cli } = await admin
      .from('clientes')
      .select('id, odoo_url, odoo_db, odoo_user, odoo_api_key')
      .eq('user_id', userId)
      .maybeSingle();
    if (!cli?.id) {
      return new Response(JSON.stringify({ error: 'Cliente no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!cli.odoo_url || !cli.odoo_db || !cli.odoo_user || !cli.odoo_api_key) {
      return new Response(JSON.stringify({ error: 'Configura la conexión con Odoo (URL, base, usuario y API key).' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Autenticación en Odoo -> uid.
    const uid = await odooRpc(cli.odoo_url, 'common', 'authenticate', [cli.odoo_db, cli.odoo_user, cli.odoo_api_key, {}]);
    if (!uid) {
      return new Response(JSON.stringify({ error: 'No se pudo autenticar en Odoo (revisa usuario/API key).' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Productos a completar (por ids o los que no tengan imagen).
    let q = admin
      .from('cliente_inventario')
      .select('id, sku, imagen_url')
      .eq('cliente_id', cli.id)
      .limit(limite);
    if (body.ids?.length) q = q.in('id', body.ids);
    else q = q.is('imagen_url', null);
    const { data: productos } = await q;
    if (!productos?.length) {
      return new Response(JSON.stringify({ procesados: 0, con_imagen: 0, resultados: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resultados: any[] = [];
    let conImagen = 0;

    for (const p of productos as Array<{ id: string; sku: string | null; imagen_url: string | null }>) {
      if (!p.sku) { resultados.push({ id: p.id, ok: false, motivo: 'sin_sku' }); continue; }
      if (p.imagen_url && !overwrite) { resultados.push({ id: p.id, ok: false, motivo: 'ya_tiene' }); continue; }
      try {
        // Buscamos el producto en Odoo por default_code (SKU) y traemos image_1920.
        const rows = await odooRpc(cli.odoo_url, 'object', 'execute_kw', [
          cli.odoo_db, uid, cli.odoo_api_key,
          'product.product', 'search_read',
          [[['default_code', '=', p.sku]]],
          { fields: ['image_1920', 'default_code', 'name'], limit: 1 },
        ]);
        const img = rows?.[0]?.image_1920;
        if (!img) { resultados.push({ id: p.id, ok: false, motivo: 'sin_imagen_odoo' }); continue; }

        const bytes = base64ToBytes(img);
        const safe = (p.sku || p.id).replace(/[^a-zA-Z0-9_-]/g, '_');
        const path = `odoo/${cli.id}/${safe}-${Date.now()}.png`;
        const { error: upErr } = await admin.storage
          .from('product-images')
          .upload(path, bytes, { contentType: 'image/png', upsert: true });
        if (upErr) { resultados.push({ id: p.id, ok: false, motivo: 'upload' }); continue; }
        const { data: pub } = admin.storage.from('product-images').getPublicUrl(path);

        const esPrincipal = overwrite || !p.imagen_url;
        await admin.from('product_images').insert({
          product_id: p.id,
          product_type: 'cliente_inventario',
          image_url: pub.publicUrl,
          storage_path: path,
          orden: 0,
          es_principal: esPrincipal,
        });
        if (esPrincipal) {
          await admin.from('cliente_inventario').update({ imagen_url: pub.publicUrl }).eq('id', p.id);
        }
        conImagen++;
        resultados.push({ id: p.id, ok: true });
      } catch (e) {
        resultados.push({ id: p.id, ok: false, motivo: 'error' });
      }
    }

    return new Response(
      JSON.stringify({ procesados: resultados.length, con_imagen: conImagen, resultados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('importar-odoo error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message || 'Error importando de Odoo' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
