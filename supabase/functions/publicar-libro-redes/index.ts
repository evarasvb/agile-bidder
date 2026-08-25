// Bot de publicación del libro "Véndele al Estado y no mueras en el intento".
// Publica el siguiente post pendiente del calendario (tabla
// viral_agent_calendario) en Facebook/Instagram vía Meta Graph API.
// Credenciales y calendario viven en Postgres (tablas viral_agent_*, RLS
// bloqueado — solo este función, con el service role, puede leerlas).
//
// Disparo: pg_cron -> net.http_post con header x-viral-agent-secret que debe
// calzar con config.cron_shared_secret (verify_jwt=false, así que esta
// cabecera es la única protección contra llamadas de terceros).
//
// Body opcional: { "dry_run": true, "red": "Instagram" | "Facebook" }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-viral-agent-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
}

const GRAPH = 'https://graph.facebook.com/v21.0';

async function getConfig(db: ReturnType<typeof createClient>) {
  const { data, error } = await db.from('viral_agent_config').select('key, value');
  if (error) throw new Error(`config: ${error.message}`);
  const cfg: Record<string, string> = {};
  for (const row of data ?? []) cfg[row.key] = row.value;
  return cfg;
}

async function publicarFacebook(pageId: string, token: string, texto: string) {
  const resp = await fetch(`${GRAPH}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message: texto, access_token: token }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Facebook: ${JSON.stringify(data)}`);
  return data;
}

async function publicarInstagram(igId: string, token: string, texto: string, imagenUrl: string) {
  if (!imagenUrl) throw new Error('Falta imagen_url para el post de Instagram');
  const contenedor = await fetch(`${GRAPH}/${igId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ image_url: imagenUrl, caption: texto, access_token: token }),
  });
  const contenedorData = await contenedor.json();
  if (!contenedor.ok) throw new Error(`Instagram (media): ${JSON.stringify(contenedorData)}`);

  const publicacion = await fetch(`${GRAPH}/${igId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: contenedorData.id, access_token: token }),
  });
  const publicacionData = await publicacion.json();
  if (!publicacion.ok) throw new Error(`Instagram (publish): ${JSON.stringify(publicacionData)}`);
  return publicacionData;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(url, service);

    const cfg = await getConfig(db);

    const secretEsperado = cfg.cron_shared_secret;
    const secretRecibido = req.headers.get('x-viral-agent-secret');
    if (!secretEsperado || secretRecibido !== secretEsperado) {
      return json({ error: 'unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const redFiltro: string | undefined = body.red;

    let query = db
      .from('viral_agent_calendario')
      .select('*')
      .eq('estado', 'pendiente')
      .order('dia', { ascending: true })
      .limit(1);
    if (redFiltro) query = query.eq('red', redFiltro);

    const { data: filas, error: errFilas } = await query;
    if (errFilas) throw new Error(`calendario: ${errFilas.message}`);
    if (!filas || filas.length === 0) {
      return json({ message: 'No hay posts pendientes.' });
    }
    const fila = filas[0];
    const texto = `${fila.caption}\n\n${fila.cta}\n\n${fila.hashtags}`;

    if (dryRun) {
      return json({ dry_run: true, dia: fila.dia, red: fila.red, imagen_url: fila.imagen_url, texto });
    }

    let resultado;
    if (fila.red === 'Facebook') {
      resultado = await publicarFacebook(cfg.meta_page_id, cfg.meta_page_access_token, texto);
    } else {
      resultado = await publicarInstagram(cfg.meta_ig_business_id, cfg.meta_page_access_token, texto, fila.imagen_url);
    }

    await db
      .from('viral_agent_calendario')
      .update({ estado: 'publicado', publicado_at: new Date().toISOString() })
      .eq('dia', fila.dia);

    return json({ dia: fila.dia, red: fila.red, resultado });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
