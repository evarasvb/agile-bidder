-- experto_organismo entrega además el desglose de reclamos (pago vs proceso), concentración por
-- reclamante y ratio por cada 100 procesos publicados, desde institucion_reclamos_resumen.
drop function if exists public.experto_organismo(text);
create or replace function public.experto_organismo(nombre_o_rut text)
returns table (institucion text, rut text, region text, conducta_pago text, pago_promedio_dias integer,
               reclamos integer, reclamos_hace_90d integer, plazo_pago text, dato_pago_al date,
               reclamos_pago_12m integer, reclamos_proceso_12m integer, reclamantes_pago_12m integer,
               top_reclamante text, top_reclamante_pct numeric, reclamos_pago_90d integer,
               procesos_12m integer, reclamos_pago_por_100_procesos numeric, reclamos_desde date,
               oc_total integer, oc_monto_total numeric, oc_12m integer, monto_12m numeric,
               top_proveedores jsonb, licitaciones_abiertas integer)
language sql stable security definer set search_path to 'public', 'extensions' as $$
  with i as (
    select * from public.instituciones
    where rut = nombre_o_rut
       or unaccent(lower(nombre)) like '%' || unaccent(lower(nombre_o_rut)) || '%'
    order by (pago_actualizado_el is not null) desc, pago_actualizado_el desc nulls last,
             oc_monto_total desc nulls last, length(nombre)
    limit 1),
  oc as (
    select o.* from public.ordenes_compra o, i
    where o.rut_demandante = i.rut
      and coalesce(o.fecha_envio_oc, o.fecha_emision) >= now() - interval '12 months'),
  top as (
    select jsonb_agg(jsonb_build_object('proveedor', proveedor, 'rut', rut_proveedor, 'ordenes', n, 'monto', m) order by m desc) j
    from (select coalesce(proveedor, proveedor_nombre) proveedor, rut_proveedor, count(*) n, sum(coalesce(total, monto_total)) m
          from oc group by 1,2 order by m desc limit 8) t),
  rr as (select r.* from i, lateral public.institucion_reclamos_resumen(i.rut, 365) r)
  select i.nombre, i.rut, i.region, i.conducta_pago, i.pago_promedio_dias, i.reclamos_total,
         (select s.reclamos_12m from public.institucion_pago_snapshot s
            where s.rut = i.rut and s.fecha <= current_date - 90 order by s.fecha desc limit 1),
         i.plazo_pago_texto, i.pago_actualizado_el::date,
         rr.pago, rr.proceso, rr.reclamantes_pago, rr.top_reclamante, rr.top_reclamante_pct, rr.pago_90d,
         rr.procesos_publicados, rr.pago_por_100_procesos, rr.desde,
         i.oc_total, i.oc_monto_total,
         (select count(*) from oc)::int, (select sum(coalesce(total, monto_total)) from oc),
         (select j from top),
         (select count(*) from public.licitaciones_bi l where l.institucion_rut = i.rut and l.fecha_cierre > now())::int
  from i left join rr on true;
$$;
grant execute on function public.experto_organismo(text) to service_role;
