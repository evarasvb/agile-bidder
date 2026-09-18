-- Cubo de consulta de ventas al Estado (tipo QlikView): órdenes de compra por
-- Convenio Marco, Compra Ágil, Trato Directo, etc. (oc_lineas, grano mensual) y
-- licitaciones adjudicadas (ocds_procesos × adjudicatarios). Toda consulta es
-- SQL puro sobre vistas materializadas: cero tokens de IA por pregunta.
--
--   cubo_oc  : tipo, mes, categoría, producto, proveedor, organismo → líneas, cantidad, monto, precio min/mediana/max
--   cubo_lic : mes, comprador, adjudicatario, rubro, método → procesos, monto adjudicado, estimado, oferentes
--   cubo_consultar(...)  : agrupa por las dimensiones pedidas con filtros; una sola RPC para cualquier pivote
--   cubo_opciones(...)   : autocompletar valores de una dimensión
--   cubo_refrescar()     : refresco (pg_cron cada 6 h)

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- cubo_oc
drop materialized view if exists public.cubo_oc;
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
group by 1, 2, 3, 4, 6, 8
with no data;

create unique index cubo_oc_uq on public.cubo_oc (tipo, mes, producto_key, coalesce(rut_proveedor, ''), coalesce(rut_organismo, ''), coalesce(categoria, ''));
create index cubo_oc_tipo_mes_idx on public.cubo_oc (tipo, mes);
create index cubo_oc_prov_idx on public.cubo_oc (rut_proveedor);
create index cubo_oc_org_idx on public.cubo_oc (rut_organismo);
create index cubo_oc_producto_trgm on public.cubo_oc using gin (producto_key gin_trgm_ops);
create index cubo_oc_proveedor_trgm on public.cubo_oc using gin (lower(proveedor) gin_trgm_ops);
create index cubo_oc_organismo_trgm on public.cubo_oc using gin (lower(organismo) gin_trgm_ops);

-- ---------------------------------------------------------------- cubo_lic
drop materialized view if exists public.cubo_lic;
create materialized view public.cubo_lic as
select
  p.codigo,
  max(p.titulo) as titulo,
  max(p.metodo) as metodo,
  date_trunc('month', max(p.fecha_adjudicacion))::date as mes,
  max(p.comprador_rut) as comprador_rut,
  max(p.comprador_nombre) as comprador,
  nullif(btrim(a->>'rut'), '') as rut_adjudicatario,
  coalesce(nullif(btrim(a->>'nombre'), ''), 'Sin nombre') as adjudicatario,
  max(split_part(coalesce(p.items->0->>'descripcion', ''), ' / ', 1)) as rubro,
  max(p.monto_estimado) as monto_estimado,
  sum(coalesce((a->>'monto')::numeric, p.monto_adjudicado)) as monto_adjudicado,
  max(p.num_oferentes) as num_oferentes,
  max(p.fecha_adjudicacion) as fecha_adjudicacion
from public.ocds_procesos p
cross join lateral jsonb_array_elements(case when jsonb_typeof(p.adjudicatarios) = 'array' then p.adjudicatarios else '[]'::jsonb end) a
where p.fecha_adjudicacion is not null and coalesce((a->>'monto')::numeric, p.monto_adjudicado, 0) > 0
-- Un mismo adjudicatario puede aparecer varias veces en un proceso (una por ítem): se agrupa.
group by p.codigo, nullif(btrim(a->>'rut'), ''), coalesce(nullif(btrim(a->>'nombre'), ''), 'Sin nombre')
with no data;

create unique index cubo_lic_uq on public.cubo_lic (codigo, coalesce(rut_adjudicatario, ''), adjudicatario);
create index cubo_lic_mes_idx on public.cubo_lic (mes);
create index cubo_lic_comprador_idx on public.cubo_lic (comprador_rut);
create index cubo_lic_adj_idx on public.cubo_lic (rut_adjudicatario);
create index cubo_lic_titulo_trgm on public.cubo_lic using gin (lower(titulo) gin_trgm_ops);
create index cubo_lic_adjudicatario_trgm on public.cubo_lic using gin (lower(adjudicatario) gin_trgm_ops);
create index cubo_lic_comprador_trgm on public.cubo_lic using gin (lower(comprador) gin_trgm_ops);

