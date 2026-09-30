-- Tercera ronda de hallazgos de Codex sobre la PR (commit 95fb3ff), sobre las
-- correcciones anteriores (20260929170000):
--
-- 1) P1 — el gate de Experto Pro solo tapaba el arreglo 'reclamos' (con
--    identidades), pero las métricas agregadas (reclamos_pago_12m,
--    reclamos_proceso_12m, concentración, ratio por 100 procesos, plazo de
--    pago, nivel de riesgo) seguían saliendo sin condición. Esas son
--    exactamente los datos que RiesgoOrganismoCard trata como "Experto Pro"
--    (ver src/components/organismo/RiesgoOrganismoCard.tsx: toda la tarjeta
--    de riesgo de pago se tapa para plan free) — un usuario free llamando
--    institucion_zoom directo igual los conseguía. Se gatean también estos
--    campos con el mismo criterio ya usado para 'reclamos'.
-- 2) P2 — consultas_mercado nunca borra filas viejas (sync-consultas-mercado
--    solo hace upsert), así que sin un filtro de fecha una institución sin
--    RF reciente seguía mostrando consultas de hace meses como si fueran
--    "las próximas". Se agrega una ventana de 180 días sobre
--    fecha_publicacion (generosa: la sección ya se presenta como "adelanto
--    de lo que se viene", no como historial completo).
create or replace function public.institucion_zoom(p_rut text, p_nombre text default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with resolucion as (
    select coalesce(
      (select rut from public.instituciones
        where public.rut_normalizado(rut) = public.rut_normalizado(p_rut)
        order by (rut ~ '\.') desc, rut
        limit 1),
      (select institucion_rut from public.licitaciones_bi
        where institucion_codigo = p_rut and institucion_rut is not null limit 1),
      (select rut from public.instituciones
        where p_nombre is not null and public.medios_norm(nombre) = public.medios_norm(p_nombre)
        order by (rut ~ '\.') desc, rut
        limit 1),
      p_rut
    ) as rut_real
  ),
  i as (
    select inst.* from public.instituciones inst, resolucion where inst.rut = resolucion.rut_real
  ),
  r as (select rr.* from resolucion, lateral public.institucion_reclamos_resumen(resolucion.rut_real, 365) rr),
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
  ),
  reclamos as (
    select case when (select pro from acceso) then coalesce(jsonb_agg(x), '[]'::jsonb) else '[]'::jsonb end as items from (
      select fecha, tipo, reclamante, estado
      from public.reclamos_mp, resolucion
      where organismo_rut = resolucion.rut_real
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
      from public.licitaciones_bi, resolucion
      where institucion_rut = resolucion.rut_real
      order by (fecha_cierre > now()) desc, fecha_cierre desc nulls last
      limit 20
    ) x
  ),
  compras as (
    select coalesce(jsonb_agg(x), '[]'::jsonb) as items from (
      select codigo, nombre, estado, fecha_cierre, fecha_publicacion, monto_estimado
      from public.compras_agiles, resolucion
      where organismo_rut = resolucion.rut_real
      order by (fecha_cierre > now()) desc, fecha_cierre desc nulls last
      limit 20
    ) x
  ),
  rf as (
    select coalesce(jsonb_agg(x), '[]'::jsonb) as items from (
      select codigo, nombre, estado, fecha_publicacion, fecha_cierre
      from public.consultas_mercado, resolucion
      where organismo_rut = resolucion.rut_real
        and fecha_publicacion > now() - interval '180 days'
      order by (fecha_cierre > now()) desc, fecha_cierre desc nulls last
      limit 20
    ) x
  ),
  funcionarios as (
    select coalesce(jsonb_agg(x), '[]'::jsonb) as items from (
      select nombre, cargo, count(*) as procesos, max(fecha) as ultimo
      from (
        select
          nullif(trim(l.raw_data->'Comprador'->>'NombreUsuario'), '') as nombre,
          nullif(trim(l.raw_data->'Comprador'->>'CargoUsuario'), '') as cargo,
          coalesce(l.fecha_publicacion, l.fecha_creacion) as fecha
        from public.licitaciones_bi l, resolucion
        where l.institucion_rut = resolucion.rut_real and l.raw_data ? 'Comprador'
      ) u
      where u.nombre is not null
      group by u.nombre, u.cargo
      order by max(fecha) desc
      limit 10
    ) x
  ),
  causas as (
    select coalesce(jsonb_agg(x), '[]'::jsonb) as items from (
      select left(m.contenido, 200) as extracto, m.creado_en as fecha
      from public.evaristo_mensajes m
      join public.evaristo_conversaciones c on c.id = m.conversacion_id
      , i
      where c.canal = 'abogado'
        and m.user_id = auth.uid()
        and i.nombre is not null
        and m.contenido ilike '%' || i.nombre || '%'
      order by m.creado_en desc
      limit 8
    ) x
  ),
  cobranza as (
    select coalesce(jsonb_agg(x), '[]'::jsonb) as items from (
      select numero_factura, monto, fecha_vencimiento, estado
      from public.facturas_por_cobrar, resolucion
      where cliente_id = public.cliente_owner_id()
        and public.rut_normalizado(deudor_rut) = public.rut_normalizado(resolucion.rut_real)
      order by fecha_vencimiento desc nulls last
      limit 15
    ) x
  )
  select jsonb_build_object(
    'rut', (select rut_real from resolucion),
    'encontrada', exists(select 1 from i),
    'institucion', (select nombre from i),
    -- Riesgo de pago (conducta, plazo, reclamos agregados, nivel): mismo
    -- contenido que RiesgoOrganismoCard trata como Experto Pro. Se tapa
    -- completo para plan free, igual que el arreglo 'reclamos'.
    'conducta_pago', case when (select pro from acceso) then (select conducta_pago from i) else null end,
    'pago_promedio_dias', case when (select pro from acceso) then (select pago_promedio_dias from i) else null end,
    'plazo_pago', case when (select pro from acceso) then (select plazo_pago_texto from i) else null end,
    'pago_actualizado_el', case when (select pro from acceso) then (select pago_actualizado_el from i) else null end,
    'reclamos_ficha', case when (select pro from acceso) then (select reclamos_total from i) else null end,
    'oc_total', (select oc_total from i),
    'oc_monto_total', (select oc_monto_total from i),
    'reclamos_pago_12m', case when (select pro from acceso) then (select pago from r) else null end,
    'reclamos_proceso_12m', case when (select pro from acceso) then (select proceso from r) else null end,
    'reclamos_pago_90d', case when (select pro from acceso) then (select pago_90d from r) else null end,
    'reclamantes_pago', case when (select pro from acceso) then (select reclamantes_pago from r) else null end,
    'top_reclamante_pct', case when (select pro from acceso) then (select top_reclamante_pct from r) else null end,
    'procesos_12m', case when (select pro from acceso) then (select procesos_publicados from r) else null end,
    'pago_por_100_procesos', case when (select pro from acceso) then (select pago_por_100_procesos from r) else null end,
    'reclamos_desde', case when (select pro from acceso) then (select desde from r) else null end,
    'nivel', case
      when not (select pro from acceso) then 'bloqueado'
      when (select reclamos_total from i) is null and (select pago from r) is null then 'sin_dato'
      when coalesce((select pago_por_100_procesos from r), 0) > 5 or coalesce((select reclamos_total from i), 0) > 50 then 'alto'
      when coalesce((select pago_por_100_procesos from r), 0) >= 1 or coalesce((select reclamos_total from i), 0) > 5 then 'medio'
      else 'bajo' end,
    'reclamos', (select items from reclamos),
    'noticias', (select items from noticias),
    'licitaciones', (select items from licitaciones),
    'compras_agiles', (select items from compras),
    'rf', (select items from rf),
    'rf_disponible', true,
    'funcionarios', (select items from funcionarios),
    'causas', (select items from causas),
    'cobranza', (select items from cobranza)
  );
$$;

revoke all on function public.institucion_zoom(text, text) from public, anon;
grant execute on function public.institucion_zoom(text, text) to authenticated, service_role;
