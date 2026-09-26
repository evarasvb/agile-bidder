-- Guardar la unidad de venta del producto en el inventario del cliente.
-- Antes se pedía y validaba en la carga masiva y en el alta, pero no existía la
-- columna: el dato se descartaba silenciosamente. La marca (columna `marca`) ya
-- existía desde 20260819160000 pero tampoco se escribía desde la UI.
alter table public.cliente_inventario add column if not exists unidad_medida text;
comment on column public.cliente_inventario.unidad_medida is 'Unidad de venta del producto (unidad, caja, metro, rollo, plancha, etc.).';
