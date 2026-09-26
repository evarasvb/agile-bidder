-- Dos bugs reales en "Noticias de tus instituciones" (Dashboard), reportados
-- por Evaristo: la tarjeta sale vacía aunque siga instituciones con match.
--
-- 1) El branch de matches de licitaciones unía lic_item_matches.licitacion_codigo
--    contra public.licitaciones (tabla LEGACY, sin escrituras hace tiempo) en vez
--    de public.licitaciones_bi (la que realmente puebla licitacion_codigo, ver
--    generar_matches_lic_items_cliente). Confirmado en producción: de 3383 filas
--    de lic_item_matches, el join contra licitaciones legacy no calzaba NINGUNA
--    (0 hits) — el branch de "tienes match" nunca aportaba una institución.
--
-- 2) Aun arreglando el join: cliente_ofertas.updated_at viene con el mismo
--    timestamp exacto para cientos de filas (backfill masivo), así que
--    "order by ultima desc limit 5" antes de buscar noticias quedaba a merced
--    del orden físico de un empate gigante — podía quedarse con 5 instituciones
--    sin cobertura de prensa reciente y mostrar la tarjeta vacía aunque el
--    cliente siga a decenas de otras que sí tienen noticias. Se amplía el pool
--    de candidatas antes de buscar noticias y solo se devuelven, hasta el
--    máximo pedido, las que realmente encontraron algo.
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
    select institucion, max(cuando) as ultima
    from instituciones
    group by institucion
    order by ultima desc nulls last, institucion
    limit greatest(1, least(p_max_instituciones, 10)) * 5
  ),
  noticias as (
    select c.institucion, c.ultima, f.id, f.fuente, f.seccion, f.url, f.texto, f.creado_en
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
    select distinct institucion, ultima
    from noticias
    order by ultima desc nulls last, institucion
    limit greatest(1, least(p_max_instituciones, 10))
  )
  select n.institucion, n.id, n.fuente, n.seccion, n.url, n.texto, n.creado_en
  from noticias n
  join top_instituciones ti using (institucion)
  order by ti.ultima desc nulls last, n.creado_en desc;
end;
$$;

revoke all on function public.cliente_noticias_instituciones(integer, integer) from public, anon;
grant execute on function public.cliente_noticias_instituciones(integer, integer) to authenticated;
