-- Framework para jurisprudencia de compras públicas: demandas (Tribunal de Contratación Pública)
-- y causas/dictámenes (Contraloría General de la República, Poder Judicial).
-- Se almacenan en experto.fragmentos con fuente 'Demanda: ...' o 'Causa: ...' para reutilizar
-- el sistema de búsqueda full-text, citación y contexto del Experto (igual que noticias y leyes).

-- RPC de inserción. Cada fila: {tipo, numero, titulo, url, texto, fecha}.
--   tipo = 'demanda'  -> fuente 'Demanda: <numero>'  (Tribunal de Contratación Pública)
--   tipo = 'causa'    -> fuente 'Causa: <numero>'    (Contraloría / tribunales)
create or replace function public.jurisprudencia_insertar(p_filas jsonb)
returns integer language plpgsql security definer set search_path = public, experto as $$
declare n integer;
begin
  insert into experto.fragmentos (fuente, seccion, orden, url, texto, creado_en)
  select
    case when x.tipo = 'demanda' then 'Demanda: ' else 'Causa: ' end || coalesce(x.numero, 'ref') as fuente,
    x.titulo::text as seccion,
    0,
    x.url,
    x.texto::text,
    now()
  from jsonb_to_recordset(p_filas) as x(tipo text, numero text, titulo text, url text, texto text, fecha timestamptz)
  where x.url is not null and x.texto is not null and x.tipo in ('demanda', 'causa')
  on conflict (url) where (fuente like 'Demanda:%' or fuente like 'Causa:%') do nothing;

  -- La jurisprudencia no expira: no se borra por antigüedad (a diferencia de las noticias).
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.jurisprudencia_insertar(jsonb) from public, anon, authenticated;
grant execute on function public.jurisprudencia_insertar(jsonb) to service_role;

-- Búsqueda unificada de jurisprudencia (demandas + causas) por relevancia full-text.
-- Devuelve 'tipo' derivado del prefijo de la fuente para agrupar en la interfaz.
create or replace function public.experto_jurisprudencia(consulta text, cantidad integer default 4)
returns table (id bigint, tipo text, fuente text, seccion text, url text, texto text, fecha timestamptz, relevancia real)
language sql stable security definer set search_path = public, experto as $$
  with q as (select websearch_to_tsquery('spanish', consulta) as tq)
  select f.id,
         case when f.fuente like 'Demanda:%' then 'demanda' else 'causa' end as tipo,
         f.fuente, f.seccion, f.url, f.texto, f.creado_en,
         ts_rank_cd(f.tsv, q.tq) as relevancia
  from experto.fragmentos f, q
  where (f.fuente like 'Demanda:%' or f.fuente like 'Causa:%') and f.tsv @@ q.tq
  order by relevancia desc, f.creado_en desc
  limit least(cantidad, 8);
$$;
-- Se llama desde el navegador (LibroLicitacion) con sesión de usuario: necesita 'authenticated'.
grant execute on function public.experto_jurisprudencia(text, integer) to authenticated, service_role;

-- Índice de deduplicación por URL para demandas y causas.
create unique index if not exists fragmentos_jurisprudencia_url_idx
  on experto.fragmentos (url) where (fuente like 'Demanda:%' or fuente like 'Causa:%');

-- Cron: sincronizar jurisprudencia cada día a las 02:30 UTC.
select cron.unschedule(jobid) from cron.job where jobname = 'sync-jurisprudencia-cron';
select cron.schedule('sync-jurisprudencia-cron', '30 2 * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/sync-jurisprudencia',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);
