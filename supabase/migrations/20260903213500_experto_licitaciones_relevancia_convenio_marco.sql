-- Búsqueda de licitaciones del Experto: ordena por relevancia (título > descripción > ítems) y no por
-- fecha de cierre, para que el ruido no desplace a la licitación buscada; ventana de publicación de
-- 180 días cuando se piden abiertas (las grandes se publican meses antes); "convenio marco" incluye
-- todo lo que licita la Dirección ChileCompra (código 2239-), aunque el título no lo diga.
create or replace function public.experto_licitaciones(texto text, dias integer default 60, solo_abiertas boolean default true, p_region text default null, cantidad integer default 10)
returns table(codigo text, nombre text, institucion text, region text, estado text, tipo text, presupuesto numeric, moneda text, publicada date, cierra timestamptz, url text, coincidencia text)
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  q tsquery;
  ventana int := case when solo_abiertas then greatest(dias, 180) else dias end;
  es_cm boolean := texto ilike '%convenio%marco%' or texto ilike '%convenios%marco%';
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
    q := websearch_to_tsquery('spanish', texto);
    return query select s.codigo, s.nombre, s.institucion, s.region, s.estado, s.tipo, s.presupuesto, s.moneda, s.publicada, s.cierra, s.url, s.coincidencia from (
      select l.codigo, l.nombre, l.institucion_nombre as institucion, l.unidad_compra_region as region, l.estado, l.tipo,
             l.presupuesto_estimado as presupuesto, l.moneda, l.fecha_publicacion::date as publicada, l.fecha_cierre as cierra,
             'https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=' || l.codigo as url,
             case when es_cm and l.codigo like '2239-%' then 'Convenio Marco: lo licita la Dirección ChileCompra'
                  else (select left(coalesce(i.nombre_producto, '') || case when i.descripcion is not null then ': ' || i.descripcion else '' end, 160)
                          from public.licitaciones_bi_items i
                          where i.licitacion_id = l.id
                            and to_tsvector('spanish', coalesce(i.nombre_producto,'')||' '||coalesce(i.descripcion,'')) @@ q
                          limit 1) end as coincidencia,
             (case when es_cm and l.codigo like '2239-%' then 10 else 0 end)
               + 4 * ts_rank(to_tsvector('spanish', coalesce(l.nombre,'')), q)
               + ts_rank(to_tsvector('spanish', coalesce(l.descripcion,'')), q) as relevancia
      from public.licitaciones_bi l
      where ((es_cm and l.codigo like '2239-%')
             or to_tsvector('spanish', coalesce(l.nombre,'')||' '||coalesce(l.descripcion,'')) @@ q
             or exists (select 1 from public.licitaciones_bi_items i
                        where i.licitacion_id = l.id
                          and to_tsvector('spanish', coalesce(i.nombre_producto,'')||' '||coalesce(i.descripcion,'')) @@ q))
        and l.fecha_publicacion >= now() - make_interval(days => ventana)
        and (not solo_abiertas or l.fecha_cierre > now())
        and (p_region is null or l.unidad_compra_region ilike '%'||p_region||'%')
      order by relevancia desc, l.fecha_cierre nulls last) s limit least(cantidad, 30);
  end if;
end $function$;
