-- Correcciones a institucion_zoom por hallazgos de Codex en la PR (commit
-- c8cd5f5):
--
-- 1) P1 — normalizar el RUT seguido antes de buscar: cliente_instituciones_seguidas
--    .rut_institucion se copia tal cual de ordenes_compra.rut_demandante, que
--    a veces es un "código" de Mercado Público en vez de un RUT real (mismo
--    problema que ya resolvía 20260926180000_avisos_novedades_instituciones_seguidas.sql
--    para las avisos). Sin resolverlo, el zoom de esas instituciones salía
--    vacío. Se resuelve igual que ahí: si no calza como rut, se busca en
--    licitaciones_bi.institucion_codigo -> institucion_rut.
-- 2) P1 — el detalle de reclamos (reclamante, estado) es contenido de Experto
--    Pro. institucion_zoom es security definer y estaba disponible para
--    cualquier authenticated, así que un plan free podía leer el arreglo
--    completo llamando la RPC directo, aunque la UI lo tapara. Ahora el
--    arreglo 'reclamos' solo se llena si el cliente que llama tiene plan
--    pro/business/enterprise o Experto Pro/Plus vigente (mismo criterio que
--    usePlan().verInteligencia en el frontend).
create or replace function public.institucion_zoom(p_rut text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with resolucion as (
    select coalesce(
      (select rut from public.instituciones where rut = p_rut),
      (select institucion_rut from public.licitaciones_bi
        where institucion_codigo = p_rut and institucion_rut is not null limit 1),
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
      order by (fecha_cierre > now()) desc, fecha_cierre desc nulls last
      limit 20
    ) x
  ),
  -- Nombre y cargo de quienes publican los procesos de esta institución, tal
  -- como los trae la ficha oficial (raw_data->Comprador). Sin email/teléfono:
  -- Mercado Público no los publica.
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
  -- Conversaciones propias del cliente con Don Evaristo Abogado que mencionan
  -- el nombre de la institución (aproximación de "causas" mientras no exista
  -- una fuente de datos de juicios/causas judiciales).
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
  -- Facturas propias en Cobranza donde esta institución es la deudora
  -- (facturas_por_cobrar.deudor_rut ya es el RUT exacto, sin ambigüedad).
  cobranza as (
    select coalesce(jsonb_agg(x), '[]'::jsonb) as items from (
      select numero_factura, monto, fecha_vencimiento, estado
      from public.facturas_por_cobrar, resolucion
      where cliente_id = public.cliente_owner_id() and deudor_rut = resolucion.rut_real
      order by fecha_vencimiento desc nulls last
      limit 15
    ) x
  )
  select jsonb_build_object(
    'rut', (select rut_real from resolucion),
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
    'rf', (select items from rf),
    'rf_disponible', true,
    'funcionarios', (select items from funcionarios),
    'causas', (select items from causas),
    'cobranza', (select items from cobranza)
  );
$$;

revoke all on function public.institucion_zoom(text) from public, anon;
grant execute on function public.institucion_zoom(text) to authenticated, service_role;
