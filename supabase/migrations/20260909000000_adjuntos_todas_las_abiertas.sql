-- Bases y anexos para TODAS las licitaciones abiertas, no solo las que calzan con palabras clave.
-- Cola: publicadas (estado 5) que cierran en más de 12 horas, sin revisar (o con pendientes/error
-- hace más de 2 horas); primero las que calzan, luego las publicadas más recientes.
create or replace function public.licitaciones_adjuntos_pendientes(p_limite integer default 2)
returns table (codigo text)
language sql stable security definer set search_path = public as $$
  select l.codigo
  from public.licitaciones_bi l
  left join public.licitaciones_adjuntos_estado e on e.codigo = l.codigo
  where l.codigo_estado = 5
    and l.fecha_cierre > now() + interval '12 hours'
    and (e.codigo is null or ((e.pendientes > 0 or e.error is not null) and e.revisado_en < now() - interval '2 hours'))
  order by l.match_encontrado desc, l.fecha_publicacion desc nulls last
  limit greatest(1, least(coalesce(p_limite, 2), 10));
$$;

create index if not exists idx_licitaciones_bi_cola_adjuntos
  on public.licitaciones_bi (match_encontrado desc, fecha_publicacion desc)
  where codigo_estado = 5;

-- Descarga: cada 2 minutos; pide de a 6 candidatas y sigue hasta 40 por corrida o agotar los 110 s
-- (una licitación sin "Ver Anexo" se resuelve en menos de 1 s).
select cron.unschedule(jobid) from cron.job where jobname = 'licitacion-adjuntos-auto';
select cron.schedule('licitacion-adjuntos-auto', '*/2 * * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/licitacion-adjuntos',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{"auto":true,"limit":6,"max":40}'::jsonb, timeout_milliseconds := 120000);
$$);

-- Lectura de bases (texto + resumen): cada 5 minutos, hasta 6 PDF por corrida (unos 20 s cada uno).
select cron.unschedule(jobid) from cron.job where jobname = 'licitacion-bases-pendientes';
select cron.schedule('licitacion-bases-pendientes', '1,6,11,16,21,26,31,36,41,46,51,56 * * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/licitacion-adjuntos',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{"bases":true,"limit":6}'::jsonb, timeout_milliseconds := 120000);
$$);

-- Los PDF de bases que quedaron sin leer por el 401/504 del lector vuelven a la cola.
update public.licitaciones_adjuntos
   set bases_pendiente = true, bases_intento_en = null
 where content_type = 'application/pdf' and not es_bases and not bases_pendiente
   and bytes <= 6 * 1024 * 1024
   and (nombre || ' ' || coalesce(tipo, '') || ' ' || coalesce(descripcion, '')) ~* 'bases|resol|administrativ|t[ée]cnic|licitaci|aprueba';
