-- Etapa B: oferentes y adjudicaciones desde la API OCDS pública de Mercado Público
-- (api.mercadopublico.cl/APISOCDS/OCDS/{tender,award}/{codigo}). Sin sesión ni ticket.
-- (Aplicado en producción como ocds_procesos_adjudicaciones_v2 + ocds_mes_pendiente_reintento_diario.)
create table if not exists public.ocds_procesos (
  codigo text primary key, ocid text, comprador_nombre text, comprador_id text, comprador_rut text,
  titulo text, metodo text, estado_tender text, monto_estimado numeric, moneda text,
  fecha_publicacion timestamptz, fecha_cierre timestamptz, num_oferentes integer,
  oferentes jsonb, adjudicatarios jsonb, monto_adjudicado numeric, fecha_adjudicacion timestamptz,
  estado_award text, items jsonb, tender_leido_en timestamptz, award_leido_en timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ocds_procesos_comprador_idx on public.ocds_procesos (comprador_rut, fecha_publicacion desc);
create index if not exists ocds_procesos_fecha_idx on public.ocds_procesos (fecha_publicacion desc);
create index if not exists ocds_procesos_adj_gin on public.ocds_procesos using gin (adjudicatarios jsonb_path_ops);
create index if not exists ocds_procesos_titulo_trgm on public.ocds_procesos using gin (lower(coalesce(titulo,'')) gin_trgm_ops);
alter table public.ocds_procesos enable row level security;
drop policy if exists "lectura autenticados" on public.ocds_procesos;
create policy "lectura autenticados" on public.ocds_procesos for select to authenticated using (true);

create table if not exists public.ocds_meses (
  anio integer not null, mes integer not null, total integer, offset_leido integer not null default 0,
  completo boolean not null default false, updated_at timestamptz not null default now(), primary key (anio, mes));
alter table public.ocds_meses enable row level security;

create or replace function public.rut_formatear(p text) returns text language sql immutable as $$
  select case when p is null or length(regexp_replace(p, '[^0-9kK]', '', 'g')) < 2 then null else
    (with r as (select upper(regexp_replace(p, '[^0-9kK]', '', 'g')) s)
     select reverse(regexp_replace(reverse(left(s, length(s)-1)), '(\d{3})(?=\d)', '\1.', 'g')) || '-' || right(s, 1) from r) end; $$;

create or replace function public.ocds_upsert(p_filas jsonb) returns integer language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare n integer;
begin
  insert into public.ocds_procesos (codigo, ocid, comprador_nombre, comprador_id, comprador_rut, titulo, metodo, estado_tender,
    monto_estimado, moneda, fecha_publicacion, fecha_cierre, num_oferentes, oferentes, adjudicatarios, monto_adjudicado,
    fecha_adjudicacion, estado_award, items, tender_leido_en, award_leido_en)
  select x.codigo, x.ocid, x.comprador_nombre, x.comprador_id,
         coalesce(public.rut_formatear(x.comprador_rut), (select b.institucion_rut from public.licitaciones_bi b where b.codigo = x.codigo limit 1)),
         x.titulo, x.metodo, x.estado_tender, x.monto_estimado, x.moneda, x.fecha_publicacion, x.fecha_cierre,
         x.num_oferentes, x.oferentes, x.adjudicatarios, x.monto_adjudicado, x.fecha_adjudicacion, x.estado_award, x.items,
         case when x.tender_leido then now() end, case when x.award_leido then now() end
  from jsonb_to_recordset(p_filas) as x(codigo text, ocid text, comprador_nombre text, comprador_id text, comprador_rut text,
    titulo text, metodo text, estado_tender text, monto_estimado numeric, moneda text, fecha_publicacion timestamptz,
    fecha_cierre timestamptz, num_oferentes integer, oferentes jsonb, adjudicatarios jsonb, monto_adjudicado numeric,
    fecha_adjudicacion timestamptz, estado_award text, items jsonb, tender_leido boolean, award_leido boolean)
  where x.codigo is not null
  on conflict (codigo) do update set
    ocid = coalesce(excluded.ocid, ocds_procesos.ocid), comprador_nombre = coalesce(excluded.comprador_nombre, ocds_procesos.comprador_nombre),
    comprador_id = coalesce(excluded.comprador_id, ocds_procesos.comprador_id), comprador_rut = coalesce(excluded.comprador_rut, ocds_procesos.comprador_rut),
    titulo = coalesce(excluded.titulo, ocds_procesos.titulo), metodo = coalesce(excluded.metodo, ocds_procesos.metodo),
    estado_tender = coalesce(excluded.estado_tender, ocds_procesos.estado_tender), monto_estimado = coalesce(excluded.monto_estimado, ocds_procesos.monto_estimado),
    moneda = coalesce(excluded.moneda, ocds_procesos.moneda), fecha_publicacion = coalesce(excluded.fecha_publicacion, ocds_procesos.fecha_publicacion),
    fecha_cierre = coalesce(excluded.fecha_cierre, ocds_procesos.fecha_cierre), num_oferentes = coalesce(excluded.num_oferentes, ocds_procesos.num_oferentes),
    oferentes = coalesce(excluded.oferentes, ocds_procesos.oferentes), adjudicatarios = coalesce(excluded.adjudicatarios, ocds_procesos.adjudicatarios),
    monto_adjudicado = coalesce(excluded.monto_adjudicado, ocds_procesos.monto_adjudicado), fecha_adjudicacion = coalesce(excluded.fecha_adjudicacion, ocds_procesos.fecha_adjudicacion),
    estado_award = coalesce(excluded.estado_award, ocds_procesos.estado_award), items = coalesce(excluded.items, ocds_procesos.items),
    tender_leido_en = coalesce(excluded.tender_leido_en, ocds_procesos.tender_leido_en), award_leido_en = coalesce(excluded.award_leido_en, ocds_procesos.award_leido_en),
    updated_at = now();
  get diagnostics n = row_count; return n;
end $$;
revoke execute on function public.ocds_upsert(jsonb) from public, anon, authenticated;
grant execute on function public.ocds_upsert(jsonb) to service_role;

create or replace function public.ocds_mes_pendiente() returns table (anio integer, mes integer, offset_leido integer, total integer)
language sql stable security definer set search_path to 'public' as $$
  with meses as (select extract(year from d)::int a, extract(month from d)::int m
    from generate_series(date_trunc('month', current_date - interval '1 month'), date_trunc('month', current_date - interval '13 months'), interval '-1 month') d)
  select meses.a, meses.m, coalesce(o.offset_leido, 0), o.total
  from meses left join public.ocds_meses o on o.anio = meses.a and o.mes = meses.m
  where o.completo is not true and not (coalesce(o.total, -1) = 0 and o.updated_at > now() - interval '1 day')
  order by meses.a desc, meses.m desc limit 1; $$;
revoke execute on function public.ocds_mes_pendiente() from public, anon, authenticated;
grant execute on function public.ocds_mes_pendiente() to service_role;

create or replace function public.ocds_marcar_mes(p_anio integer, p_mes integer, p_offset integer, p_total integer, p_completo boolean)
returns void language sql security definer set search_path to 'public' as $$
  insert into public.ocds_meses (anio, mes, total, offset_leido, completo, updated_at) values (p_anio, p_mes, p_total, p_offset, p_completo, now())
  on conflict (anio, mes) do update set total = excluded.total, offset_leido = excluded.offset_leido, completo = excluded.completo, updated_at = now(); $$;
revoke execute on function public.ocds_marcar_mes(integer, integer, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.ocds_marcar_mes(integer, integer, integer, integer, boolean) to service_role;

create or replace function public.ocds_codigos_pendientes(p_max integer default 100) returns table (codigo text)
language sql stable security definer set search_path to 'public' as $$
  select b.codigo from public.licitaciones_bi b left join public.ocds_procesos o on o.codigo = b.codigo
  where b.fecha_cierre < now() - interval '30 days' and b.fecha_publicacion >= now() - interval '150 days'
    and (o.codigo is null or (o.adjudicatarios is null and coalesce(o.award_leido_en, 'epoch') < now() - interval '7 days'))
  order by b.fecha_cierre desc limit least(p_max, 300); $$;
revoke execute on function public.ocds_codigos_pendientes(integer) from public, anon, authenticated;
grant execute on function public.ocds_codigos_pendientes(integer) to service_role;
