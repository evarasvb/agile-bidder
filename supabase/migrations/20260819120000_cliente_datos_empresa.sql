-- Datos de empresa para los PDF (ficha técnica / cotización): logo y dirección.
-- El resto (empresa_nombre, rut, telefono, email, region) ya existe en clientes.
alter table public.clientes add column if not exists logo_url text;
alter table public.clientes add column if not exists direccion text;
