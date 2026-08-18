-- =====================================================================
-- Inteligencia de mercado: match ↔ órdenes de compra ↔ reportes
-- =====================================================================
-- En la ficha de una oportunidad cruzamos sus ítems contra las órdenes de compra
-- reales para responder: ¿a qué precio se compró esto?, ¿quién gana estas OC
-- (competidores)? y ¿quién compra esto (demanda)?

-- Nombre normalizado (minúsculas sin acento) de los ítems de OC + índices trgm.
alter table public.ordenes_compra_items
  add column if not exists producto_norm text generated always as (public.f_unaccent(lower(producto))) stored;
create index if not exists idx_oci_producto_norm_gist on public.ordenes_compra_items using gist (producto_norm gist_trgm_ops);
create index if not exists idx_oci_producto_norm_gin  on public.ordenes_compra_items using gin  (producto_norm gin_trgm_ops);
create index if not exists idx_oci_numero_oc on public.ordenes_compra_items (numero_oc);
create index if not exists idx_oci_codigo_producto on public.ordenes_compra_items (codigo_producto);

-- Devuelve las líneas de OC que calzan con los ítems de la oportunidad (por código
-- ONU/UNSPSC exacto o similitud de nombre), con proveedor/organismo/precio/fecha.
-- Rendimiento: por cada ítem de la oportunidad se toman los 40 más parecidos vía
-- KNN (<->>) sobre el índice GiST. Umbral de word_similarity 0.3 (local).
create or replace function public.inteligencia_oc_oportunidad(
  p_codigo text, p_tipo text, p_limit int default 60)
returns table(
  oc_codigo text, organismo text, proveedor text, rut_proveedor text,
  producto text, precio_unitario numeric, cantidad numeric, valor_total numeric,
  fecha timestamptz, score real
)
language plpgsql stable security definer
set search_path = public
as $function$
#variable_conflict use_column
begin
  perform set_config('pg_trgm.word_similarity_threshold', '0.3', true);
  return query
  with textos as (
    select distinct txt, cod from (
      select i.nombre_norm as txt, i.codigo_producto as cod
      from public.compras_agiles ca
      join public.compras_agiles_items i on i.compra_agil_id = ca.id
      where p_tipo = 'compra_agil' and ca.codigo = p_codigo and i.nombre_norm is not null
      union all
      select i.nombre_norm as txt, i.codigo_producto as cod
      from public.licitaciones_bi l
      join public.licitaciones_bi_items i on i.licitacion_id = l.id
      where p_tipo = 'licitacion' and l.codigo = p_codigo and i.nombre_norm is not null
    ) t
    where length(txt) >= 3
    limit 25
  ),
  matches as (
    select m.noc, m.prod, m.pu, m.cant, m.vt, m.sc
    from textos te
    cross join lateral (
      select oi.numero_oc as noc, oi.producto as prod, oi.precio_unitario as pu,
             oi.cantidad as cant, oi.valor_total as vt,
             greatest(
               case when te.cod is not null and oi.codigo_producto is not null
                         and oi.codigo_producto = te.cod then 1.0::real else 0::real end,
               coalesce(word_similarity(oi.producto_norm, te.txt), 0::real)
             ) as sc
      from public.ordenes_compra_items oi
      where oi.producto_norm %> te.txt or (te.cod is not null and oi.codigo_producto = te.cod)
      order by oi.producto_norm <->> te.txt
      limit 40
    ) m
  ),
  best as (
    select distinct on (noc, prod) noc, prod, pu, cant, vt, sc
    from matches
    order by noc, prod, sc desc
  )
  select o.codigo, o.organismo_comprador, o.proveedor_nombre, o.rut_proveedor,
         b.prod, b.pu, b.cant, b.vt, o.fecha_emision, b.sc
  from best b
  join public.ordenes_compra o on o.numero_oc = b.noc
  where b.sc >= 0.3
  order by b.sc desc, o.fecha_emision desc nulls last
  limit greatest(1, least(p_limit, 100));
end $function$;

grant execute on function public.inteligencia_oc_oportunidad(text, text, int) to anon, authenticated;
