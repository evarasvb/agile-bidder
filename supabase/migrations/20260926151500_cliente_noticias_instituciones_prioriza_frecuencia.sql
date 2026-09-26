-- Hallazgo de Codex sobre la migración anterior (mismo PR): ampliar el pool de
-- candidatas a "5 veces p_max_instituciones" antes de buscar noticias seguía
-- siendo arbitrario — un cliente con muchas instituciones (Evaristo tiene 1277
-- distintas) puede tener más de ese pool sin cobertura de prensa reciente entre
-- las primeras, aunque instituciones más allá del corte sí tengan noticias.
--
-- Buscar SIN límite (todas las 1277) no es viable: cada institución dispara una
-- búsqueda de texto completo contra experto.fragmentos (25k+ filas, con índice
-- GIN, pero igual son ~1277 probes por carga de dashboard).
--
-- El problema de fondo no es el tamaño del pool sino el criterio de orden: al
-- estar roto por el empate masivo de cliente_ofertas.updated_at (mismo
-- timestamp para cientos de filas), el desempate era esencialmente el orden
-- físico de un scan, sin relación con qué institución es más relevante para el
-- cliente. Se cambia el criterio principal a cuántas veces aparece la
-- institución (postulaciones + matches) — una señal real de relevancia que
-- además rompe el empate de forma significativa en vez de arbitraria — y se
-- sube el pool a 8x como margen adicional. Sigue siendo un corte finito (no
-- hay forma barata de buscar en 1277 instituciones por carga de dashboard),
-- pero combinado con el mejor criterio de orden cubre el caso real.
create or replace function public.cliente_noticias_instituciones(p_max_instituciones integer default 5, p_por_institucion integer default 3)
returns table (
  institucion text, noticia_id bigint, fuente text, seccion text, url text, texto text, fecha timestamptz
)
language plpgsql
stable
security definer
set search_path = public, experto
as $$
declare
  v_cid uuid := public.cliente_owner_id();
begin
  if v_cid is null then
    return;
  end if;

  return query
  with instituciones as (
    select o.institucion, o.cuando
    from (
      select coalesce(l.institucion_nombre, ca.nombre_organismo) as institucion, o.updated_at as cuando
      from public.cliente_ofertas o
      left join public.licitaciones_bi l on l.codigo = o.licitacion_id
      left join public.compras_agiles ca on ca.codigo = o.licitacion_id
      where o.cliente_id = v_cid
    ) o
    where o.institucion is not null

    union all

    select m.institucion, m.cuando
    from (
      select l.institucion_nombre as institucion, l.fecha_publicacion as cuando
      from public.lic_item_matches lm join public.licitaciones_bi l on l.codigo = lm.licitacion_codigo
      where lm.cliente_id = v_cid
      union all
      select ca.nombre_organismo, ca.fecha_publicacion
      from public.ca_matches cm join public.compras_agiles ca on ca.codigo = cm.compra_agil_codigo
      where cm.cliente_id = v_cid
    ) m
    where m.institucion is not null
  ),
  candidatas as (
    select institucion, count(*) as n, max(cuando) as ultima
    from instituciones
    group by institucion
    -- Cuántas veces aparece (postulaciones + matches) es la señal real de
    -- relevancia y, a diferencia de "ultima", no viene empatada en masa.
    order by n desc, ultima desc nulls last, institucion
    limit greatest(1, least(p_max_instituciones, 10)) * 8
  ),
  noticias as (
    select c.institucion, c.n, c.ultima, f.id, f.fuente, f.seccion, f.url, f.texto, f.creado_en
    from candidatas c
    cross join lateral (
      select fr.id, fr.fuente, fr.seccion, fr.url, fr.texto, fr.creado_en
      from experto.fragmentos fr
      where fr.fuente like 'Noticia:%'
        and fr.tsv @@ websearch_to_tsquery('spanish', c.institucion)
        and fr.creado_en > now() - interval '120 days'
      order by ts_rank_cd(fr.tsv, websearch_to_tsquery('spanish', c.institucion)) desc, fr.creado_en desc
      limit greatest(1, least(p_por_institucion, 5))
    ) f
  ),
  top_instituciones as (
    select distinct institucion, n, ultima
    from noticias
    order by n desc, ultima desc nulls last, institucion
    limit greatest(1, least(p_max_instituciones, 10))
  )
  select n.institucion, n.id, n.fuente, n.seccion, n.url, n.texto, n.creado_en
  from noticias n
  join top_instituciones ti using (institucion)
  order by ti.n desc, ti.ultima desc nulls last, n.creado_en desc;
end;
$$;

revoke all on function public.cliente_noticias_instituciones(integer, integer) from public, anon;
grant execute on function public.cliente_noticias_instituciones(integer, integer) to authenticated;
