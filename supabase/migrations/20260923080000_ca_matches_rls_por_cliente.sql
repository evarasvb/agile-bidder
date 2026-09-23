-- ca_matches quedó con RLS "lectura logueados" (qual = true): cualquier cliente
-- autenticado podía leer los matches de TODOS los clientes, no solo los propios.
-- ca_item_matches y lic_item_matches ya restringen por cliente_owner_id(); ca_matches
-- se queda igual.
--
-- Esto permitió un bug real: cuando el panel de Oportunidades no lograba resolver
-- la empresa dueña del usuario (p. ej. una cuenta recién creada sin fila en
-- `clientes` todavía), el frontend caía a leer ca_matches SIN filtrar por
-- cliente_id, y mostraba el mejor score encontrado entre TODOS los clientes como
-- si fuera el match personal del usuario — un cliente veía "100% de match" en
-- productos que jamás tuvo en su inventario, porque en realidad eran matches del
-- inventario de OTRO cliente. Reportado por una clienta (Mary Carmen).
--
-- El fix del frontend (useOportunidadesPanel.ts) ya deja de mostrar matches
-- cuando no puede resolver el cliente. Esta migración cierra el mismo hueco a
-- nivel de base de datos para que ningún otro código pueda repetir el error.

drop policy if exists "ca_matches lectura logueados" on public.ca_matches;

create policy ca_matches_select_owner on public.ca_matches
  for select
  using (cliente_id = (select public.cliente_owner_id()));
