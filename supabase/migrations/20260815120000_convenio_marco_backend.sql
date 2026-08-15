-- ============================================================================
-- Módulo Convenio Marco — BACKEND consultable y ágil.
--
-- Diseño de performance: la app NUNCA escanea líneas crudas. Lee 3 vistas
-- MATERIALIZADAS pequeñas e indexadas (producto / producto×proveedor /
-- producto×comprador) a través de RPCs. La ingesta (edge function
-- enrich-oc-detalle) y el refresco corren en background por cron.
--
-- Nota de datos: MercadoPúblico devuelve CodigoProducto='0' en muchas OC (el
-- ítem viene por NOMBRE, no por un ID de catálogo). Por eso el grano de análisis
-- es el NOMBRE del producto (normalizado), conservando el código real cuando MP
-- sí lo entrega.
-- ============================================================================

-- Trigger update_updated_at_column() en ordenes_compra requiere esta columna
-- (sin ella, TODO update fallaba silenciosamente).
alter table public.ordenes_compra add column if not exists updated_at timestamptz default now();

-- Clasificador del tipo de OC según el sufijo del código.
create or replace function public.mp_tipo_oc(codigo text)
returns text language sql immutable as $$
  select case
    when codigo ~* '-CM[0-9]+$' then 'convenio_marco'
    when codigo ~* '-AG[0-9]+$' then 'compra_agil'
    when codigo ~* '-SE[0-9]+$' then 'trato_directo'
    when codigo ~* '-(LP|LE|LR|LS|L1|LG|E|CO|O)[0-9]+$' then 'licitacion'
    else 'otro'
  end;
$$;

-- Vista materializada: PRODUCTO (grano principal, por nombre normalizado).
drop materialized view if exists public.mv_cm_producto cascade;
create materialized view public.mv_cm_producto as
  select public.mp_tipo_oc(oc.codigo)                                as tipo_origen,
         lower(btrim(i.producto))                                    as producto_key,
         max(i.producto)                                             as producto,
         max(nullif(i.codigo_producto,'0'))                          as codigo_producto,
         count(*)                                                    as lineas,
         count(distinct coalesce(oc.proveedor, oc.proveedor_nombre)) as proveedores,
         count(distinct coalesce(oc.demandante, oc.organismo_comprador)) as compradores,
         sum(coalesce(i.valor_total,0))                              as monto_total,
         min(i.precio_unitario)                                      as precio_min,
         avg(i.precio_unitario)                                      as precio_prom,
         max(i.precio_unitario)                                      as precio_max,
         max(oc.fecha_emision)                                       as ultima_compra
  from public.ordenes_compra_items i
  join public.ordenes_compra oc on oc.codigo = i.numero_oc
  where nullif(btrim(i.producto),'') is not null
  group by 1, 2;
create unique index ux_mv_cm_producto on public.mv_cm_producto (tipo_origen, producto_key);
create index ix_mv_cm_producto_trgm on public.mv_cm_producto using gin (producto gin_trgm_ops);
create index ix_mv_cm_producto_monto on public.mv_cm_producto (tipo_origen, monto_total desc);

-- Vista materializada: PRODUCTO × PROVEEDOR (competidores).
drop materialized view if exists public.mv_cm_producto_proveedor cascade;
create materialized view public.mv_cm_producto_proveedor as
  select public.mp_tipo_oc(oc.codigo) as tipo_origen, lower(btrim(i.producto)) as producto_key,
         coalesce(oc.proveedor, oc.proveedor_nombre) as proveedor,
         count(*) as lineas, sum(coalesce(i.valor_total,0)) as monto_total,
         min(i.precio_unitario) as precio_min, avg(i.precio_unitario) as precio_prom, max(i.precio_unitario) as precio_max
  from public.ordenes_compra_items i join public.ordenes_compra oc on oc.codigo = i.numero_oc
  where nullif(btrim(i.producto),'') is not null and coalesce(oc.proveedor, oc.proveedor_nombre) is not null
  group by 1, 2, coalesce(oc.proveedor, oc.proveedor_nombre);
create unique index ux_mv_cm_prod_prov on public.mv_cm_producto_proveedor (tipo_origen, producto_key, proveedor);
create index ix_mv_cm_prod_prov_key on public.mv_cm_producto_proveedor (producto_key);

