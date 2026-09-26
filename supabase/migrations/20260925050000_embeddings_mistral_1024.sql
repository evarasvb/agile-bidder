-- Cambio de proveedor de vectores: Gemini (gemini-embedding-001, 768 d, cuota gratis de
-- ~1.000 textos/día, insuficiente para ~4.000 ítems nuevos/día) -> Mistral (mistral-embed,
-- 1024 d, plan Experiment gratis: 1 req/s, 1.000 M tokens/mes). Todos los vectores deben
-- ser del mismo modelo, así que se anulan los ~950 de Gemini y se recalibra match_sim_v3
-- cuando haya muestra (los cosenos de cada modelo viven en rangos distintos).

-- 1) Columnas a 1024 dims (hay que soltar el índice HNSW para cambiar el tipo).
drop index if exists public.idx_cliente_inventario_embedding;
alter table public.cliente_inventario    alter column embedding type extensions.vector(1024) using null;
alter table public.compras_agiles_items  alter column embedding type extensions.vector(1024) using null;
alter table public.licitaciones_bi_items alter column embedding type extensions.vector(1024) using null;
create index idx_cliente_inventario_embedding on public.cliente_inventario
  using hnsw (embedding extensions.vector_cosine_ops);

-- 2) Buscador global: misma firma pero 1024.
drop function if exists public.buscar_inventario_semantico(extensions.vector, integer);
create or replace function public.buscar_inventario_semantico(p_embedding extensions.vector(1024), p_limite integer default 5)
returns table (id uuid, nombre_producto text, sku text, similitud real)
language sql stable security invoker set search_path to 'public'
as $$
  select i.id, i.nombre_producto, i.sku, (1 - (i.embedding operator(extensions.<=>) p_embedding))::real as similitud
  from public.cliente_inventario i
  where i.embedding is not null
  order by i.embedding operator(extensions.<=>) p_embedding
  limit greatest(1, least(coalesce(p_limite, 5), 20));
$$;
revoke execute on function public.buscar_inventario_semantico(extensions.vector, integer) from public, anon;
grant execute on function public.buscar_inventario_semantico(extensions.vector, integer) to authenticated;

-- 3) Guardado por lote (una RPC por 100 filas en vez de 100 UPDATEs). Security invoker:
--    con service_role escribe todo; como usuario, la RLS de cliente_inventario manda.
create or replace function public.guardar_embeddings(p_tabla text, p_filas jsonb)
returns integer
language plpgsql security invoker set search_path to 'public'
as $$
declare n integer;
begin
  if p_tabla = 'cliente_inventario' then
    update public.cliente_inventario t set embedding = (f.emb)::extensions.vector(1024)
    from (select (x->>'id')::uuid id, x->>'embedding' emb from jsonb_array_elements(p_filas) x) f
    where t.id = f.id and t.embedding is null;
  elsif p_tabla = 'compras_agiles_items' then
    update public.compras_agiles_items t set embedding = (f.emb)::extensions.vector(1024)
    from (select (x->>'id')::uuid id, x->>'embedding' emb from jsonb_array_elements(p_filas) x) f
    where t.id = f.id and t.embedding is null;
  elsif p_tabla = 'licitaciones_bi_items' then
    update public.licitaciones_bi_items t set embedding = (f.emb)::extensions.vector(1024)
    from (select (x->>'id')::uuid id, x->>'embedding' emb from jsonb_array_elements(p_filas) x) f
    where t.id = f.id and t.embedding is null;
  else
    raise exception 'tabla no permitida: %', p_tabla;
  end if;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.guardar_embeddings(text, jsonb) from public, anon;
grant execute on function public.guardar_embeddings(text, jsonb) to authenticated, service_role;
