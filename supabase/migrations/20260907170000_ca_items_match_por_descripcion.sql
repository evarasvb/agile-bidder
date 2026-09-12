-- Match de ítems por lo que realmente piden.
-- En compras ágiles (y licitaciones) el nombre_producto es la categoría ONU genérica
-- ("Cloruro de polivinilo (PVC)", "Sillas") y la especificación real va en la
-- descripción ("UNION AMERICANA 90 MM PVC", "SILLAS ERGONOMICAS SEGUN EETT"). El match
-- contra el inventario comparaba solo el nombre genérico, así que calzaba poco y mal.
-- nombre_norm pasa a incluir la descripción (normalizada, sin tildes, tope 400 chars).
-- Columna generada: no se puede alterar, se recrea. Sin vistas ni índices dependientes.

alter table public.compras_agiles_items drop column if exists nombre_norm;
alter table public.compras_agiles_items
  add column nombre_norm text generated always as (
    public.f_unaccent(lower(left(coalesce(nombre_producto,'') || ' ' || coalesce(descripcion_producto,''), 400)))
  ) stored;

alter table public.licitaciones_bi_items drop column if exists nombre_norm;
alter table public.licitaciones_bi_items
  add column nombre_norm text generated always as (
    public.f_unaccent(lower(left(coalesce(nombre_producto,'') || ' ' || coalesce(descripcion,''), 400)))
  ) stored;
