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

-- licitaciones_bi.unidad_compra_region y compras_agiles.region vienen en formas
-- distintas según la fuente de ingesta (completo/acentuado, corto, sin tilde:
-- "Valparaiso", "Metropolitana", "Biobío", etc.). Se reconoce por palabra clave
-- (sin tilde, insensible a mayúsculas) y se devuelve siempre la forma canónica
-- de chile_regiones_geo; si no calza con ninguna, se deja tal cual (no se
-- inventa región) y simplemente no se cruza con el mapa.
create or replace function public.mapa_calor_normalizar_region(p text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when p is null or btrim(p) = '' then null
    when unaccent(lower(p)) like '%arica%' then 'Región de Arica y Parinacota'
    when unaccent(lower(p)) like '%tarapaca%' then 'Región de Tarapacá'
    when unaccent(lower(p)) like '%antofagasta%' then 'Región de Antofagasta'
    when unaccent(lower(p)) like '%atacama%' then 'Región de Atacama'
    when unaccent(lower(p)) like '%coquimbo%' then 'Región de Coquimbo'
    when unaccent(lower(p)) like '%valparaiso%' then 'Región de Valparaíso'
    when unaccent(lower(p)) like '%metropolitana%' or unaccent(lower(p)) like '%santiago%' then 'Región Metropolitana de Santiago'
    when unaccent(lower(p)) like '%higgins%' or unaccent(lower(p)) like '%libertador%' then 'Región del Libertador General Bernardo O´Higgins'
    when unaccent(lower(p)) like '%maule%' then 'Región del Maule'
    when unaccent(lower(p)) like '%nuble%' then 'Región del Ñuble'
    when unaccent(lower(p)) like '%biobio%' or unaccent(lower(p)) like '%bio bio%' or unaccent(lower(p)) like '%bio-bio%' then 'Región del Biobío'
    when unaccent(lower(p)) like '%araucania%' then 'Región de la Araucanía'
    when unaccent(lower(p)) like '%rios%' then 'Región de Los Ríos'
    when unaccent(lower(p)) like '%lagos%' then 'Región de los Lagos'
    when unaccent(lower(p)) like '%aysen%' then 'Región Aysén del General Carlos Ibáñez del Campo'
    when unaccent(lower(p)) like '%magallanes%' or unaccent(lower(p)) like '%antartica%' then 'Región de Magallanes y de la Antártica'
    else btrim(p)
  end
$function$;

-- Solo CLP: licitaciones_bi y compras_agiles traen un puñado de filas en USD
-- (u otra moneda); sumarlas junto a los montos en CLP distorsionaría el color
-- del mapa y los rankings (mismo criterio que ya usa el cubo de órdenes de
-- compra — ver 20260923010000_cubo_oc_moneda_y_drilldown.sql).
create or replace function public.mapa_calor_regiones()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with lic as (
    select public.mapa_calor_normalizar_region(unidad_compra_region) as region, presupuesto_estimado as monto
    from public.licitaciones_bi
    where unidad_compra_region is not null
      and (moneda is null or upper(btrim(moneda)) = 'CLP')
  ),
  ca as (
    select public.mapa_calor_normalizar_region(region) as region, monto_estimado as monto
    from public.compras_agiles
    where region is not null
      and (moneda is null or upper(btrim(moneda)) = 'CLP')
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
-- (hoy solo en licitaciones_bi), el desglose por comuna. p_capa filtra y
-- ordena el ranking por la misma capa que el usuario eligió en el mapa
-- ('lic' | 'ca' | cualquier otro valor = todas); si no, una institución que
-- domina la otra fuente podía tapar el ranking de la capa que se está viendo.
-- Los RUT se agrupan normalizados (public.rut_normalizado) porque el mismo
-- RUT llega con o sin puntos/guión según la fuente.
--
-- Nombre "_v2": la firma original mapa_calor_region_detalle(text) (sin p_capa)
-- quedó en la base como función huérfana — el DROP para liberar el nombre no
-- se pudo aplicar en vivo en esta sesión (timeouts repetidos sin bloqueo real
-- detrás, igual que otros DDL de esta sesión); no se reintentó más para no
-- seguir perdiendo tiempo. No se usa desde el frontend y no genera conflicto.
create or replace function public.mapa_calor_region_detalle_v2(p_region text, p_capa text default 'todas')
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
    where public.mapa_calor_normalizar_region(unidad_compra_region) = p_region
      and (moneda is null or upper(btrim(moneda)) = 'CLP')
  ),
  ca as (
    select organismo_rut as rut, nombre_organismo as nombre, monto_estimado as monto
    from public.compras_agiles
    where public.mapa_calor_normalizar_region(region) = p_region
      and (moneda is null or upper(btrim(moneda)) = 'CLP')
  ),
  lic_agg as (
    select public.rut_normalizado(rut) as rut_norm, max(rut) as rut, max(nombre) as nombre,
           count(*)::int as count_lic, coalesce(sum(monto), 0) as monto_lic
    from lic where rut is not null group by 1
  ),
  ca_agg as (
    select public.rut_normalizado(rut) as rut_norm, max(rut) as rut, max(nombre) as nombre,
           count(*)::int as count_ca, coalesce(sum(monto), 0) as monto_ca
    from ca where rut is not null group by 1
  ),
  ruts as (
    select rut_norm from lic_agg union select rut_norm from ca_agg
  ),
  instituciones_rank as (
    select
      coalesce(l.rut, c.rut) as rut,
      coalesce(l.nombre, c.nombre, i.nombre) as nombre,
      coalesce(l.count_lic, 0) as count_lic, coalesce(l.monto_lic, 0) as monto_lic,
      coalesce(c.count_ca, 0) as count_ca, coalesce(c.monto_ca, 0) as monto_ca,
      case p_capa
        when 'lic' then coalesce(l.monto_lic, 0)
        when 'ca' then coalesce(c.monto_ca, 0)
        else coalesce(l.monto_lic, 0) + coalesce(c.monto_ca, 0)
      end as monto_rank
    from ruts r
    left join lic_agg l on l.rut_norm = r.rut_norm
    left join ca_agg c on c.rut_norm = r.rut_norm
    left join public.instituciones i on public.rut_normalizado(i.rut) = r.rut_norm
  ),
  comunas_agg as (
    select comuna, count(*)::int as count, coalesce(sum(monto), 0) as monto
    from lic group by comuna
  )
  select jsonb_build_object(
    'instituciones', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (
        select rut, nombre, count_lic, monto_lic, count_ca, monto_ca, monto_rank as monto_total
        from instituciones_rank
        where case p_capa when 'lic' then count_lic > 0 when 'ca' then count_ca > 0 else true end
        order by monto_rank desc limit 15
      ) x
    ),
    'comunas', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (select * from comunas_agg order by monto desc limit 15) x
    )
  )
$function$;

grant execute on function public.mapa_calor_regiones() to anon, authenticated;
grant execute on function public.mapa_calor_normalizar_region(text) to anon, authenticated;
grant execute on function public.mapa_calor_region_detalle_v2(text, text) to anon, authenticated;
