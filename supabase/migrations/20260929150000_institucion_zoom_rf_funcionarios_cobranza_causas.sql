-- Pedido de Evaristo: sumar al zoom de instituciones lo que faltaba.
--
-- 1) consultas_mercado (RF/RFI): tabla nueva. La llena el edge function
--    sync-consultas-mercado (API pública de consulta-mercado.mercadopublico.cl,
--    documentada en .claude/skills/bajo-el-agua/SKILL.md fase 3). Solo
--    service_role escribe/lee directo; el cliente la ve a través de
--    institucion_zoom.
-- 2) Funcionarios: no hay tabla nueva — se extraen de
--    licitaciones_bi.raw_data->'Comprador'->>'NombreUsuario' (y CargoUsuario),
--    que YA se guarda desde hace tiempo por enrich-licitaciones-bi. Mercado
--    Público no expone email ni teléfono personal en su API pública, así que
--    solo se puede mostrar nombre y cargo — nada inventado.
-- 3) Cobranza: facturas_por_cobrar.deudor_rut es el RUT de la institución
--    (modo Cobranza ya lo guarda así) — join exacto, sin ambigüedad.
-- 4) Causas: no hay tabla de causas/juicios (no existe esa fuente de datos
--    todavía). Como aproximación real con lo que sí hay, se buscan las
--    conversaciones del propio cliente con Don Evaristo Abogado
--    (evaristo_mensajes, canal='abogado') que mencionan el nombre de la
--    institución — así el cliente ve si ya ha estado tratando un caso
--    relacionado con ella.

create table if not exists public.consultas_mercado (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  nombre text,
  descripcion text,
  motivo text,
  organismo_nombre text,
  organismo_rut text,
  encargado text,
  estado text,
  fecha_publicacion timestamptz,
  fecha_cierre timestamptz,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists consultas_mercado_organismo_rut_idx on public.consultas_mercado (organismo_rut);
create index if not exists consultas_mercado_fecha_cierre_idx on public.consultas_mercado (fecha_cierre);
alter table public.consultas_mercado enable row level security;
-- Sin políticas para authenticated/anon a propósito: se lee solo a través de
-- institucion_zoom (security definer), igual que reclamos_mp o medios_menciones.
grant select, insert, update on public.consultas_mercado to service_role;
grant usage on sequence public.consultas_mercado_id_seq to service_role;

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
  ),
  rf as (
    select coalesce(jsonb_agg(x), '[]'::jsonb) as items from (
      select codigo, nombre, estado, fecha_publicacion, fecha_cierre
      from public.consultas_mercado
      where organismo_rut = p_rut
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
        from public.licitaciones_bi l
        where l.institucion_rut = p_rut and l.raw_data ? 'Comprador'
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
      where c.canal = 'abogado'
        and m.user_id = auth.uid()
        and (select nombre from i) is not null
        and m.contenido ilike '%' || (select nombre from i) || '%'
      order by m.creado_en desc
      limit 8
    ) x
  ),
  -- Facturas propias en Cobranza donde esta institución es la deudora
  -- (facturas_por_cobrar.deudor_rut ya es el RUT exacto, sin ambigüedad).
  cobranza as (
    select coalesce(jsonb_agg(x), '[]'::jsonb) as items from (
      select numero_factura, monto, fecha_vencimiento, estado
      from public.facturas_por_cobrar
      where cliente_id = public.cliente_owner_id() and deudor_rut = p_rut
      order by fecha_vencimiento desc nulls last
      limit 15
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
    'rf', (select items from rf),
    'rf_disponible', true,
    'funcionarios', (select items from funcionarios),
    'causas', (select items from causas),
    'cobranza', (select items from cobranza)
  );
$$;

revoke all on function public.institucion_zoom(text) from public, anon;
grant execute on function public.institucion_zoom(text) to authenticated, service_role;
