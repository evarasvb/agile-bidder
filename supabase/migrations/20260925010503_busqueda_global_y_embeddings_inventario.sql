-- 1) Buscador global (Cmd+K): oportunidades (licitaciones + compras ágiles)
-- para usuarios autenticados, con el tipo para poder rutear al detalle
-- correcto. Mismo motor de palabras que el teaser público
-- (buscar_teaser_licitaciones), pero separado porque ese es anónimo/acotado
-- y este es para el buscador interno de la app.
create or replace function public.busqueda_global_oportunidades(p_termino text, p_limite integer default 6)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with palabras as (
    select distinct lower(unaccent(w)) as palabra
    from regexp_split_to_table(btrim(p_termino), '\s+') as w
    where btrim(w) <> ''
  ),
  base as (
    select 'licitacion'::text as tipo, l.codigo, l.nombre, l.institucion_nombre as institucion, l.fecha_cierre
    from public.licitaciones_bi l
    where l.estado = 'Publicada' and l.codigo_estado = 5 and l.fecha_cierre > now()
      and exists (select 1 from palabras)
      and not exists (
        select 1 from palabras p
        where not (
          lower(unaccent(l.nombre)) like '%' || p.palabra || '%'
          or lower(unaccent(coalesce(l.descripcion, ''))) like '%' || p.palabra || '%'
        )
      )
    union all
    select 'compra_agil'::text, c.codigo, c.nombre, c.nombre_organismo, c.fecha_cierre
    from public.compras_agiles c
    where c.fecha_cierre > now()
      and exists (select 1 from palabras)
      and not exists (
        select 1 from palabras p
        where not (
          lower(unaccent(c.nombre)) like '%' || p.palabra || '%'
          or lower(unaccent(coalesce(c.descripcion, ''))) like '%' || p.palabra || '%'
        )
      )
  )
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select * from base order by fecha_cierre asc limit greatest(1, least(coalesce(p_limite, 6), 12))
  ) t;
$function$;

revoke execute on function public.busqueda_global_oportunidades(text, integer) from public, anon;
grant execute on function public.busqueda_global_oportunidades(text, integer) to authenticated, service_role;

-- 2) Búsqueda semántica del inventario (pgvector, ya instalado y sin costo de
-- plan). Complementa la búsqueda por texto: encuentra productos aunque el
-- cliente escriba distinto a como nombró su producto ("insumos de aseo" ->
-- "detergente industrial"). Los embeddings se generan bajo demanda desde la
-- edge function embeddings-inventario (Gemini, ya integrado y pagado en el
-- resto de la app) — esta migración solo deja la columna, el índice y la
-- función de búsqueda.
alter table public.cliente_inventario add column if not exists embedding extensions.vector(768);
create index if not exists idx_cliente_inventario_embedding on public.cliente_inventario
  using hnsw (embedding extensions.vector_cosine_ops);

-- security invoker (por defecto): corre con los permisos de quien llama, así
-- que la RLS normal de cliente_inventario (dueño o miembro de equipo) aplica
-- sola, sin tener que reimplementar el filtro acá.
create or replace function public.buscar_inventario_semantico(p_embedding extensions.vector(768), p_limite integer default 5)
returns table (id uuid, nombre_producto text, sku text, similitud real)
language sql
stable
set search_path to 'public, extensions'
as $function$
  select i.id, i.nombre_producto, i.sku, (1 - (i.embedding OPERATOR(extensions.<=>) p_embedding))::real as similitud
  from public.cliente_inventario i
  where i.embedding is not null
  order by i.embedding OPERATOR(extensions.<=>) p_embedding
  limit greatest(1, least(coalesce(p_limite, 5), 20));
$function$;

revoke execute on function public.buscar_inventario_semantico(extensions.vector, integer) from public, anon;
grant execute on function public.buscar_inventario_semantico(extensions.vector, integer) to authenticated;