-- ---------------------------------------------------------------- consulta
-- p_fuente: 'oc' | 'lic'. p_dims: dimensiones a agrupar (en orden). p_filtros (jsonb):
--   oc : {tipo, texto, producto, proveedor, rut_proveedor, organismo, rut_organismo, categoria, precio_min, precio_max}
--   lic: {texto, comprador, comprador_rut, adjudicatario, rut_adjudicatario, rubro, metodo}
-- p_orden: métrica para ordenar (monto, lineas, cantidad, precio_med, proveedores, organismos, procesos, oferentes...).
create or replace function public.cubo_consultar(
  p_fuente text default 'oc',
  p_dims text[] default array['producto'],
  p_filtros jsonb default '{}'::jsonb,
  p_desde date default null,
  p_hasta date default null,
  p_orden text default 'monto',
  p_desc boolean default true,
  p_limite int default 50,
  p_offset int default 0
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_dims_sql text := '';
  v_where text := 'true';
  v_metricas text;
  v_orden text;
  v_sql text;
  v_out jsonb;
  d text;
  v_mapa jsonb;
  v_ordenes jsonb;
  v_tabla text;
  v_f jsonb := coalesce(p_filtros, '{}'::jsonb);
begin
  if p_fuente = 'lic' then
    v_tabla := 'public.cubo_lic';
    v_mapa := '{"mes":"mes","comprador":"comprador","comprador_rut":"comprador_rut","adjudicatario":"adjudicatario","rut_adjudicatario":"rut_adjudicatario","rubro":"rubro","metodo":"metodo","titulo":"titulo","codigo":"codigo"}'::jsonb;
    v_metricas := 'count(distinct codigo)::int as procesos, count(*)::int as adjudicaciones, sum(monto_adjudicado) as monto, sum(monto_estimado) as monto_estimado, '
               || 'round(avg(num_oferentes), 1) as oferentes, count(distinct comprador_rut)::int as compradores, count(distinct coalesce(rut_adjudicatario, adjudicatario))::int as adjudicatarios, '
               || 'round(100.0 * sum(monto_adjudicado) / nullif(sum(monto_estimado), 0), 1) as pct_del_estimado';
    v_ordenes := '["procesos","adjudicaciones","monto","monto_estimado","oferentes","compradores","adjudicatarios","pct_del_estimado"]'::jsonb;
    if nullif(v_f->>'texto', '') is not null then v_where := v_where || format(' and (lower(titulo) like %L or lower(adjudicatario) like %L or lower(comprador) like %L)', '%'||lower(v_f->>'texto')||'%', '%'||lower(v_f->>'texto')||'%', '%'||lower(v_f->>'texto')||'%'); end if;
    if nullif(v_f->>'comprador', '') is not null then v_where := v_where || format(' and lower(comprador) like %L', '%'||lower(v_f->>'comprador')||'%'); end if;
    if nullif(v_f->>'comprador_rut', '') is not null then v_where := v_where || format(' and comprador_rut = %L', v_f->>'comprador_rut'); end if;
    if nullif(v_f->>'adjudicatario', '') is not null then v_where := v_where || format(' and lower(adjudicatario) like %L', '%'||lower(v_f->>'adjudicatario')||'%'); end if;
    if nullif(v_f->>'rut_adjudicatario', '') is not null then v_where := v_where || format(' and rut_adjudicatario = %L', v_f->>'rut_adjudicatario'); end if;
    if nullif(v_f->>'rubro', '') is not null then v_where := v_where || format(' and lower(rubro) like %L', '%'||lower(v_f->>'rubro')||'%'); end if;
    if nullif(v_f->>'metodo', '') is not null then v_where := v_where || format(' and metodo = %L', v_f->>'metodo'); end if;
  else
    v_tabla := 'public.cubo_oc';
    v_mapa := '{"mes":"mes","tipo":"tipo","categoria":"categoria","producto":"producto","producto_key":"producto_key","proveedor":"proveedor","rut_proveedor":"rut_proveedor","organismo":"organismo","rut_organismo":"rut_organismo"}'::jsonb;
    v_metricas := 'sum(lineas)::bigint as lineas, sum(cantidad) as cantidad, sum(monto) as monto, min(precio_min) as precio_min, '
               || 'percentile_cont(0.5) within group (order by precio_med) as precio_med, max(precio_max) as precio_max, '
               || 'count(distinct coalesce(rut_proveedor, proveedor))::int as proveedores, count(distinct coalesce(rut_organismo, organismo))::int as organismos, '
               || 'count(distinct producto_key)::int as productos';
    v_ordenes := '["lineas","cantidad","monto","precio_min","precio_med","precio_max","proveedores","organismos","productos"]'::jsonb;
    if nullif(v_f->>'tipo', '') is not null then v_where := v_where || format(' and tipo = %L', v_f->>'tipo'); end if;
    if nullif(v_f->>'texto', '') is not null then v_where := v_where || format(' and (producto_key like %L or lower(proveedor) like %L or lower(organismo) like %L)', '%'||lower(v_f->>'texto')||'%', '%'||lower(v_f->>'texto')||'%', '%'||lower(v_f->>'texto')||'%'); end if;
    if nullif(v_f->>'producto', '') is not null then v_where := v_where || format(' and producto_key like %L', '%'||lower(v_f->>'producto')||'%'); end if;
    if nullif(v_f->>'proveedor', '') is not null then v_where := v_where || format(' and lower(proveedor) like %L', '%'||lower(v_f->>'proveedor')||'%'); end if;
    if nullif(v_f->>'rut_proveedor', '') is not null then v_where := v_where || format(' and rut_proveedor = %L', v_f->>'rut_proveedor'); end if;
    if nullif(v_f->>'organismo', '') is not null then v_where := v_where || format(' and lower(organismo) like %L', '%'||lower(v_f->>'organismo')||'%'); end if;
    if nullif(v_f->>'rut_organismo', '') is not null then v_where := v_where || format(' and rut_organismo = %L', v_f->>'rut_organismo'); end if;
    if nullif(v_f->>'categoria', '') is not null then v_where := v_where || format(' and lower(categoria) like %L', '%'||lower(v_f->>'categoria')||'%'); end if;
    if nullif(v_f->>'precio_min', '') is not null then v_where := v_where || format(' and precio_med >= %s', (v_f->>'precio_min')::numeric); end if;
    if nullif(v_f->>'precio_max', '') is not null then v_where := v_where || format(' and precio_med <= %s', (v_f->>'precio_max')::numeric); end if;
  end if;

  if p_desde is not null then v_where := v_where || format(' and mes >= %L', date_trunc('month', p_desde)::date); end if;
  if p_hasta is not null then v_where := v_where || format(' and mes <= %L', date_trunc('month', p_hasta)::date); end if;

  -- Dimensiones (solo las de la lista blanca).
  foreach d in array coalesce(p_dims, '{}'::text[]) loop
    if v_mapa ? d then v_dims_sql := v_dims_sql || format('%I, ', v_mapa->>d); end if;
  end loop;
  v_dims_sql := rtrim(v_dims_sql, ', ');
  v_orden := case when v_ordenes ? coalesce(p_orden, '') then p_orden else 'monto' end;

  if v_dims_sql = '' then
    execute format('select jsonb_build_object(''total_filas'', 0, ''filas'', ''[]''::jsonb, ''totales'', (select to_jsonb(t) from (select %s from %s where %s) t))', v_metricas, v_tabla, v_where) into v_out;
    return v_out;
  end if;

  -- Una sola pasada agrupada (CTE materializada): total de filas, página y totales salen de ahí.
  v_sql := format('select %s, %s from %s where %s group by %s', v_dims_sql, v_metricas, v_tabla, v_where, v_dims_sql);
  execute format(
    'with g as materialized (%s) select jsonb_build_object('
    || '''total_filas'', (select count(*) from g), '
    || '''filas'', (select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (select * from g order by %I %s nulls last limit %s offset %s) x), '
    || '''totales'', (select to_jsonb(t) from (select %s from %s where %s) t))',
    v_sql, v_orden, case when p_desc then 'desc' else 'asc' end,
    greatest(1, least(coalesce(p_limite, 50), 500)), greatest(0, coalesce(p_offset, 0)),
    v_metricas, v_tabla, v_where) into v_out;
  return v_out;
end;
$$;

-- Valores posibles de una dimensión (autocompletar), ordenados por monto.
create or replace function public.cubo_opciones(p_fuente text default 'oc', p_dim text default 'proveedor', p_texto text default '', p_tipo text default null, p_limite int default 12)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_sql text; v_out jsonb; v_col text; v_tabla text; v_monto text;
begin
  if p_fuente = 'lic' then
    v_tabla := 'public.cubo_lic'; v_monto := 'monto_adjudicado';
    v_col := case p_dim when 'comprador' then 'comprador' when 'adjudicatario' then 'adjudicatario' when 'rubro' then 'rubro' when 'metodo' then 'metodo' else null end;
  else
    v_tabla := 'public.cubo_oc'; v_monto := 'monto';
    v_col := case p_dim when 'proveedor' then 'proveedor' when 'organismo' then 'organismo' when 'categoria' then 'categoria' when 'producto' then 'producto' when 'tipo' then 'tipo' else null end;
  end if;
  if v_col is null then return '[]'::jsonb; end if;
  v_sql := format('select coalesce(jsonb_agg(jsonb_build_object(''valor'', v, ''monto'', m) order by m desc), ''[]''::jsonb) from (select %I as v, sum(%I) as m from %s where %I is not null %s %s group by 1 order by 2 desc limit %s) t',
    v_col, v_monto, v_tabla, v_col,
    case when nullif(p_texto, '') is not null then format('and lower(%I) like %L', v_col, '%'||lower(p_texto)||'%') else '' end,
    case when p_fuente <> 'lic' and nullif(p_tipo, '') is not null then format('and tipo = %L', p_tipo) else '' end,
    greatest(1, least(coalesce(p_limite, 12), 50)));
  execute v_sql into v_out;
  return v_out;
end;
$$;

-- Primer llenado sin CONCURRENTLY (una MV vacía no admite refresco concurrente); después, concurrente.
create or replace function public.cubo_refrescar() returns void language plpgsql security definer set search_path = public as $$
declare v_pop boolean;
begin
  select relispopulated into v_pop from pg_class where oid = 'public.cubo_lic'::regclass;
  if v_pop then refresh materialized view concurrently public.cubo_lic; else refresh materialized view public.cubo_lic; end if;
  select relispopulated into v_pop from pg_class where oid = 'public.cubo_oc'::regclass;
  if v_pop then refresh materialized view concurrently public.cubo_oc; else refresh materialized view public.cubo_oc; end if;
end;
$$;

revoke execute on function public.cubo_consultar(text, text[], jsonb, date, date, text, boolean, int, int) from public, anon;
revoke execute on function public.cubo_opciones(text, text, text, text, int) from public, anon;
grant execute on function public.cubo_consultar(text, text[], jsonb, date, date, text, boolean, int, int) to authenticated, service_role;
grant execute on function public.cubo_opciones(text, text, text, text, int) to authenticated, service_role;
grant select on public.cubo_oc, public.cubo_lic to authenticated, service_role;

do $$
begin
  perform cron.unschedule('refrescar-cubo-ventas') where exists (select 1 from cron.job where jobname = 'refrescar-cubo-ventas');
  perform cron.schedule('refrescar-cubo-ventas', '50 */6 * * *', $cmd$ set statement_timeout = '30min'; select public.cubo_refrescar(); $cmd$);
  -- Llenado inicial en segundo plano (el job se elimina solo al terminar).
  perform cron.unschedule('cubo-llenado-inicial') where exists (select 1 from cron.job where jobname = 'cubo-llenado-inicial');
  perform cron.schedule('cubo-llenado-inicial', '* * * * *', $cmd$ set statement_timeout = '30min'; select public.cubo_refrescar(); select cron.unschedule('cubo-llenado-inicial'); $cmd$);
end $$;
