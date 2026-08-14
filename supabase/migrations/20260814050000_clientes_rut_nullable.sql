-- Al auto-crear la ficha de un usuario nuevo (antes del onboarding) todavía no
-- hay RUT. `rut` era NOT NULL sin default, así que la inserción mínima fallaba y
-- el cliente quedaba sin ficha (onboarding en spinner). Se hace nullable; el RUT
-- se captura después (facturación/Odoo). Los NULL no chocan en constraints únicos.
alter table public.clientes alter column rut drop not null;
