-- 1) cubo_oc mezclaba líneas en distinta moneda (CLP, CLF/UF, USD, UTM, EUR) en
--    el mismo sum(monto_linea), mostrado siempre como pesos chilenos. Se acota
--    el cubo a líneas en CLP (o sin moneda registrada, que en la práctica
--    siempre es CLP) — es menos del 1% de las líneas, no distorsiona los
--    totales. cubo_oc_1d y cubo_oc_tot (pre-agregados sobre cubo_oc, de la
--    migración 20260918020000) dependen de esta vista y se recrean igual.
drop materialized view if exists public.cubo_oc cascade;
create materialized view public.cubo_oc as
select
  l.tipo,
  date_trunc('month', l.fecha)::date as mes,
  nullif(nullif(btrim(l.categoria), ''), 'NA') as categoria,
  lower(btrim(l.producto)) as producto_key,
  max(l.producto) as producto,
  nullif(btrim(l.rut_proveedor), '') as rut_proveedor,
  max(l.proveedor_nombre) as proveedor,
  nullif(btrim(l.rut_organismo), '') as rut_organismo,
  max(l.organismo) as organismo,
  count(*)::int as lineas,
  sum(coalesce(l.cantidad, 0)) as cantidad,
  sum(coalesce(l.monto_linea, 0)) as monto,
  min(l.precio_neto) filter (where l.precio_neto > 0) as precio_min,
  percentile_cont(0.5) within group (order by l.precio_neto) filter (where l.precio_neto > 0) as precio_med,
  max(l.precio_neto) filter (where l.precio_neto > 0) as precio_max
from public.oc_lineas l
where l.fecha is not null and nullif(btrim(l.producto), '') is not null
  and (l.moneda is null or upper(btrim(l.moneda)) = 'CLP')
group by 1, 2, 3, 4, 6, 8
with no data;

create unique index cubo_oc_uq on public.cubo_oc (tipo, mes, producto_key, coalesce(rut_proveedor, ''), coalesce(rut_organismo, ''), coalesce(categoria, ''));
create index cubo_oc_tipo_mes_idx on public.cubo_oc (tipo, mes);
create index cubo_oc_prov_idx on public.cubo_oc (rut_proveedor);
create index cubo_oc_producto_trgm on public.cubo_oc using gin (producto_key gin_trgm_ops);
create index cubo_oc_proveedor_trgm on public.cubo_oc using gin (lower(proveedor) gin_trgm_ops);
create index cubo_oc_organismo_trgm on public.cubo_oc using gin (lower(organismo) gin_trgm_ops);
grant select on public.cubo_oc to authenticated, service_role;

-- Recrear los pre-agregados que dependían de cubo_oc (borrados por CASCADE),
-- exactamente como en 20260918020000_cubo_1d_preagregado.sql.
create materialized view public.cubo_oc_1d as
select coalesce(tipo, '*') as tipo, 'producto'::text as dim, producto_key as clave, max(producto) as etiqueta,
  sum(lineas)::bigint as lineas, sum(cantidad) as cantidad, sum(monto) as monto, min(precio_min) as precio_min,
  sum(precio_med * lineas) / nullif(sum(lineas), 0) as precio_med, max(precio_max) as precio_max,
  count(distinct coalesce(rut_proveedor, proveedor))::int as proveedores, count(distinct coalesce(rut_organismo, organismo))::int as organismos, count(distinct producto_key)::int as productos
from public.cubo_oc group by grouping sets ((tipo, producto_key), (producto_key))
union all
select coalesce(tipo, '*'), 'proveedor', coalesce(rut_proveedor, proveedor), max(proveedor),
  sum(lineas)::bigint, sum(cantidad), sum(monto), min(precio_min), sum(precio_med * lineas) / nullif(sum(lineas), 0), max(precio_max),
  count(distinct coalesce(rut_proveedor, proveedor))::int, count(distinct coalesce(rut_organismo, organismo))::int, count(distinct producto_key)::int
from public.cubo_oc where coalesce(rut_proveedor, proveedor) is not null group by grouping sets ((tipo, coalesce(rut_proveedor, proveedor)), (coalesce(rut_proveedor, proveedor)))
union all
select coalesce(tipo, '*'), 'organismo', coalesce(rut_organismo, organismo), max(organismo),
  sum(lineas)::bigint, sum(cantidad), sum(monto), min(precio_min), sum(precio_med * lineas) / nullif(sum(lineas), 0), max(precio_max),
  count(distinct coalesce(rut_proveedor, proveedor))::int, count(distinct coalesce(rut_organismo, organismo))::int, count(distinct producto_key)::int
from public.cubo_oc where coalesce(rut_organismo, organismo) is not null group by grouping sets ((tipo, coalesce(rut_organismo, organismo)), (coalesce(rut_organismo, organismo)))
union all
select coalesce(tipo, '*'), 'categoria', categoria, categoria,
  sum(lineas)::bigint, sum(cantidad), sum(monto), min(precio_min), sum(precio_med * lineas) / nullif(sum(lineas), 0), max(precio_max),
  count(distinct coalesce(rut_proveedor, proveedor))::int, count(distinct coalesce(rut_organismo, organismo))::int, count(distinct producto_key)::int
from public.cubo_oc where categoria is not null group by grouping sets ((tipo, categoria), (categoria))
union all
select coalesce(tipo, '*'), 'mes', mes::text, mes::text,
  sum(lineas)::bigint, sum(cantidad), sum(monto), min(precio_min), sum(precio_med * lineas) / nullif(sum(lineas), 0), max(precio_max),
  count(distinct coalesce(rut_proveedor, proveedor))::int, count(distinct coalesce(rut_organismo, organismo))::int, count(distinct producto_key)::int
