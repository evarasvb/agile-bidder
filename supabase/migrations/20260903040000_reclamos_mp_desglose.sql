-- Reclamos de Mercado Público desglosados por tipo (1 = pago no oportuno, 2 = irregularidad en el
-- proceso de compra), tomados del buscador público BusquedaReclamos.aspx. Permite: separar pago de
-- proceso, medir concentración por reclamante (un solo proveedor reclamando en masa) y calcular
-- ratios contra la actividad del organismo.

create table if not exists public.reclamos_mp (
  id_reclamo text primary key,
  tipo smallint not null check (tipo in (1, 2)),
  proceso_codigo text,
  fecha date not null,
  reclamante text,
  organismo_nombre text,
  organismo_rut text,
  estado text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reclamos_mp_rut_fecha_idx on public.reclamos_mp (organismo_rut, fecha desc);
create index if not exists reclamos_mp_fecha_idx on public.reclamos_mp (fecha desc);
create index if not exists reclamos_mp_reclamante_idx on public.reclamos_mp (reclamante);
alter table public.reclamos_mp enable row level security;
drop policy if exists "lectura autenticados" on public.reclamos_mp;
create policy "lectura autenticados" on public.reclamos_mp for select to authenticated using (true);

-- Control de carga por día y tipo.
create table if not exists public.reclamos_mp_dias (
  fecha date not null,
  tipo smallint not null,
  cargados integer not null default 0,
  total integer,
  completo boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (fecha, tipo)
);
alter table public.reclamos_mp_dias enable row level security;

-- Días pendientes (ayer hacia atrás, hasta 365 días), los más recientes primero.
create or replace function public.reclamos_mp_dias_pendientes(p_max integer default 3)
returns table (fecha date, tipo smallint)
language sql stable security definer set search_path to 'public' as $$
  select d::date, t::smallint
  from generate_series(current_date - 1, current_date - 365, interval '-1 day') d
  cross join (values (1), (2)) t(t)
  where not exists (select 1 from public.reclamos_mp_dias r where r.fecha = d::date and r.tipo = t and r.completo)
  order by d desc, t
  limit least(p_max, 20);
$$;
revoke execute on function public.reclamos_mp_dias_pendientes(integer) from public, anon, authenticated;
grant execute on function public.reclamos_mp_dias_pendientes(integer) to service_role;

-- Carga de filas. Resuelve el RUT del organismo por el código del proceso (licitación o compra ágil)
-- y, si no, por nombre sin acentos contra instituciones.
create or replace function public.reclamos_mp_upsert(p_filas jsonb)
returns integer language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare n integer;
begin
  with f as (
    select x.id_reclamo, x.tipo, nullif(x.proceso_codigo, '') proceso_codigo, x.fecha, x.reclamante, x.organismo_nombre, x.estado
    from jsonb_to_recordset(p_filas) as x(id_reclamo text, tipo smallint, proceso_codigo text, fecha date, reclamante text, organismo_nombre text, estado text)
    where x.id_reclamo is not null
  ), r as (
    select f.*,
      coalesce(
        (select b.institucion_rut from public.licitaciones_bi b where b.codigo = f.proceso_codigo limit 1),
        (select c.organismo_rut from public.compras_agiles c where c.codigo = f.proceso_codigo limit 1),
        (select i.rut from public.instituciones i
           where unaccent(upper(i.nombre)) = unaccent(upper(f.organismo_nombre))
           order by (i.pago_actualizado_el is not null) desc limit 1)
      ) organismo_rut
    from f
  )
  insert into public.reclamos_mp (id_reclamo, tipo, proceso_codigo, fecha, reclamante, organismo_nombre, organismo_rut, estado)
  select id_reclamo, tipo, proceso_codigo, fecha, reclamante, organismo_nombre, organismo_rut, estado from r
  on conflict (id_reclamo) do update
    set estado = excluded.estado,
        organismo_rut = coalesce(excluded.organismo_rut, public.reclamos_mp.organismo_rut),
        updated_at = now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.reclamos_mp_upsert(jsonb) from public, anon, authenticated;
grant execute on function public.reclamos_mp_upsert(jsonb) to service_role;

create or replace function public.reclamos_mp_marcar_dia(p_fecha date, p_tipo smallint, p_cargados integer, p_total integer, p_completo boolean)
returns void language sql security definer set search_path to 'public' as $$
  insert into public.reclamos_mp_dias (fecha, tipo, cargados, total, completo, updated_at)
  values (p_fecha, p_tipo, p_cargados, p_total, p_completo, now())
  on conflict (fecha, tipo) do update
    set cargados = excluded.cargados, total = excluded.total, completo = excluded.completo, updated_at = now();
$$;
revoke execute on function public.reclamos_mp_marcar_dia(date, smallint, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.reclamos_mp_marcar_dia(date, smallint, integer, integer, boolean) to service_role;

-- Resumen por institución para el Experto: pago vs proceso, concentración de reclamantes y ratio
-- contra la actividad del organismo en la misma ventana (licitaciones + compras ágiles).
create or replace function public.institucion_reclamos_resumen(p_rut text, p_dias integer default 365)
returns table (pago integer, proceso integer, reclamantes_pago integer, top_reclamante text, top_reclamante_pct numeric,
               pago_90d integer, procesos_publicados integer, pago_por_100_procesos numeric, desde date)
language sql stable security definer set search_path to 'public' as $$
  with r as (select * from public.reclamos_mp where organismo_rut = p_rut and fecha >= current_date - p_dias),
  top as (select reclamante, count(*) n from r where tipo = 1 group by 1 order by n desc limit 1),
  act as (
    select (select count(*) from public.licitaciones_bi b where b.institucion_rut = p_rut and b.fecha_publicacion >= current_date - p_dias)
         + (select count(*) from public.compras_agiles c where c.organismo_rut = p_rut and c.fecha_publicacion >= current_date - p_dias) as procesos)
  select (select count(*) from r where tipo = 1)::int,
         (select count(*) from r where tipo = 2)::int,
         (select count(distinct reclamante) from r where tipo = 1)::int,
         (select reclamante from top),
         (select round(100.0 * n / nullif((select count(*) from r where tipo = 1), 0), 1) from top),
         (select count(*) from r where tipo = 1 and fecha >= current_date - 90)::int,
         (select procesos from act)::int,
         (select round(100.0 * (select count(*) from r where tipo = 1) / nullif((select procesos from act), 0), 2)),
         (select min(fecha) from public.reclamos_mp_dias where completo);
$$;
grant execute on function public.institucion_reclamos_resumen(text, integer) to service_role;
