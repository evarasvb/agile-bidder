-- Credenciales opcionales de Odoo por cliente, para importar fotos de producto
-- por SKU (default_code) via la API JSON-RPC de Odoo. odoo_url ya existe.
alter table public.clientes add column if not exists odoo_db text;
alter table public.clientes add column if not exists odoo_user text;
alter table public.clientes add column if not exists odoo_api_key text;
