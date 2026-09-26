-- El buscador público del landing (buscar_teaser_licitaciones) solo miraba
-- licitaciones_bi (licitaciones grandes), pero la promesa en pantalla es
-- "licitaciones y compras ágiles". Servicios chicos como mudanza, fletes o
-- aseo se compran casi siempre por compra ágil, así que quedaban invisibles
-- para un visitante anónimo aunque hubiera oportunidades reales abiertas.
create or replace function public.buscar_teaser_licitaciones(termino text, limite integer default 6)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with palabras as (
    select distinct lower(unaccent(w)) as palabra
    from regexp_split_to_table(btrim(termino), '\s+') as w
    where btrim(w) <> ''
  ),
  base as (
    select codigo, nombre, institucion_nombre, unidad_compra_region,
           presupuesto_estimado, moneda, fecha_cierre
    from public.licitaciones_bi l
    where estado = 'Publicada'
      and codigo_estado = 5
      and fecha_cierre > now()
      and exists (select 1 from palabras)
      and not exists (
        select 1 from palabras p
        where not (
          lower(unaccent(l.nombre)) like '%' || p.palabra || '%'
          or lower(unaccent(coalesce(l.descripcion, ''))) like '%' || p.palabra || '%'
        )
      )
    union all
    select c.codigo, c.nombre, c.nombre_organismo as institucion_nombre, c.region as unidad_compra_region,
           c.monto_estimado as presupuesto_estimado, c.moneda, c.fecha_cierre
    from public.compras_agiles c
    where c.fecha_cierre > now()
      and exists (select 1 from palabras)
      and not exists (
        select 1 from palabras p
        where not (
          lower(unaccent(c.nombre)) like '%' || p.palabra || '%'
          or lower(unaccent(coalesce(c.descripcion, ''))) like '%' || p.palabra || '%'
        )
      )
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'items', coalesce((
      select jsonb_agg(t)
      from (
        select * from base
        order by fecha_cierre asc
        limit greatest(1, least(coalesce(limite, 6), 12))
      ) t
    ), '[]'::jsonb)
  );
$function$;
