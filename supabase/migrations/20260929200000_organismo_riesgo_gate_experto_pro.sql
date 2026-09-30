-- Hallazgo P1 de Codex sobre la PR (commit f022255): al gatear las métricas
-- de riesgo en institucion_zoom quedó expuesta la misma laguna en la RPC
-- hermana organismo_riesgo (la que usa RiesgoOrganismoCard) — es
-- security definer, se concede a authenticated y devolvía reclamos_ficha,
-- el desglose, la concentración, el ratio y el nivel sin comprobar el plan.
-- El frontend nunca llamaba a esta RPC en modo free (useOrganismoRiesgo se
-- deshabilita cuando RiesgoOrganismoCard no pasa codigo/organismo por no
-- tener verInteligencia), pero un usuario podía invocarla directo. Se aplica
-- el mismo criterio de acceso (plan pro/business/enterprise o Experto
-- Pro/Plus vigente) usado en institucion_zoom.
create or replace function public.organismo_riesgo(p_codigo text default null::text, p_nombre text default null::text)
returns table(institucion text, rut text, reclamos_ficha integer, dato_pago_al date, plazo_pago text, conducta_pago text, pago_promedio_dias integer, reclamos_pago_12m integer, reclamos_proceso_12m integer, reclamantes_pago integer, top_reclamante_pct numeric, reclamos_pago_90d integer, procesos_12m integer, pago_por_100_procesos numeric, reclamos_desde date, nivel text)
language sql
stable security definer
set search_path to 'public', 'extensions'
as $function$
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
  r as (select rr.* from i, lateral public.institucion_reclamos_resumen(i.rut, 365) rr),
  acceso as (
    select (
      exists (
        select 1 from public.clientes cl
        where cl.id = public.cliente_owner_id() and cl.plan in ('pro', 'business', 'enterprise')
      )
      or exists (
        select 1 from public.experto_pro e
        where e.user_id = auth.uid() and e.hasta > now() and e.nivel in ('pro', 'plus')
      )
    ) as pro
  )
  select i.nombre, i.rut,
         case when (select pro from acceso) then i.reclamos_total end,
         case when (select pro from acceso) then i.pago_actualizado_el::date end,
         case when (select pro from acceso) then i.plazo_pago_texto end,
         case when (select pro from acceso) then i.conducta_pago end,
         case when (select pro from acceso) then i.pago_promedio_dias end,
         case when (select pro from acceso) then r.pago end,
         case when (select pro from acceso) then r.proceso end,
         case when (select pro from acceso) then r.reclamantes_pago end,
         case when (select pro from acceso) then r.top_reclamante_pct end,
         case when (select pro from acceso) then r.pago_90d end,
         case when (select pro from acceso) then r.procesos_publicados end,
         case when (select pro from acceso) then r.pago_por_100_procesos end,
         case when (select pro from acceso) then r.desde end,
         case
           when not (select pro from acceso) then 'bloqueado'
           when i.reclamos_total is null and r.pago is null then 'sin_dato'
           when coalesce(r.pago_por_100_procesos, 0) > 5 or coalesce(i.reclamos_total, 0) > 50 then 'alto'
           when coalesce(r.pago_por_100_procesos, 0) >= 1 or coalesce(i.reclamos_total, 0) > 5 then 'medio'
           else 'bajo' end
  from i left join r on true;
$function$;
