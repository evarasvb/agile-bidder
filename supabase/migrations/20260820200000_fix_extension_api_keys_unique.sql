-- Bug: la columna api_key guardaba el literal '[HASHED]' para TODAS las keys
-- (la key real vive hasheada en api_key_hash), pero api_key tenía UNIQUE. Por eso
-- solo la PRIMERA key del sistema se podía crear y el resto de los clientes
-- chocaba con "extension_api_keys_api_key_key" al descargar la extensión.
-- La identidad real de la key es api_key_hash: movemos ahí la unicidad.
alter table public.extension_api_keys drop constraint if exists extension_api_keys_api_key_key;
alter table public.extension_api_keys alter column api_key drop not null;
create unique index if not exists extension_api_keys_api_key_hash_key
  on public.extension_api_keys(api_key_hash);
