-- "Modo estudio de la competencia" (pedido de Evaristo): ficha profunda de UN
-- proveedor competidor — mismo patrón que institucion_zoom (una función SQL
-- que junta todo en un jsonb) + mismo patrón que postulacion_analisis para el
-- análisis narrativo con IA (hechos reales -> Gemini -> se cachea).
--
-- El reporte "Competidores" ya existente (bi_top_proveedores/bi_proveedor_detalle)
-- identifica proveedores solo por NOMBRE (mv_bi_proveedor no tiene RUT). Acá sí
-- se resuelve el RUT (ordenes_compra.rut_proveedor ya existe y tiene índice
-- rut_norm(rut_proveedor)), lo que además permite cruzar licitaciones (OCDS)
-- donde el proveedor aparece como oferente/adjudicatario — el reporte viejo no
-- lo hacía (solo veía órdenes de compra ya facturadas).

-- Ficha profunda de un proveedor: identidad, tendencia mensual (12 meses),
-- productos fuertes, clientes, y su historial en licitaciones (OCDS) como
-- oferente/adjudicatario — participación, tasa de éxito, licitaciones recientes.
-- Si no se pasa p_rut, se resuelve por el RUT más frecuente de ese nombre en
-- ordenes_compra (fallback: agrega por nombre si ningún OC de ese nombre tiene
-- RUT registrado, igual que el bi_proveedor_detalle original).
create or replace function public.proveedor_zoom(p_nombre text, p_rut text default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with rn as (
    select coalesce(
      rut_norm(p_rut),
      (select rut_norm(rut_proveedor) from public.ordenes_compra
       where coalesce(proveedor, proveedor_nombre) = p_nombre and rut_proveedor is not null
       group by rut_norm(rut_proveedor) order by count(*) desc limit 1)
    ) as r
  ),
  oc as (
    select * from public.ordenes_compra
    where last_scraped_at is not null
      and (
        ((select r from rn) is not null and rut_norm(rut_proveedor) = (select r from rn))
        or ((select r from rn) is null and coalesce(proveedor, proveedor_nombre) = p_nombre)
      )
  ),
  identidad as (
    select
      max(coalesce(proveedor, proveedor_nombre)) as nombre,
      (select r from rn) as rut_norm,
      public.rut_formatear((select r from rn)) as rut,
      count(*)::int as ordenes,
      coalesce(sum(total), 0) as monto_total,
      count(distinct coalesce(demandante, organismo_comprador))::int as compradores,
      min(fecha_emision) as primera_orden,
      max(fecha_emision) as ultima_orden
    from oc
  ),
  tendencia as (
    select to_char(fecha_emision, 'YYYY-MM') as mes, count(*)::int as ordenes, coalesce(sum(total), 0) as monto
    from oc
    where fecha_emision >= (current_date - interval '12 months')
    group by 1 order by 1
  ),
  productos as (
    select i.producto, count(*)::int as lineas, coalesce(sum(i.valor_total), 0) as monto,
           round(avg(i.precio_unitario)) as precio_prom
    from oc join public.ordenes_compra_items i on i.numero_oc = oc.codigo
    where i.producto is not null
    group by i.producto order by monto desc nulls last limit 10
  ),
  clientes as (
    select coalesce(oc.demandante, oc.organismo_comprador) as comprador, count(*)::int as ordenes, coalesce(sum(oc.total), 0) as monto
    from oc where coalesce(oc.demandante, oc.organismo_comprador) is not null
    group by 1 order by monto desc nulls last limit 10
  ),
  -- Cruce por GIN (ocds_procesos_oferentes_gin) contra el RUT ya normalizado:
  -- usa el índice, no escanea toda la tabla por proveedor.
  lic as (
    select o.codigo, o.titulo, o.comprador_nombre, o.fecha_adjudicacion, o.fecha_publicacion,
           o.monto_estimado, o.estado_award, o.num_oferentes,
           (select (a->>'monto')::numeric from jsonb_array_elements(coalesce(o.adjudicatarios, '[]'::jsonb)) a
            where rut_norm(a->>'rut') = (select r from rn) limit 1) as monto_ganado
    from public.ocds_procesos o
    where (select r from rn) is not null
      and o.oferentes @> jsonb_build_array(jsonb_build_object('rut', (select r from rn)))
  ),
  lic_resumen as (
    select count(*)::int as participo, count(*) filter (where monto_ganado is not null)::int as gano,
           coalesce(sum(monto_ganado), 0) as monto_adjudicado_total
    from lic
  )
  select jsonb_build_object(
    'identidad', (select to_jsonb(identidad) from identidad),
    'tendencia_mensual', coalesce((select jsonb_agg(to_jsonb(tendencia)) from tendencia), '[]'::jsonb),
    'productos', coalesce((select jsonb_agg(to_jsonb(productos)) from productos), '[]'::jsonb),
    'clientes', coalesce((select jsonb_agg(to_jsonb(clientes)) from clientes), '[]'::jsonb),
    'licitaciones_resumen', (select to_jsonb(lic_resumen) from lic_resumen),
    'licitaciones_recientes', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select * from lic order by coalesce(fecha_adjudicacion, fecha_publicacion) desc nulls last limit 15
      ) x
    ), '[]'::jsonb)
  )
$function$;

grant execute on function public.proveedor_zoom(text, text) to authenticated;

-- Análisis narrativo de IA sobre un competidor (fortalezas/debilidades/cómo
-- competirle), cacheado por cliente — mismo patrón que postulacion_analisis.
create table if not exists public.estudio_competidor (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null,
  proveedor_rut text not null,
  proveedor_nombre text not null,
  resumen text not null,
  fortalezas text[] not null default '{}',
  debilidades text[] not null default '{}',
  recomendacion text,
  generado_en timestamptz not null default now(),
  unique (cliente_id, proveedor_rut)
);

alter table public.estudio_competidor enable row level security;

drop policy if exists "ec_select" on public.estudio_competidor;
drop policy if exists "ec_insert" on public.estudio_competidor;
drop policy if exists "ec_update" on public.estudio_competidor;

create policy "ec_select" on public.estudio_competidor
  for select using (cliente_id = cliente_owner_id() and tiene_modulo_operativo());
create policy "ec_insert" on public.estudio_competidor
  for insert with check (cliente_id = cliente_owner_id() and tiene_modulo_operativo());
create policy "ec_update" on public.estudio_competidor
  for update using (cliente_id = cliente_owner_id() and tiene_modulo_operativo());

grant select, insert, update on public.estudio_competidor to authenticated;
