-- Medios (diarios, radios, TV, portales, prensa oficial y gremial) cruzados con los organismos
-- que licitan. Cada mención se guarda por organismo y, si viene de una consulta puntual, por
-- licitación. Las mismas notas entran además a experto.fragmentos (vía noticias_insertar) para
-- que el Experto las cite.
create table if not exists public.medios_menciones (
  id bigint generated always as identity primary key,
  organismo text not null,
  organismo_norm text not null,
  licitacion_codigo text,
  titulo text not null,
  url text not null,
  medio text,
  tipo_medio text not null default 'otro'
    check (tipo_medio in ('diario','radio','tv','portal','oficial','gremio','redes','otro')),
  fecha timestamptz,
  resumen text,
  consulta text,
  creado_en timestamptz not null default now(),
  unique (organismo_norm, url)
);
create index if not exists idx_medios_menciones_org_fecha on public.medios_menciones (organismo_norm, fecha desc nulls last);
alter table public.medios_menciones enable row level security;
drop policy if exists "medios_menciones_lectura" on public.medios_menciones;
create policy "medios_menciones_lectura" on public.medios_menciones for select to authenticated using (true);

create table if not exists public.medios_organismos_estado (
  organismo_norm text primary key,
  organismo text not null,
  revisado_en timestamptz not null default now(),
  menciones integer not null default 0,
  error text
);
alter table public.medios_organismos_estado enable row level security;

-- Nombre normalizado para agrupar (sin tildes, sin prefijos tipo "I MUNICIPALIDAD", minúsculas).
create or replace function public.medios_norm(p text) returns text
language sql immutable as $$
  select regexp_replace(
           regexp_replace(lower(unaccent(coalesce(p, ''))), '^\s*(i\.?|il\.?|ilustre|ilustre municipalidad de|i municipalidad de)\s+', ''),
           '[^a-z0-9]+', ' ', 'g')
$$;

-- Organismo de un código (licitación o compra ágil).
create or replace function public.medios_organismo_de(p_codigo text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select institucion_nombre from public.licitaciones_bi where codigo = upper(p_codigo) limit 1),
    (select nombre_organismo from public.compras_agiles where codigo = upper(p_codigo) limit 1)
  );
$$;
revoke all on function public.medios_organismo_de(text) from public, anon;
grant execute on function public.medios_organismo_de(text) to authenticated, service_role;

-- Menciones de un organismo (por código de proceso o por nombre), más recientes primero.
create or replace function public.medios_organismo(p_codigo text default null, p_organismo text default null, p_cantidad integer default 12)
returns table (id bigint, organismo text, titulo text, url text, medio text, tipo_medio text, fecha timestamptz, resumen text, revisado_en timestamptz)
language sql stable security definer set search_path = public as $$
  with o as (
    select public.medios_norm(coalesce(public.medios_organismo_de(p_codigo), p_organismo)) as n
  )
  select m.id, m.organismo, m.titulo, m.url, m.medio, m.tipo_medio, m.fecha, m.resumen, e.revisado_en
  from public.medios_menciones m
  join o on o.n = m.organismo_norm
  left join public.medios_organismos_estado e on e.organismo_norm = m.organismo_norm
  where o.n <> ''
  order by m.fecha desc nulls last, m.id desc
  limit greatest(1, least(coalesce(p_cantidad, 12), 50));
$$;
revoke all on function public.medios_organismo(text, text, integer) from public, anon;
grant execute on function public.medios_organismo(text, text, integer) to authenticated, service_role;

-- Cola del robot: organismos con licitaciones abiertas, sin revisar hace 7 días; primero los que
-- tienen licitaciones con match, luego los que más licitan.
create or replace function public.medios_organismos_pendientes(p_limite integer default 8)
returns table (organismo text)
language sql stable security definer set search_path = public as $$
  select l.institucion_nombre
  from public.licitaciones_bi l
  left join public.medios_organismos_estado e on e.organismo_norm = public.medios_norm(l.institucion_nombre)
  where l.codigo_estado = 5 and l.fecha_cierre > now() and l.institucion_nombre is not null
    and (e.organismo_norm is null or e.revisado_en < now() - interval '7 days')
  group by l.institucion_nombre, e.revisado_en
  order by bool_or(l.match_encontrado) desc, count(*) desc, e.revisado_en asc nulls first
  limit greatest(1, least(coalesce(p_limite, 8), 20));
$$;
revoke all on function public.medios_organismos_pendientes(integer) from public, anon, authenticated;
grant execute on function public.medios_organismos_pendientes(integer) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'medios-organismos-cron';
select cron.schedule('medios-organismos-cron', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/medios-organismo',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{"auto":true,"limit":8}'::jsonb, timeout_milliseconds := 120000);
$$);
