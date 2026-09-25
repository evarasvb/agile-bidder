-- guardar_embeddings fallaba con "operator does not exist: extensions.vector = extensions.vector":
-- el trigger items_invalidar_embedding compara new.embedding con old.embedding (IS NOT DISTINCT
-- FROM usa el operador =, que vive en el esquema extensions) y heredaba el search_path 'public'
-- de la RPC. Se agrega extensions al search_path de ambas.
alter function public.guardar_embeddings(text, jsonb) set search_path to 'public', 'extensions';
alter function public.items_invalidar_embedding() set search_path to 'public', 'extensions';
alter function public.cliente_inventario_invalidar_embedding() set search_path to 'public', 'extensions';
