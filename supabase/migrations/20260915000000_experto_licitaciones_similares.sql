-- Licitaciones similares anteriores: para analizar quién gana en licitaciones parecidas del mismo organismo
create or replace function public.experto_licitaciones_similares(p_codigo text, p_meses integer default 12, p_cantidad integer default 5)
returns table (
  codigo text, titulo text, institucion text, fecha_cierre timestamptz, monto_estimado numeric,
  monto_adjudicado numeric, adjudicatario_nombre text, adjudicatario_rut text, tipo_producto text
)
language sql stable security definer set search_path to 'public', 'extensions' as $$
  with licitacion_actual as (
    select b.codigo, b.institucion_rut, b.institucion_nombre, b.nombre, coalesce(b.presupuesto, 0) presupuesto,
           b.fecha_cierre, b.tipo, b.items
    from public.licitaciones_bi b
    where upper(b.codigo) = upper(p_codigo)
  ),
  similares as (
    select o.codigo, l.nombre titulo, l.institucion_nombre, o.fecha_cierre, o.monto_estimado,
           o.monto_adjudicado, a->>'nombre' adjudicatario, public.rut_formatear(a->>'rut') rut_adj,
           coalesce(o.items->>0, 'varios') tipo_item,
           row_number() over (order by o.fecha_cierre desc) rn
    from public.ocds_procesos o
    join public.licitaciones_bi l on l.codigo = o.codigo
    cross join licitacion_actual la
    left join jsonb_array_elements(o.adjudicatarios) a on true
    where o.comprador_rut = la.institucion_rut
      and o.codigo != upper(p_codigo)
      and coalesce(o.fecha_adjudicacion, o.fecha_publicacion) >= now() - make_interval(months => p_meses)
      and (
        -- Similitud por monto (±50%)
        (o.monto_estimado >= la.presupuesto * 0.5 and o.monto_estimado <= la.presupuesto * 1.5) or
        -- Similitud por tipo de item (si hay datos)
        (la.items::text != '[]' and o.items::text != '[]' and coalesce(o.items->>0, '') = coalesce(la.items->>'0', ''))
      )
    where o.adjudicatarios is not null
  )
  select codigo, titulo, institucion, fecha_cierre, monto_estimado, monto_adjudicado, adjudicatario, rut_adj, tipo_item
  from similares
  where rn = 1  -- Un adjudicatario por licitación (el primero)
  order by fecha_cierre desc
  limit p_cantidad;
$$;
grant execute on function public.experto_licitaciones_similares(text, integer, integer) to authenticated;