-- Vista materializada: PRODUCTO × COMPRADOR (instituciones).
drop materialized view if exists public.mv_cm_producto_comprador cascade;
create materialized view public.mv_cm_producto_comprador as
  select public.mp_tipo_oc(oc.codigo) as tipo_origen, lower(btrim(i.producto)) as producto_key,
         coalesce(oc.demandante, oc.organismo_comprador) as comprador,
         count(*) as lineas, sum(coalesce(i.valor_total,0)) as monto_total, avg(i.precio_unitario) as precio_prom
  from public.ordenes_compra_items i join public.ordenes_compra oc on oc.codigo = i.numero_oc
  where nullif(btrim(i.producto),'') is not null and coalesce(oc.demandante, oc.organismo_comprador) is not null
  group by 1, 2, coalesce(oc.demandante, oc.organismo_comprador);
create unique index ux_mv_cm_prod_comp on public.mv_cm_producto_comprador (tipo_origen, producto_key, comprador);
create index ix_mv_cm_prod_comp_key on public.mv_cm_producto_comprador (producto_key);

revoke all on public.mv_cm_producto, public.mv_cm_producto_proveedor, public.mv_cm_producto_comprador from anon, authenticated;

-- Refresco (lo dispara un cron; CONCURRENTLY para no bloquear lecturas).
create or replace function public.refrescar_cm_bi()
returns void language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view concurrently public.mv_cm_producto;
  refresh materialized view concurrently public.mv_cm_producto_proveedor;
  refresh materialized view concurrently public.mv_cm_producto_comprador;
exception when others then
  refresh materialized view public.mv_cm_producto;
  refresh materialized view public.mv_cm_producto_proveedor;
  refresh materialized view public.mv_cm_producto_comprador;
end;
$$;

-- RPCs de consulta (rápidas; leen solo las MV indexadas). Grano = producto_key.
create or replace function public.cm_buscar_productos(
  termino text default '', p_tipo text default 'convenio_marco', limite int default 30, desplazamiento int default 0
) returns jsonb language sql stable security definer set search_path = public as $$
  with base as (
    select * from public.mv_cm_producto m
    where (p_tipo is null or m.tipo_origen = p_tipo)
      and (nullif(btrim(termino),'') is null
           or m.producto ilike '%'||btrim(termino)||'%'
           or coalesce(m.codigo_producto,'') ilike '%'||btrim(termino)||'%')
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'items', coalesce((select jsonb_agg(x) from (
        select producto_key, producto, codigo_producto, proveedores, compradores,
               monto_total, precio_min, precio_prom, precio_max, ultima_compra
        from base order by monto_total desc nulls last
        limit greatest(1, least(coalesce(limite,30),100)) offset greatest(0, coalesce(desplazamiento,0))
      ) x), '[]'::jsonb)
  );
$$;

create or replace function public.cm_producto_detalle(
  p_producto_key text, p_tipo text default 'convenio_marco'
) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'resumen', (select to_jsonb(m) from public.mv_cm_producto m
                where m.producto_key = p_producto_key and (p_tipo is null or m.tipo_origen = p_tipo) limit 1),
    'proveedores', coalesce((select jsonb_agg(x) from (
        select proveedor, lineas, monto_total, precio_min, precio_prom, precio_max
        from public.mv_cm_producto_proveedor
        where producto_key = p_producto_key and (p_tipo is null or tipo_origen = p_tipo)
        order by monto_total desc nulls last limit 15) x), '[]'::jsonb),
    'compradores', coalesce((select jsonb_agg(x) from (
        select comprador, lineas, monto_total, precio_prom
        from public.mv_cm_producto_comprador
        where producto_key = p_producto_key and (p_tipo is null or tipo_origen = p_tipo)
        order by monto_total desc nulls last limit 15) x), '[]'::jsonb)
  );
$$;

grant execute on function public.cm_buscar_productos(text,text,int,int) to authenticated;
grant execute on function public.cm_producto_detalle(text,text) to authenticated;

-- Crons (ya aplicados en el proyecto; se documentan aquí):
--   enrich-oc-detalle-cron  '*/5 * * * *'  -> net.http_post a la edge function
--        enrich-oc-detalle (body {"limit":12,"tipo":"convenio_marco"}), gentil,
--        prioriza Convenio Marco. Rellena ordenes_compra + ordenes_compra_items.
--   refrescar-cm-bi-cron    '*/15 * * * *' -> select public.refrescar_cm_bi();
