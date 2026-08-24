-- Se elimina la integración con Odoo (ya no existe). Se quitan las columnas de
-- credenciales/flag de `clientes`. Eran nullable y sin uso tras retirar la
-- función importar-odoo.
alter table public.clientes drop column if exists odoo_enabled;
alter table public.clientes drop column if exists odoo_url;
alter table public.clientes drop column if exists odoo_db;
alter table public.clientes drop column if exists odoo_user;
alter table public.clientes drop column if exists odoo_api_key;
