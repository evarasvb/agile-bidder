-- Noticias del mundo de las compras publicas como fuente externa del Experto (se citan como [n]).
create unique index if not exists fragmentos_noticia_url_idx on experto.fragmentos (url) where fuente like 'Noticia:%';

create or replace function public.noticias_insertar(p_filas jsonb)
returns integer language plpgsql security definer set search_path = public, experto as $$
declare n integer;
begin
  insert into experto.fragmentos (fuente, seccion, orden, url, texto, creado_en)
  select x.fuente, x.seccion, 0, x.url, x.texto, coalesce(x.fecha, now())
  from jsonb_to_recordset(p_filas) as x(fuente text, seccion text, url text, texto text, fecha timestamptz)
  where x.url is not null and x.texto is not null
  on conflict (url) where fuente like 'Noticia:%' do nothing;
  get diagnostics n = row_count;
  delete from experto.fragmentos where fuente like 'Noticia:%' and creado_en < now() - interval '180 days';
  return n;
end $$;
revoke all on function public.noticias_insertar(jsonb) from public, anon, authenticated;
grant execute on function public.noticias_insertar(jsonb) to service_role;

create or replace function public.experto_noticias(consulta text, cantidad integer default 3)
returns table (id bigint, fuente text, seccion text, url text, texto text, fecha timestamptz, relevancia real)
language sql stable security definer set search_path = public, experto as $$
  with q as (select websearch_to_tsquery('spanish', consulta) as tq)
  select f.id, f.fuente, f.seccion, f.url, f.texto, f.creado_en, ts_rank_cd(f.tsv, q.tq) as relevancia
  from experto.fragmentos f, q
  where f.fuente like 'Noticia:%' and f.tsv @@ q.tq and f.creado_en > now() - interval '120 days'
  order by relevancia desc, f.creado_en desc
  limit least(cantidad, 6);
$$;
revoke all on function public.experto_noticias(text, integer) from public, anon, authenticated;
grant execute on function public.experto_noticias(text, integer) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'sync-noticias-cron';
select cron.schedule('sync-noticias-cron', '20 */6 * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/sync-noticias',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);
