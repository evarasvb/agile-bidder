-- Paso 2 de blindaje: que un usuario GRATIS logueado tampoco pueda extraer la
-- inteligencia profunda ni emitir llaves de la extensión. El control de plan se
-- hace por DETRÁS (en la base y las funciones), no solo en la pantalla.
--
-- NO se aplica en caliente a producción: viaja en la PR para revisión y recién
-- toma efecto al mergear y desplegar. Los clientes que pagan no se ven afectados.

-- ─────────────────────────────────────────────────────────────
-- Helper reutilizable: ¿este usuario tiene plan de pago?
-- Clave: se evalúa el plan de la EMPRESA DUEÑA, no el de la ficha personal.
-- Un asiento invitado (tabla vendedores) tiene su propia ficha 'clientes' en
-- 'free'; el plan que vale es el del dueño que lo invitó. Se resuelve el dueño
-- igual que cliente_owner_id(), pero parametrizado por user_id para poder usarlo
-- también desde las edge functions (service_role, sin auth.uid()).
-- Paga = plan del dueño distinto de 'free', o ventana Experto Pro/Plus personal.
-- ─────────────────────────────────────────────────────────────
create or replace function public.plan_pagado_de_usuario(p_user_id uuid)
returns boolean
language sql stable security definer set search_path to 'public' as $$
  with owner as (
    select coalesce(
      (select c.id
         from public.vendedores v
         join public.clientes c on c.user_id = v.invitado_por
        where v.user_id = p_user_id and v.activo is true and v.invitado_por is not null
        order by v.updated_at desc nulls last limit 1),
      (select id from public.clientes where user_id = p_user_id order by created_at asc limit 1)
    ) as cid
  )
  select
    coalesce((select c.plan is not null and c.plan <> 'free'
                from public.clientes c join owner o on o.cid = c.id), false)
    or exists (select 1 from public.experto_pro e
               where e.user_id = p_user_id and e.hasta > now());
$$;
revoke execute on function public.plan_pagado_de_usuario(uuid) from public, anon;
grant execute on function public.plan_pagado_de_usuario(uuid) to authenticated, service_role;

-- Azúcar para el usuario actual (lo usan las RPC y las políticas RLS).
create or replace function public.tiene_plan_pago(p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.plan_pagado_de_usuario(coalesce(p_user_id, auth.uid()));
$$;
revoke execute on function public.tiene_plan_pago(uuid) from public, anon;
grant execute on function public.tiene_plan_pago(uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- organismo_riesgo: riesgo de pago del organismo. Solo plan de pago.
-- (misma definición de antes + guardia de plan; free recibe cero filas, que es
--  justo lo que la tarjeta de riesgo ya sabe manejar.)
-- ─────────────────────────────────────────────────────────────
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
  from i left join r on true
  where public.tiene_plan_pago();
$$;
revoke execute on function public.organismo_riesgo(text, text) from public, anon;
grant execute on function public.organismo_riesgo(text, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- inteligencia_oc_oportunidad: quién gana / quién compra / precios reales.
-- Solo plan de pago; free recibe cero filas (la ficha deja de filtrar el detalle).
-- ─────────────────────────────────────────────────────────────
create or replace function public.inteligencia_oc_oportunidad(
  p_codigo text, p_tipo text, p_limit int default 60)
returns table(
  oc_codigo text, organismo text, proveedor text, rut_proveedor text,
  producto text, precio_unitario numeric, cantidad numeric, valor_total numeric,
  fecha timestamptz, score real
)
language plpgsql stable security definer
set search_path = public
as $function$
#variable_conflict use_column
begin
  -- Guardia de plan: los usuarios free no reciben inteligencia de OC.
  if not public.tiene_plan_pago() then
    return;
  end if;
  perform set_config('pg_trgm.word_similarity_threshold', '0.3', true);
  return query
  with textos as (
    select distinct txt, cod from (
      select i.nombre_norm as txt, i.codigo_producto as cod
      from public.compras_agiles ca
      join public.compras_agiles_items i on i.compra_agil_id = ca.id
      where p_tipo = 'compra_agil' and ca.codigo = p_codigo and i.nombre_norm is not null
      union all
      select i.nombre_norm as txt, i.codigo_producto as cod
      from public.licitaciones_bi l
      join public.licitaciones_bi_items i on i.licitacion_id = l.id
      where p_tipo = 'licitacion' and l.codigo = p_codigo and i.nombre_norm is not null
    ) t
    where length(txt) >= 3
    limit 25
  ),
  matches as (
    select m.noc, m.prod, m.pu, m.cant, m.vt, m.sc
    from textos te
    cross join lateral (
      select oi.numero_oc as noc, oi.producto as prod, oi.precio_unitario as pu,
             oi.cantidad as cant, oi.valor_total as vt,
             greatest(
               case when te.cod is not null and oi.codigo_producto is not null
                         and oi.codigo_producto = te.cod then 1.0::real else 0::real end,
               coalesce(word_similarity(oi.producto_norm, te.txt), 0::real)
             ) as sc
      from public.ordenes_compra_items oi
      where oi.producto_norm %> te.txt or (te.cod is not null and oi.codigo_producto = te.cod)
      order by oi.producto_norm <->> te.txt
      limit 40
    ) m
  ),
  best as (
    select distinct on (noc, prod) noc, prod, pu, cant, vt, sc
    from matches
    order by noc, prod, sc desc
  )
  select o.codigo, o.organismo_comprador, o.proveedor_nombre, o.rut_proveedor,
         b.prod, b.pu, b.cant, b.vt, o.fecha_emision, b.sc
  from best b
  join public.ordenes_compra o on o.numero_oc = b.noc
  where b.sc >= 0.3
  order by b.sc desc, o.fecha_emision desc nulls last
  limit greatest(1, least(p_limit, 100));
end $function$;
revoke execute on function public.inteligencia_oc_oportunidad(text, text, int) from public, anon;
grant execute on function public.inteligencia_oc_oportunidad(text, text, int) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- Extensión: emitir una API key exige plan de pago (server-side, no solo UI).
-- Se reemplaza la política de INSERT para añadir la condición de plan.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "Clients can create their own API keys" on public.extension_api_keys;
create policy "Clients can create their own API keys"
  on public.extension_api_keys for insert to public
  with check (
    cliente_id in (select c.id from public.clientes c where c.user_id = (select auth.uid()))
    and public.tiene_plan_pago()
  );
