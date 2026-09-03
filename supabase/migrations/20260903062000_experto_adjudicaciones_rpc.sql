-- Quién gana licitaciones parecidas (por texto y/o por organismo), con montos y cantidad de oferentes.
create or replace function public.experto_adjudicaciones(texto text default null, p_rut text default null, meses integer default 12, cantidad integer default 8)
returns table (codigo text, titulo text, comprador text, fecha_adjudicacion date, monto_estimado numeric, monto_adjudicado numeric,
               num_oferentes integer, adjudicatario text, adjudicatario_rut text, oferentes text)
language sql stable security definer set search_path to 'public', 'extensions' as $$
  select o.codigo, o.titulo, o.comprador_nombre, o.fecha_adjudicacion::date, o.monto_estimado, o.monto_adjudicado, o.num_oferentes,
         (select string_agg(a->>'nombre', '; ') from jsonb_array_elements(o.adjudicatarios) a),
         (select public.rut_formatear(a->>'rut') from jsonb_array_elements(o.adjudicatarios) a limit 1),
         (select string_agg(f->>'nombre', '; ') from jsonb_array_elements(o.oferentes) f)
  from public.ocds_procesos o
  where o.adjudicatarios is not null
    and coalesce(o.fecha_adjudicacion, o.fecha_publicacion) >= now() - make_interval(months => meses)
    and (p_rut is null or o.comprador_rut = p_rut)
    and (texto is null or texto = '' or lower(coalesce(o.titulo,'')) % lower(texto) or lower(coalesce(o.titulo,'')) like '%' || lower(texto) || '%')
  order by (case when texto is not null and texto <> '' then similarity(lower(coalesce(o.titulo,'')), lower(texto)) else 0 end) desc,
           o.fecha_adjudicacion desc nulls last
  limit least(cantidad, 20);
$$;
grant execute on function public.experto_adjudicaciones(text, text, integer, integer) to service_role;

-- Proveedores que más le ganan a un organismo (12 meses): concentración de adjudicaciones.
create or replace function public.experto_top_adjudicatarios(p_rut text, meses integer default 12, cantidad integer default 6)
returns table (adjudicatario text, rut text, licitaciones integer, monto numeric, participaciones integer)
language sql stable security definer set search_path to 'public', 'extensions' as $$
  with adj as (
    select a->>'nombre' nombre, public.rut_formatear(a->>'rut') rut, (a->>'monto')::numeric monto, o.codigo
    from public.ocds_procesos o, jsonb_array_elements(o.adjudicatarios) a
    where o.comprador_rut = p_rut and coalesce(o.fecha_adjudicacion, o.fecha_publicacion) >= now() - make_interval(months => meses)),
  ofe as (
    select f->>'nombre' nombre, count(*) n
    from public.ocds_procesos o, jsonb_array_elements(o.oferentes) f
    where o.comprador_rut = p_rut and coalesce(o.fecha_adjudicacion, o.fecha_publicacion) >= now() - make_interval(months => meses)
    group by 1)
  select adj.nombre, max(adj.rut), count(distinct adj.codigo)::int, sum(adj.monto), max(coalesce(ofe.n, 0))::int
  from adj left join ofe on ofe.nombre = adj.nombre
  group by adj.nombre order by 3 desc, 4 desc limit least(cantidad, 20);
$$;
grant execute on function public.experto_top_adjudicatarios(text, integer, integer) to service_role;
