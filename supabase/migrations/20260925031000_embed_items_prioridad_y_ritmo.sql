-- La API key de Gemini está en plan gratis (~100 textos/min): se prioriza lo que
-- da valor antes (ítems de compras ágiles abiertas, que cierran en días), después
-- el inventario y al final los ítems de licitaciones. El cron pasa a cada 2 min.
create or replace function public.items_pendientes_embedding(p_limite integer default 200)
returns table (tabla text, id uuid, texto text)
language sql stable security definer set search_path to 'public'
as $$
  (select 'compras_agiles_items'::text, i.id, public.item_texto_embedding(i.descripcion_producto, i.nombre_producto)
   from public.compras_agiles_items i
   join public.compras_agiles c on c.id = i.compra_agil_id
   where i.embedding is null and c.fecha_cierre > now() and c.estado ilike 'publicada'
   order by c.fecha_cierre asc
   limit p_limite)
  union all
  (select 'cliente_inventario', ci.id,
          left(concat_ws(' ', ci.nombre_producto, ci.categoria, ci.marca, ci.descripcion), 500)
   from public.cliente_inventario ci
   where ci.embedding is null
   order by ci.updated_at desc nulls last
   limit p_limite)
  union all
  (select 'licitaciones_bi_items', i.id, public.item_texto_embedding(i.descripcion, i.nombre_producto)
   from public.licitaciones_bi_items i
   join public.licitaciones_bi l on l.id = i.licitacion_id
   where i.embedding is null and l.fecha_cierre > now()
     and (l.estado is null or l.estado ilike 'publicada' or l.estado ilike 'activa')
   order by l.fecha_cierre asc
   limit p_limite);
$$;

do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'embed-items-cron';
  if v_jobid is not null then
    perform cron.alter_job(v_jobid, schedule := '*/2 * * * *');
  end if;
end $$;
