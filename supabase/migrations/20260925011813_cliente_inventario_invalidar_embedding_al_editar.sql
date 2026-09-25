-- Si se edita nombre/categoría/marca/descripción de un producto sin volver a
-- generar su embedding en la misma sentencia, invalida el vector viejo (en
-- vez de dejarlo indexando texto que ya no es el del producto). El worker de
-- embeddings-inventario SÍ setea embedding en el mismo update, así que no
-- entra en este caso (new.embedding queda distinto de old.embedding).
create or replace function public.cliente_inventario_invalidar_embedding()
returns trigger
language plpgsql
as $function$
begin
  if (
    new.nombre_producto is distinct from old.nombre_producto
    or new.categoria is distinct from old.categoria
    or new.marca is distinct from old.marca
    or new.descripcion is distinct from old.descripcion
  ) and new.embedding is not distinct from old.embedding then
    new.embedding := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_cliente_inventario_invalidar_embedding on public.cliente_inventario;
create trigger trg_cliente_inventario_invalidar_embedding
before update on public.cliente_inventario
for each row execute function public.cliente_inventario_invalidar_embedding();
