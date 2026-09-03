-- Riesgo de pago del organismo para la app (usuarios autenticados): mismos datos que usa el Experto.
-- Recibe el código del proceso (licitación o compra ágil) y/o el nombre del organismo.
create or replace function public.organismo_riesgo(p_codigo text default null, p_nombre text default null)
returns table (institucion text, rut text, reclamos_ficha integer, dato_pago_al date, plazo_pago text,
               conducta_pago text, pago_promedio_dias integer,
               reclamos_pago_12m integer, reclamos_proceso_12m integer, reclamantes_pago integer,
               top_reclamante_pct numeric, reclamos_pago_90d integer, procesos_12m integer,
               pago_por_100_procesos numeric, reclamos_desde date, nivel text)
language sql stable security definer set search_path to 'public', 'extensions' as $$
  with rut_proceso as (
    select coalesce(
      (select b.institucion_rut from public.licitaciones_bi b where p_codigo is not null and b.codigo = p_codigo limit 1),
      (select c.organismo_rut from public.compras_agiles c where p_codigo is not null and c.codigo = p_codigo limit 1)) r),
  i as (
    select * from public.instituciones
    where rut = (select r from rut_proceso)
       or ((select r from rut_proceso) is null and p_nombre is not null
           and unaccent(lower(nombre)) like '%' || unaccent(lower(p_nombre)) || '%')
    order by (pago_actualizado_el is not null) desc, pago_actualizado_el desc nulls last, length(nombre)
    limit 1),
  r as (select rr.* from i, lateral public.institucion_reclamos_resumen(i.rut, 365) rr)
  select i.nombre, i.rut, i.reclamos_total, i.pago_actualizado_el::date, i.plazo_pago_texto,
         i.conducta_pago, i.pago_promedio_dias,
         r.pago, r.proceso, r.reclamantes_pago, r.top_reclamante_pct, r.pago_90d, r.procesos_publicados,
         r.pago_por_100_procesos, r.desde,
         case
           when i.reclamos_total is null and r.pago is null then 'sin_dato'
           when coalesce(r.pago_por_100_procesos, 0) > 5 or coalesce(i.reclamos_total, 0) > 50 then 'alto'
           when coalesce(r.pago_por_100_procesos, 0) >= 1 or coalesce(i.reclamos_total, 0) > 5 then 'medio'
           else 'bajo' end
  from i left join r on true;
$$;
revoke execute on function public.organismo_riesgo(text, text) from public, anon;
grant execute on function public.organismo_riesgo(text, text) to authenticated, service_role;
