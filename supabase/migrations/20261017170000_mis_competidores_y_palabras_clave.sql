-- Corrección pedida por Evaristo: el estudio/auditoría de la competencia NO
-- debe usar el inventario (ese motor es solo para preparar/ejecutar una
-- postulación puntual) — debe basarse en el RUT real del cliente (con quién
-- compitió de verdad, visto en ocds_procesos) y en palabras clave de sus
-- propias licitaciones, reusando la misma infraestructura de búsqueda de
-- texto que ya usa buscar_oportunidades (tsv_oportunidad/tsq_oportunidad).

-- "¿Quiénes son mis competidores?": sin buscar nombre a mano — mira todas
-- las licitaciones donde el RUT del cliente ya apareció como oferente (su
-- historial real) y cuenta qué otros proveedores aparecieron ahí mismo, con
-- cuántas veces ganó cada uno. Es la versión agregada de proveedor_head_to_head.
create or replace function public.mis_principales_competidores(p_limite integer default 12, p_meses integer default 24)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with cli as (
    select public.rut_limpio(c.rut) as rut_cliente
    from public.clientes c where c.user_id = auth.uid() limit 1
  ),
  procesos_cliente as (
    select o.codigo, o.oferentes, o.adjudicatarios
    from public.ocds_procesos o, cli
    where cli.rut_cliente is not null
      and o.oferentes @> jsonb_build_array(jsonb_build_object('rut', cli.rut_cliente))
      and (p_meses is null or coalesce(o.fecha_adjudicacion, o.fecha_publicacion) >= now() - make_interval(months => p_meses))
  ),
  total as (
    select count(*)::int as n,
           count(*) filter (
             where exists(select 1 from jsonb_array_elements(coalesce(adjudicatarios, '[]'::jsonb)) a, cli where rut_norm(a->>'rut') = cli.rut_cliente)
           )::int as ganamos
    from procesos_cliente
  ),
  otros as (
    select rut_norm(e->>'rut') as rut_otro, e->>'nombre' as nombre_otro, pc.codigo,
      exists(select 1 from jsonb_array_elements(coalesce(pc.adjudicatarios, '[]'::jsonb)) a where rut_norm(a->>'rut') = rut_norm(e->>'rut')) as gano_el
    from procesos_cliente pc, cli, jsonb_array_elements(pc.oferentes) e
    where rut_norm(e->>'rut') <> cli.rut_cliente
  ),
  agregado as (
    select rut_otro, max(nombre_otro) as nombre, count(distinct codigo)::int as coincidencias,
           count(distinct codigo) filter (where gano_el)::int as veces_gano
    from otros group by rut_otro
  )
  select jsonb_build_object(
    'total_procesos_propios', (select n from total),
    'veces_ganamos', (select ganamos from total),
    'competidores', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.coincidencias desc, x.veces_gano desc)
      from (select * from agregado order by coincidencias desc, veces_gano desc limit greatest(p_limite, 1)) x
    ), '[]'::jsonb)
  )
$function$;

grant execute on function public.mis_principales_competidores(integer, integer) to authenticated;

-- Reemplaza la versión anterior de oportunidades_perdidas_ante (que usaba
-- lic_item_matches, el motor de inventario) por una basada en palabras clave:
-- saca las palabras más frecuentes de los TÍTULOS de las licitaciones donde
-- el cliente ya participó (su rubro real, por RUT) con ts_stat() sobre
-- tsv_oportunidad (misma función que ya usa buscar_oportunidades), arma un
-- tsquery "o" con ellas, y busca licitaciones que el cliente NO tomó y que
-- este competidor sí se adjudicó.
create or replace function public.oportunidades_perdidas_ante(p_rut_competidor text, p_limite integer default 15, p_num_palabras integer default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_rut_cliente text;
  v_rut_competidor text := rut_norm(p_rut_competidor);
  v_query tsquery;
  v_result jsonb;
begin
  select public.rut_limpio(c.rut) into v_rut_cliente
  from public.clientes c where c.user_id = auth.uid() limit 1;

  if v_rut_cliente is null or v_rut_competidor is null then
    return '[]'::jsonb;
  end if;

  execute format(
    $q$
    select to_tsquery('simple', string_agg(word, ' | '))
    from (
      select word, nentry from ts_stat(
        $s$select public.tsv_oportunidad(l.nombre, null) from public.licitaciones_bi l
           join public.ocds_procesos o on o.codigo = l.codigo
           where o.oferentes @> jsonb_build_array(jsonb_build_object('rut', %L))$s$
      )
      where length(word) >= 3
        -- 'simple' no saca stopwords solo; mismo set que ya usa tsq_oportunidad.
        and word not in ('de','del','la','el','lo','los','las','y','o','u','en','para','con','sin','un','una','unos','unas','por','al','a','e','se','su','sus')
      order by nentry desc
      limit %s
    ) x
    $q$, v_rut_cliente, greatest(p_num_palabras, 1)
  ) into v_query;

  if v_query is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(to_jsonb(cand)), '[]'::jsonb) into v_result
  from (
    select l.codigo, l.nombre,
           coalesce(l.institucion_nombre, o.comprador_nombre) as institucion,
           l.institucion_rut as rut_institucion,
           l.fecha_publicacion, l.fecha_cierre, l.presupuesto_estimado as monto_estimado,
           (select (a->>'monto')::numeric from jsonb_array_elements(coalesce(o.adjudicatarios, '[]'::jsonb)) a
            where rut_norm(a->>'rut') = v_rut_competidor limit 1) as monto_competidor
    from public.licitaciones_bi l
    join public.ocds_procesos o on o.codigo = l.codigo
    where public.tsv_oportunidad(l.nombre, l.descripcion) @@ v_query
      and o.adjudicatarios @> jsonb_build_array(jsonb_build_object('rut', v_rut_competidor))
      and not exists (
        select 1 from public.ocds_procesos o2
        where o2.codigo = l.codigo and o2.oferentes @> jsonb_build_array(jsonb_build_object('rut', v_rut_cliente))
      )
    order by coalesce(l.fecha_cierre, l.fecha_publicacion) desc nulls last
    limit greatest(p_limite, 1)
  ) cand;

  return v_result;
end;
$function$;

grant execute on function public.oportunidades_perdidas_ante(text, integer, integer) to authenticated;
