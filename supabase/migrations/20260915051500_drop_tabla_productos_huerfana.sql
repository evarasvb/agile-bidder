-- La tabla productos no la usa ninguna pantalla (los hooks useProductos.ts y
-- useProductosCatalogo.ts que la consultaban ya se eliminaron por ser código
-- muerto). Se verificó que sus 16.268 filas ya existen todas en
-- cliente_inventario (coinciden por sku o por descripcion), así que no hay
-- datos que perder al borrarla.
drop table if exists public.productos;
