-- Bases y anexos de licitaciones bajados desde Mercado Público por la función
-- licitacion-adjuntos (VerAntecedentes.aspx, sin captcha). Los archivos van al
-- bucket bases-licitacion; los PDF de bases pasan además por experto-bases.

create table if not exists public.licitaciones_adjuntos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nombre text not null,
  tipo text,
  descripcion text,
  fecha_adjunto text,
  bytes integer,
  content_type text,
  storage_path text,
  es_bases boolean not null default false,
  bases_id uuid,
  bajado_en timestamptz not null default now(),
  unique (codigo, nombre)
);
create index if not exists licitaciones_adjuntos_codigo_idx on public.licitaciones_adjuntos (codigo, bajado_en desc);
alter table public.licitaciones_adjuntos enable row level security;
drop policy if exists "licitaciones_adjuntos_lectura" on public.licitaciones_adjuntos;
create policy "licitaciones_adjuntos_lectura" on public.licitaciones_adjuntos
  for select to anon, authenticated using (true);

-- Estado por licitación: cuándo se revisó, cuántos archivos hay y si quedó algo pendiente.
create table if not exists public.licitaciones_adjuntos_estado (
  codigo text primary key,
  revisado_en timestamptz not null default now(),
  archivos integer not null default 0,
  pendientes integer not null default 0,
  error text
);
alter table public.licitaciones_adjuntos_estado enable row level security;

-- El bucket acepta también Word, Excel y comprimidos (anexos que no vienen en PDF).
update storage.buckets
set allowed_mime_types = array[
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip', 'application/vnd.rar', 'application/octet-stream'],
  file_size_limit = 31457280
where id = 'bases-licitacion';

-- Candidatas del robot automático: licitaciones con match, publicadas y abiertas, sin revisar
-- (o con archivos pendientes / error hace más de 2 horas).
create or replace function public.licitaciones_adjuntos_pendientes(p_limite integer default 2)
returns table (codigo text)
language sql stable security definer set search_path = public as $$
  select l.codigo
  from public.licitaciones_bi l
  left join public.licitaciones_adjuntos_estado e on e.codigo = l.codigo
  where l.match_encontrado
    and l.codigo_estado = 5
    and l.fecha_publicacion > now() - interval '30 days'
    and (l.fecha_cierre is null or l.fecha_cierre > now())
    and (e.codigo is null or ((e.pendientes > 0 or e.error is not null) and e.revisado_en < now() - interval '2 hours'))
  order by l.fecha_cierre asc nulls last
  limit greatest(1, least(coalesce(p_limite, 2), 10));
$$;
revoke all on function public.licitaciones_adjuntos_pendientes(integer) from public, anon, authenticated;
grant execute on function public.licitaciones_adjuntos_pendientes(integer) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'licitacion-adjuntos-auto';
select cron.schedule('licitacion-adjuntos-auto', '25,55 * * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/licitacion-adjuntos',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{"auto":true,"limit":2}'::jsonb, timeout_milliseconds := 120000);
$$);

-- Leer las bases (texto + Gemini) tarda más que bajarlas: el PDF queda marcado bases_pendiente
-- y lo lee el tiempo que sobre de la descarga o esta pasada cada 10 minutos.
alter table public.licitaciones_adjuntos add column if not exists bases_pendiente boolean not null default false;
create index if not exists licitaciones_adjuntos_bases_pendiente_idx on public.licitaciones_adjuntos (bajado_en) where bases_pendiente;

select cron.unschedule(jobid) from cron.job where jobname = 'licitacion-bases-pendientes';
select cron.schedule('licitacion-bases-pendientes', '3,13,23,33,43,53 * * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/licitacion-adjuntos',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{"bases":true,"limit":2}'::jsonb, timeout_milliseconds := 120000);
$$);

-- Guarda contra corridas solapadas del cron de lectura: cuándo se tomó el archivo por última vez.
alter table public.licitaciones_adjuntos add column if not exists bases_intento_en timestamptz;
