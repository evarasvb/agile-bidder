-- Pedido de Evaristo sobre Cobranza de facturas: al elegir una OC del
-- desplegable de "mis OC aceptadas" (ya existe, trae organismo/RUT/monto/
-- fecha reales de Mercado Público), esa fecha pisaba la "Fecha emisión" de
-- la FACTURA (que él anota a mano), así que nunca veía la fecha de la OC ni
-- la de la factura por separado. Se agrega una columna propia para la fecha
-- de la OC, y de paso el campo de nombre de contacto que también pidió.
alter table public.facturas_por_cobrar add column if not exists oc_fecha date;
alter table public.facturas_por_cobrar add column if not exists nombre_contacto text;
