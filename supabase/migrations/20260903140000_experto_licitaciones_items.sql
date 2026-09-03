-- experto_licitaciones busca también en los ítems de la licitación (ej. "google" está en
-- "Google Workspace" dentro de los productos) y devuelve el ítem que coincide.
-- Aplicado en prod como experto_licitaciones_busca_en_items + experto_licitaciones_coincidencia.
drop function if exists public.experto_licitaciones(text, integer, boolean, text, integer);
create or replace function public.experto_licitaciones(texto text, dias integer default 60, solo_abiertas boolean default true, p_region text default null, cantidad integer default 10)
returns table (codigo text, nombre text, institucion text, region text, estado text, tipo text, presupuesto numeric, moneda text, publicada date, cierra timestamptz, url text, coincidencia text)
language plpgsql stable security definer set search_path = public as $function$
begin
  if texto is null or btrim(texto) = '' then
    return query select * from (
      select l.codigo, l.nombre, l.institucion_nombre, l.unidad_compra_region, l.estado, l.tipo,
             l.presupuesto_estimado, l.moneda, l.fecha_publicacion::date, l.fecha_cierre,
             'https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=' || l.codigo, null::text
      from public.licitaciones_bi l
      where l.fecha_publicacion >= now() - make_interval(days => dias)
        and (not solo_abiertas or l.fecha_cierre > now())
        and (p_region is null or l.unidad_compra_region ilike '%'||p_region||'%')
      order by l.fecha_cierre nulls last) s limit least(cantidad, 30);
  else
    return query select * from (
      select l.codigo, l.nombre, l.institucion_nombre, l.unidad_compra_region, l.estado, l.tipo,
             l.presupuesto_estimado, l.moneda, l.fecha_publicacion::date, l.fecha_cierre,
             'https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=' || l.codigo,
             (select left(coalesce(i.nombre_producto, '') || case when i.descripcion is not null then ': ' || i.descripcion else '' end, 160)
                from public.licitaciones_bi_items i
                where i.licitacion_id = l.id
                  and to_tsvector('spanish', coalesce(i.nombre_producto,'')||' '||coalesce(i.descripcion,'')) @@ websearch_to_tsquery('spanish', texto)
                limit 1)
      from public.licitaciones_bi l
      where (to_tsvector('spanish', coalesce(l.nombre,'')||' '||coalesce(l.descripcion,'')) @@ websearch_to_tsquery('spanish', texto)
             or exists (select 1 from public.licitaciones_bi_items i
                        where i.licitacion_id = l.id
                          and to_tsvector('spanish', coalesce(i.nombre_producto,'')||' '||coalesce(i.descripcion,'')) @@ websearch_to_tsquery('spanish', texto)))
        and l.fecha_publicacion >= now() - make_interval(days => dias)
        and (not solo_abiertas or l.fecha_cierre > now())
        and (p_region is null or l.unidad_compra_region ilike '%'||p_region||'%')
      order by l.fecha_cierre nulls last) s limit least(cantidad, 30);
  end if;
end $function$;
grant execute on function public.experto_licitaciones(text, integer, boolean, text, integer) to anon, authenticated, service_role;
