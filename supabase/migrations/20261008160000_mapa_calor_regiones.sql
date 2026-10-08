-- Mapa de calor de Chile (Reportes): volumen de licitaciones y compra ágil por
-- región, con capas (CA / Licitación) y detalle al hacer zoom en una región
-- (instituciones y comunas — el máximo detalle geográfico que hoy guarda la base).

-- Tabla de referencia: mapea el nombre de región tal como aparece en
-- licitaciones_bi/compras_agiles al "hc-key" del geojson de regiones de Chile
-- que usa el frontend (src/data/chileRegionesGeo.json). Dato geográfico fijo,
-- no se modifica desde la app.
create table if not exists public.chile_regiones_geo (
  region text primary key,
  geo_key text not null unique,
  orden smallint not null
);

alter table public.chile_regiones_geo enable row level security;

drop policy if exists "chile_regiones_geo_select" on public.chile_regiones_geo;
create policy "chile_regiones_geo_select" on public.chile_regiones_geo
  for select to anon, authenticated using (true);

insert into public.chile_regiones_geo (region, geo_key, orden) values
  ('Región de Arica y Parinacota', 'cl-ap', 1),
  ('Región de Tarapacá', 'cl-ta', 2),
  ('Región de Antofagasta', 'cl-an', 3),
  ('Región de Atacama', 'cl-at', 4),
  ('Región de Coquimbo', 'cl-co', 5),
  ('Región de Valparaíso', 'cl-vs', 6),
  ('Región Metropolitana de Santiago', 'cl-rm', 7),
  ('Región del Libertador General Bernardo O´Higgins', 'cl-li', 8),
  ('Región del Maule', 'cl-ml', 9),
  ('Región del Ñuble', 'cl-nb', 10),
  ('Región del Biobío', 'cl-bi', 11),
  ('Región de la Araucanía', 'cl-ar', 12),
  ('Región de Los Ríos', 'cl-lr', 13),
  ('Región de los Lagos', 'cl-ll', 14),
  ('Región Aysén del General Carlos Ibáñez del Campo', 'cl-ai', 15),
  ('Región de Magallanes y de la Antártica', 'cl-ma', 16)
on conflict (region) do nothing;

-- "Valparaiso" sin tilde ni "Región de" aparece suelto en compras_agiles.region;
-- se normaliza a la región canónica antes de agrupar.
create or replace function public.mapa_calor_regiones()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with lic as (
    select trim(unidad_compra_region) as region, presupuesto_estimado as monto
    from public.licitaciones_bi
    where unidad_compra_region is not null
  ),
  ca as (
    select
      case when trim(region) = 'Valparaiso' then 'Región de Valparaíso' else trim(region) end as region,
      monto_estimado as monto
    from public.compras_agiles
    where region is not null
  ),
  lic_agg as (
    select region, count(*)::int as count_lic, coalesce(sum(monto), 0) as monto_lic
    from lic group by region
  ),
  ca_agg as (
    select region, count(*)::int as count_ca, coalesce(sum(monto), 0) as monto_ca
    from ca group by region
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.orden), '[]'::jsonb)
  from (
    select
      g.region, g.geo_key, g.orden,
      coalesce(l.count_lic, 0) as count_lic, coalesce(l.monto_lic, 0) as monto_lic,
      coalesce(c.count_ca, 0) as count_ca, coalesce(c.monto_ca, 0) as monto_ca
    from public.chile_regiones_geo g
    left join lic_agg l on l.region = g.region
    left join ca_agg c on c.region = g.region
  ) x
$function$;

-- Detalle al hacer "zoom" en una región: ranking de instituciones (el dato más
-- granular que tenemos de ambas fuentes) y, cuando hay comuna registrada
-- (hoy solo en licitaciones_bi), el desglose por comuna.
create or replace function public.mapa_calor_region_detalle(p_region text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with lic as (
    select institucion_rut as rut, institucion_nombre as nombre,
           coalesce(trim(unidad_compra_comuna), 'Sin comuna') as comuna,
           presupuesto_estimado as monto
    from public.licitaciones_bi
    where trim(unidad_compra_region) = p_region
  ),
  ca as (
    select organismo_rut as rut, nombre_organismo as nombre, monto_estimado as monto
    from public.compras_agiles
    where (case when trim(region) = 'Valparaiso' then 'Región de Valparaíso' else trim(region) end) = p_region
  ),
  lic_agg as (
    select rut, max(nombre) as nombre, count(*)::int as count_lic, coalesce(sum(monto), 0) as monto_lic
    from lic where rut is not null group by rut
  ),
  ca_agg as (
    select rut, max(nombre) as nombre, count(*)::int as count_ca, coalesce(sum(monto), 0) as monto_ca
    from ca where rut is not null group by rut
  ),
  ruts as (
    select rut from lic_agg union select rut from ca_agg
  ),
  instituciones_rank as (
    select
      r.rut,
      coalesce(l.nombre, c.nombre, i.nombre) as nombre,
      coalesce(l.count_lic, 0) as count_lic, coalesce(l.monto_lic, 0) as monto_lic,
      coalesce(c.count_ca, 0) as count_ca, coalesce(c.monto_ca, 0) as monto_ca,
      coalesce(l.monto_lic, 0) + coalesce(c.monto_ca, 0) as monto_total
    from ruts r
    left join lic_agg l on l.rut = r.rut
    left join ca_agg c on c.rut = r.rut
    left join public.instituciones i on i.rut = r.rut
  ),
  comunas_agg as (
    select comuna, count(*)::int as count, coalesce(sum(monto), 0) as monto
    from lic group by comuna
  )
  select jsonb_build_object(
    'instituciones', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (select * from instituciones_rank order by monto_total desc limit 15) x
    ),
    'comunas', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (select * from comunas_agg order by monto desc limit 15) x
    )
  )
$function$;

grant execute on function public.mapa_calor_regiones() to anon, authenticated;
grant execute on function public.mapa_calor_region_detalle(text) to anon, authenticated;
