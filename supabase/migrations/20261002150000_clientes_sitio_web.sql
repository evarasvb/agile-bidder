-- Ficha de empresa desde el sitio web (complemento del RUT): se guarda la URL que
-- el cliente usó para que FirmaVB lea qué vende y arme su descripción y palabras clave.
alter table public.clientes add column if not exists sitio_web text;
comment on column public.clientes.sitio_web is 'Sitio web de la empresa, usado para completar la ficha automáticamente.';
