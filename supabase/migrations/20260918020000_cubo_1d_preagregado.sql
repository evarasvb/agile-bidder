-- Cubo: pre-agregados de una dimensión (producto, proveedor, institución,
-- categoría, mes) por tipo de compra y para todos los tipos ('*'), más totales
-- por tipo. Las consultas amplias de una dimensión responden en milisegundos en
-- vez de ordenar 800 mil filas; el resto sigue el camino genérico sobre cubo_oc.

drop materialized view if exists public.cubo_oc_1d;
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

drop materialized view if exists public.cubo_oc_tot;
create materialized view public.cubo_oc_tot as
select coalesce(tipo, '*') as tipo,
  sum(lineas)::bigint as lineas, sum(cantidad) as cantidad, sum(monto) as monto, min(precio_min) as precio_min,
  sum(precio_med * lineas) / nullif(sum(lineas), 0) as precio_med, max(precio_max) as precio_max,
  count(distinct coalesce(rut_proveedor, proveedor))::int as proveedores, count(distinct coalesce(rut_organismo, organismo))::int as organismos, count(distinct producto_key)::int as productos
from public.cubo_oc group by grouping sets ((tipo), ())
with no data;
create unique index cubo_oc_tot_uq on public.cubo_oc_tot (tipo);

grant select on public.cubo_oc_1d, public.cubo_oc_tot to authenticated, service_role;

create or replace function public.cubo_refrescar_1d() returns void language plpgsql security definer set search_path = public as $$
declare v_pop boolean;
begin
  select relispopulated into v_pop from pg_class where oid = 'public.cubo_oc_1d'::regclass;
  if v_pop then refresh materialized view concurrently public.cubo_oc_1d; else refresh materialized view public.cubo_oc_1d; end if;
  select relispopulated into v_pop from pg_class where oid = 'public.cubo_oc_tot'::regclass;
  if v_pop then refresh materialized view concurrently public.cubo_oc_tot; else refresh materialized view public.cubo_oc_tot; end if;
end;
$$;

create or replace function public.cubo_refrescar() returns void language plpgsql security definer set search_path = public as $$
declare v_pop boolean;
begin
  select relispopulated into v_pop from pg_class where oid = 'public.cubo_lic'::regclass;
  if v_pop then refresh materialized view concurrently public.cubo_lic; else refresh materialized view public.cubo_lic; end if;
  select relispopulated into v_pop from pg_class where oid = 'public.cubo_oc'::regclass;
  if v_pop then refresh materialized view concurrently public.cubo_oc; else refresh materialized view public.cubo_oc; end if;
  perform public.cubo_refrescar_1d();
end;
$$;

-- Consulta: camino rápido (una dimensión, sin más filtros que el tipo) sobre los
-- pre-agregados; camino genérico sobre cubo_oc con precio típico ponderado (sin
-- ordenamientos caros) y más memoria de trabajo para la sesión.
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
  v_tipo text;
  v_solo_tipo boolean;
  v_lim int := greatest(1, least(coalesce(p_limite, 50), 500));
  v_off int := greatest(0, coalesce(p_offset, 0));
  v_dir text := case when p_desc then 'desc' else 'asc' end;
begin
  perform set_config('work_mem', '128MB', true);

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
               || 'sum(precio_med * lineas) / nullif(sum(lineas), 0) as precio_med, max(precio_max) as precio_max, '
               || 'count(distinct coalesce(rut_proveedor, proveedor))::int as proveedores, count(distinct coalesce(rut_organismo, organismo))::int as organismos, '
               || 'count(distinct producto_key)::int as productos';
    v_ordenes := '["lineas","cantidad","monto","precio_min","precio_med","precio_max","proveedores","organismos","productos"]'::jsonb;

    -- Camino rápido: solo filtro de tipo (o ninguno), sin fechas, cero o una dimensión pre-agregada.
    v_solo_tipo := p_desde is null and p_hasta is null
      and not exists (select 1 from jsonb_object_keys(v_f) k where k <> 'tipo' and nullif(v_f->>k, '') is not null);
    v_tipo := coalesce(nullif(v_f->>'tipo', ''), '*');
    v_orden := case when v_ordenes ? coalesce(p_orden, '') then p_orden else 'monto' end;
    if v_solo_tipo and coalesce(array_length(p_dims, 1), 0) = 0 then
      execute format('select jsonb_build_object(''total_filas'', 0, ''filas'', ''[]''::jsonb, ''totales'', (select to_jsonb(t) from (select lineas, cantidad, monto, precio_min, precio_med, precio_max, proveedores, organismos, productos from public.cubo_oc_tot where tipo = %L) t))', v_tipo) into v_out;
      return v_out;
    end if;
    if v_solo_tipo and array_length(p_dims, 1) = 1 and p_dims[1] in ('producto', 'proveedor', 'organismo', 'categoria', 'mes')
       and (select relispopulated from pg_class where oid = 'public.cubo_oc_1d'::regclass) then
      execute format(
        'with g as (select etiqueta as %I, lineas, cantidad, monto, precio_min, precio_med, precio_max, proveedores, organismos, productos from public.cubo_oc_1d where tipo = %L and dim = %L) '
        || 'select jsonb_build_object(''total_filas'', (select count(*) from g), '
        || '''filas'', (select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (select * from g order by %I %s nulls last limit %s offset %s) x), '
        || '''totales'', (select to_jsonb(t) from (select lineas, cantidad, monto, precio_min, precio_med, precio_max, proveedores, organismos, productos from public.cubo_oc_tot where tipo = %L) t))',
        p_dims[1], v_tipo, p_dims[1], v_orden, v_dir, v_lim, v_off, v_tipo) into v_out;
      return v_out;
    end if;

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

  foreach d in array coalesce(p_dims, '{}'::text[]) loop
    if v_mapa ? d then v_dims_sql := v_dims_sql || format('%I, ', v_mapa->>d); end if;
  end loop;
  v_dims_sql := rtrim(v_dims_sql, ', ');
  v_orden := case when v_ordenes ? coalesce(p_orden, '') then p_orden else 'monto' end;

  if v_dims_sql = '' then
    execute format('select jsonb_build_object(''total_filas'', 0, ''filas'', ''[]''::jsonb, ''totales'', (select to_jsonb(t) from (select %s from %s where %s) t))', v_metricas, v_tabla, v_where) into v_out;
    return v_out;
  end if;

  v_sql := format('select %s, %s from %s where %s group by %s', v_dims_sql, v_metricas, v_tabla, v_where, v_dims_sql);
  execute format(
    'with g as materialized (%s) select jsonb_build_object('
    || '''total_filas'', (select count(*) from g), '
    || '''filas'', (select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (select * from g order by %I %s nulls last limit %s offset %s) x), '
    || '''totales'', (select to_jsonb(t) from (select %s from %s where %s) t))',
    v_sql, v_orden, v_dir, v_lim, v_off, v_metricas, v_tabla, v_where) into v_out;
  return v_out;
end;
$$;

do $$
begin
  perform cron.unschedule('cubo-llenado-1d') where exists (select 1 from cron.job where jobname = 'cubo-llenado-1d');
  perform cron.schedule('cubo-llenado-1d', '* * * * *', $cmd$ set statement_timeout = '30min'; select public.cubo_refrescar_1d(); select cron.unschedule('cubo-llenado-1d'); $cmd$);
end $$;
