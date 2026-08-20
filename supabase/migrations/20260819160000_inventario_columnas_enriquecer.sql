-- Asegura las columnas que usa el enriquecedor de inventario. En la BD de
-- producción ya existen; esto es defensivo para entornos nuevos / migraciones.
alter table public.cliente_inventario add column if not exists nombre_producto text;
alter table public.cliente_inventario add column if not exists marca text;
alter table public.cliente_inventario add column if not exists palabras_clave text[];
alter table public.cliente_inventario add column if not exists imagen_url text;
