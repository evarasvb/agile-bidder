-- Módulo "Instituciones que sigo": una función que junta, por RUT exacto (sin
-- ambigüedad de nombre), todo lo que el cliente pidió ver de una institución
-- seguida en un solo "zoom": pagos oportunos (conducta de pago/reclamos, igual
-- criterio que organismo_riesgo), reclamos recientes, noticias, licitaciones y
-- compras ágiles abiertas o recientes. "RF" (consultas al mercado/RFI) queda
-- marcado como no disponible: Mercado Público no publica esos procesos en un
-- feed propio y hoy no se ingesta nada de eso — se deja el campo listo para
-- cuando exista esa fuente de datos.
create or replace function public.institucion_zoom(p_rut text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with i as (
    select * from public.instituciones where rut = p_rut
  ),
  r as (select rr.* from i, lateral public.institucion_reclamos_resumen(i.rut, 365) rr),
  reclamos as (
    select coalesce(jsonb_agg(x), '[]'::jsonb) as items from (
      select fecha, tipo, reclamante, estado
      from public.reclamos_mp
      where organismo_rut = p_rut
      order by fecha desc
      limit 20
    ) x
  ),
  noticias as (
    select coalesce(jsonb_agg(x), '[]'::jsonb) as items from (
      select m.titulo, m.url, m.medio, m.fecha
      from public.medios_menciones m, i
      where m.organismo_norm = public.medios_norm(i.nombre)
      order by m.fecha desc nulls last
      limit 12
    ) x
  ),
  licitaciones as (
    select coalesce(jsonb_agg(x), '[]'::jsonb) as items from (
      select codigo, nombre, estado, fecha_cierre, fecha_publicacion, presupuesto_estimado
      from public.licitaciones_bi
      where institucion_rut = p_rut
      order by (fecha_cierre > now()) desc, fecha_cierre desc nulls last
      limit 20
    ) x
  ),
  compras as (
    select coalesce(jsonb_agg(x), '[]'::jsonb) as items from (
      select codigo, nombre, estado, fecha_cierre, fecha_publicacion, monto_estimado
      from public.compras_agiles
      where organismo_rut = p_rut
      order by (fecha_cierre > now()) desc, fecha_cierre desc nulls last
      limit 20
    ) x
  )
  select jsonb_build_object(
    'rut', p_rut,
    'encontrada', exists(select 1 from i),
    'institucion', (select nombre from i),
    'conducta_pago', (select conducta_pago from i),
    'pago_promedio_dias', (select pago_promedio_dias from i),
    'plazo_pago', (select plazo_pago_texto from i),
    'pago_actualizado_el', (select pago_actualizado_el from i),
    'reclamos_ficha', (select reclamos_total from i),
    'oc_total', (select oc_total from i),
    'oc_monto_total', (select oc_monto_total from i),
    'reclamos_pago_12m', (select pago from r),
    'reclamos_proceso_12m', (select proceso from r),
    'reclamos_pago_90d', (select pago_90d from r),
    'reclamantes_pago', (select reclamantes_pago from r),
    'top_reclamante_pct', (select top_reclamante_pct from r),
    'procesos_12m', (select procesos_publicados from r),
    'pago_por_100_procesos', (select pago_por_100_procesos from r),
    'reclamos_desde', (select desde from r),
    'nivel', case
      when (select reclamos_total from i) is null and (select pago from r) is null then 'sin_dato'
      when coalesce((select pago_por_100_procesos from r), 0) > 5 or coalesce((select reclamos_total from i), 0) > 50 then 'alto'
      when coalesce((select pago_por_100_procesos from r), 0) >= 1 or coalesce((select reclamos_total from i), 0) > 5 then 'medio'
      else 'bajo' end,
    'reclamos', (select items from reclamos),
    'noticias', (select items from noticias),
    'licitaciones', (select items from licitaciones),
    'compras_agiles', (select items from compras),
    'rf', '[]'::jsonb,
    'rf_disponible', false
  );
$$;

revoke all on function public.institucion_zoom(text) from public, anon;
grant execute on function public.institucion_zoom(text) to authenticated, service_role;
