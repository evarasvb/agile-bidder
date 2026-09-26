-- experto_fragmentacion_organismo tenía 2 huecos reales:
--  1) Solo miraba OTRAS LICITACIONES del organismo para detectar fragmentación.
--     El patrón clásico de fragmentar (dividir una compra grande en varias
--     compras ágiles chicas para evitar licitar) nunca se detectaba porque
--     `compras_agiles` no se consultaba en absoluto.
--  2) El organismo se resolvía buscando p_codigo_licitacion SOLO en
--     licitaciones_bi: si se estaba analizando una compra ágil (el caso más
--     común para este chequeo), la función devolvía vacío siempre, porque
--     ese código nunca aparece en licitaciones_bi.
-- Se reescribe para: resolver el organismo desde cualquiera de las dos tablas,
-- y comparar contra el universo combinado (licitaciones + compras ágiles).
create or replace function public.experto_fragmentacion_organismo(p_codigo_licitacion text, p_dias_ventana integer default 90)
returns table (
  codigo text, nombre text, estado text, presupuesto_estimado numeric,
  moneda text, fecha_publicacion timestamptz, dias_desde integer, "señal" text
)
language sql
stable
as $$
  with organismo as (
    select institucion_rut as rut from public.licitaciones_bi where codigo = p_codigo_licitacion
    union all
    select organismo_rut as rut from public.compras_agiles where codigo = p_codigo_licitacion
    limit 1
  ),
  universo as (
    select l.codigo, l.nombre, l.estado, l.presupuesto_estimado, l.moneda, l.fecha_publicacion, 'licitación'::text as tipo
    from public.licitaciones_bi l
    where l.institucion_rut = (select rut from organismo)
      and l.codigo <> p_codigo_licitacion
      and l.fecha_publicacion >= now() - (p_dias_ventana || ' days')::interval
      and l.estado not like '%desierto%'
    union all
    select c.codigo, c.nombre, c.estado, c.monto_estimado, c.moneda, c.fecha_publicacion, 'compra ágil'::text as tipo
    from public.compras_agiles c
    where c.organismo_rut = (select rut from organismo)
      and c.codigo <> p_codigo_licitacion
      and c.fecha_publicacion >= now() - (p_dias_ventana || ' days')::interval
      and c.estado not like '%desierto%'
  ),
  contadas as (
    select u.*,
      (now()::date - u.fecha_publicacion::date)::int as dias_desde,
      count(*) over () as total_ventana,
      count(*) filter (where u.tipo = 'compra ágil') over () as total_ca,
      count(*) filter (where u.tipo = 'licitación') over () as total_lic
    from universo u
  )
  select c.codigo, c.nombre, c.estado, c.presupuesto_estimado, c.moneda, c.fecha_publicacion, c.dias_desde,
    '⚠️ Fragmentación: ' || c.total_ventana::text || ' compras similares en ' || p_dias_ventana::text || ' días ('
      || c.total_ca::text || ' compra(s) ágil(es), ' || c.total_lic::text || ' licitación(es))' as "señal"
  from contadas c
  where c.total_ventana >= 2
  order by c.fecha_publicacion desc
  limit 6;
$$;
