-- Framework para gestionar leyes y normativa de compras públicas chilenas.
-- Las leyes se almacenan en experto.fragmentos con fuente = "Ley: <nombre>" para reutilizar
-- el sistema de búsqueda full-text, citación y contexto del Experto.

-- RPC para insertar leyes (patrón idéntico a noticias_insertar).
-- Recibe array de {numero, año, nombre, titulo, url, texto, fecha}.
-- Guarda en experto.fragmentos con fuente="Ley: <numero>/<año>" para deduplicación.

create or replace function public.leyes_insertar(p_filas jsonb)
returns integer language plpgsql security definer set search_path = public, experto as $$
declare n integer;
begin
  insert into experto.fragmentos (fuente, seccion, orden, url, texto, creado_en)
  select
    'Ley: ' || coalesce(x.numero, 'N/A') || '/' || coalesce(x.año::text, 'N/A') as fuente,
    x.nombre::text as seccion,
    0,
    x.url,
    (x.titulo || '. ' || x.texto)::text,
    now()
  from jsonb_to_recordset(p_filas) as x(numero text, año integer, nombre text, titulo text, url text, texto text, fecha timestamptz)
  where x.url is not null and x.texto is not null
  on conflict (url) where fuente like 'Ley:%' do nothing;

  -- Las leyes NO expiran: no se borran por antigüedad (a diferencia de las noticias).
  -- La fecha de promulgación va dentro del texto, no en creado_en.
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.leyes_insertar(jsonb) from public, anon, authenticated;
grant execute on function public.leyes_insertar(jsonb) to service_role;

-- RPC para buscar leyes relevantes (patrón idéntico a experto_noticias).
create or replace function public.experto_leyes(consulta text, cantidad integer default 3)
returns table (id bigint, fuente text, seccion text, url text, texto text, fecha timestamptz, relevancia real)
language sql stable security definer set search_path = public, experto as $$
  with q as (select websearch_to_tsquery('spanish', consulta) as tq)
  select f.id, f.fuente, f.seccion, f.url, f.texto, f.creado_en, ts_rank_cd(f.tsv, q.tq) as relevancia
  from experto.fragmentos f, q
  where f.fuente like 'Ley:%' and f.tsv @@ q.tq
  order by relevancia desc, f.creado_en desc
  limit least(cantidad, 6);
$$;
-- Se llama desde el navegador (LibroLicitacion) con sesión de usuario: necesita 'authenticated'.
grant execute on function public.experto_leyes(text, integer) to authenticated, service_role;

-- Índice para deduplicación de leyes por URL
create unique index if not exists fragmentos_ley_url_idx on experto.fragmentos (url) where fuente like 'Ley:%';

-- Cron job: sincronizar leyes cada día a las 02:00 UTC (00:00 hora Chile en horario de verano).
-- Mantiene leyes actualizadas y disponibles para búsqueda en Experto.
select cron.unschedule(jobid) from cron.job where jobname = 'sync-leyes-cron';
select cron.schedule('sync-leyes-cron', '0 2 * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/sync-leyes',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);
