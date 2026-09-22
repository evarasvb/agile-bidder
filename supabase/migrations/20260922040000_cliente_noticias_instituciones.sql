-- Recuadro "Noticias de tus instituciones" en el Dashboard: reutiliza la base
-- de noticias que ya alimenta al Experto (experto.fragmentos, fuente 'Noticia:%',
-- actualizada cada 6h por sync-noticias-cron) pero expone una versión acotada
-- y segura para que el propio cliente la consulte (la RPC de servicio
-- experto_noticias sigue restringida a service_role).
--
-- Prioriza instituciones donde el cliente ya postuló (cliente_ofertas) y
-- completa con instituciones de sus matches activos si hacen falta más.
--
-- Nota: licitaciones_bi usa `institucion_nombre` (no `nombre_organismo`, que
-- es de compras_agiles y de la tabla legacy `licitaciones`).
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
      select l.nombre_organismo as institucion, l.fecha_publicacion as cuando
      from public.lic_item_matches lm join public.licitaciones l on l.codigo = lm.licitacion_codigo
      where lm.cliente_id = v_cid
      union all
      select ca.nombre_organismo, ca.fecha_publicacion
      from public.ca_matches cm join public.compras_agiles ca on ca.codigo = cm.compra_agil_codigo
      where cm.cliente_id = v_cid
    ) m
    where m.institucion is not null
  ),
  top_instituciones as (
    select institucion, max(cuando) as ultima
    from instituciones
    group by institucion
    order by ultima desc nulls last
    limit greatest(1, least(p_max_instituciones, 10))
  )
  select ti.institucion, f.id, f.fuente, f.seccion, f.url, f.texto, f.creado_en
  from top_instituciones ti
  cross join lateral (
    select fr.id, fr.fuente, fr.seccion, fr.url, fr.texto, fr.creado_en
    from experto.fragmentos fr
    where fr.fuente like 'Noticia:%'
      and fr.tsv @@ websearch_to_tsquery('spanish', ti.institucion)
      and fr.creado_en > now() - interval '120 days'
    order by ts_rank_cd(fr.tsv, websearch_to_tsquery('spanish', ti.institucion)) desc, fr.creado_en desc
    limit greatest(1, least(p_por_institucion, 5))
  ) f;
end;
$$;

revoke all on function public.cliente_noticias_instituciones(integer, integer) from public, anon;
grant execute on function public.cliente_noticias_instituciones(integer, integer) to authenticated;