from public.cubo_oc group by grouping sets ((tipo, mes), (mes))
with no data;

create unique index cubo_oc_1d_uq on public.cubo_oc_1d (tipo, dim, clave);
create index cubo_oc_1d_monto_idx on public.cubo_oc_1d (tipo, dim, monto desc);

create materialized view public.cubo_oc_tot as
select coalesce(tipo, '*') as tipo,
  sum(lineas)::bigint as lineas, sum(cantidad) as cantidad, sum(monto) as monto, min(precio_min) as precio_min,
  sum(precio_med * lineas) / nullif(sum(lineas), 0) as precio_med, max(precio_max) as precio_max,
  count(distinct coalesce(rut_proveedor, proveedor))::int as proveedores, count(distinct coalesce(rut_organismo, organismo))::int as organismos, count(distinct producto_key)::int as productos
from public.cubo_oc group by grouping sets ((tipo), ())
with no data;
create unique index cubo_oc_tot_uq on public.cubo_oc_tot (tipo);

grant select on public.cubo_oc_1d, public.cubo_oc_tot to authenticated, service_role;

-- 2) Drill-down a la fuente: mismo set de filtros que usa cubo_consultar('oc',
--    ...), pero devuelve las OC individuales detrás del dato (código real de
--    Mercado Público, con su moneda de línea) para poder abrir/descargar la
--    orden de compra original.
create or replace function public.cubo_oc_ordenes(
  p_filtros jsonb default '{}'::jsonb,
  p_desde date default null,
  p_hasta date default null,
  p_limite int default 200
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_where text := 'true';
  v_f jsonb := coalesce(p_filtros, '{}'::jsonb);
  v_sql text;
  v_out jsonb;
begin
  if nullif(v_f->>'tipo', '') is not null then v_where := v_where || format(' and l.tipo = %L', v_f->>'tipo'); end if;
  if nullif(v_f->>'texto', '') is not null then v_where := v_where || format(' and (lower(btrim(l.producto)) like %L or lower(l.proveedor_nombre) like %L or lower(l.organismo) like %L)', '%'||lower(v_f->>'texto')||'%', '%'||lower(v_f->>'texto')||'%', '%'||lower(v_f->>'texto')||'%'); end if;
  if nullif(v_f->>'producto', '') is not null then v_where := v_where || format(' and lower(btrim(l.producto)) like %L', '%'||lower(v_f->>'producto')||'%'); end if;
  if nullif(v_f->>'proveedor', '') is not null then v_where := v_where || format(' and lower(l.proveedor_nombre) like %L', '%'||lower(v_f->>'proveedor')||'%'); end if;
  if nullif(v_f->>'rut_proveedor', '') is not null then v_where := v_where || format(' and l.rut_proveedor = %L', v_f->>'rut_proveedor'); end if;
  if nullif(v_f->>'organismo', '') is not null then v_where := v_where || format(' and lower(l.organismo) like %L', '%'||lower(v_f->>'organismo')||'%'); end if;
  if nullif(v_f->>'rut_organismo', '') is not null then v_where := v_where || format(' and l.rut_organismo = %L', v_f->>'rut_organismo'); end if;
  if nullif(v_f->>'categoria', '') is not null then v_where := v_where || format(' and lower(l.categoria) like %L', '%'||lower(v_f->>'categoria')||'%'); end if;
  if nullif(v_f->>'precio_min', '') is not null then v_where := v_where || format(' and l.precio_neto >= %s', (v_f->>'precio_min')::numeric); end if;
  if nullif(v_f->>'precio_max', '') is not null then v_where := v_where || format(' and l.precio_neto <= %s', (v_f->>'precio_max')::numeric); end if;
  if p_desde is not null then v_where := v_where || format(' and l.fecha >= %L', p_desde); end if;
  if p_hasta is not null then v_where := v_where || format(' and l.fecha < %L', (p_hasta + interval '1 month')::date); end if;
  -- Mismo predicado de moneda que cubo_oc: si no se filtrara, una OC con
  -- líneas en USD/UF aparecería aquí sumada como si fuera CLP y el total no
  -- cuadraría con lo que el cubo (ya filtrado a CLP) muestra arriba.
  v_where := v_where || ' and (l.moneda is null or upper(btrim(l.moneda)) = ''CLP'')';

  v_sql := format(
    'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from ('
    || 'select l.codigo, max(l.proveedor_nombre) as proveedor, max(l.organismo) as organismo, max(l.tipo) as tipo, '
    || 'count(*)::int as lineas, sum(l.monto_linea) as monto, max(l.moneda) as moneda, '
    || 'max(l.fecha) as fecha '
    || 'from public.oc_lineas l where %s group by l.codigo order by sum(l.monto_linea) desc limit %s) x',
    v_where, greatest(1, least(coalesce(p_limite, 200), 500)));
  execute v_sql into v_out;
  return v_out;
end;
$$;

revoke execute on function public.cubo_oc_ordenes(jsonb, date, date, int) from public, anon;
grant execute on function public.cubo_oc_ordenes(jsonb, date, date, int) to authenticated, service_role;

-- Solo se llenan las 3 vistas recreadas en esta migración (cubo_oc,
-- cubo_oc_1d, cubo_oc_tot); cubo_lic no se tocó y sigue su refresco normal
-- por el cron existente (refrescar-cubo-ventas, cada 6 h).
refresh materialized view public.cubo_oc;
refresh materialized view public.cubo_oc_1d;
refresh materialized view public.cubo_oc_tot;
