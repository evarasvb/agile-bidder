-- Inventario: acceso unificado por la empresa DUEÑA (cliente_owner_id), con
-- respaldo a auth.uid() para no perder las filas históricas del admin.
-- Antes: SELECT usaba cliente_id = auth.uid() mientras INSERT/UPDATE exigían
-- clientes.id → para un usuario real (clientes.id != user_id) el inventario
-- quedaba invisible y los inserts se rechazaban. Además unifica el caso de
-- miembros de equipo (comparten el inventario de la empresa que los invitó).
drop policy if exists "Enable users to view their own data only" on public.cliente_inventario;
create policy "inv_select_owner" on public.cliente_inventario for select
  using (cliente_id = public.cliente_owner_id() or cliente_id = auth.uid());

drop policy if exists "Users can insert own cliente inventory" on public.cliente_inventario;
create policy "inv_insert_owner" on public.cliente_inventario for insert
  with check (cliente_id = public.cliente_owner_id() or cliente_id = auth.uid());

drop policy if exists "Users can update own cliente inventory" on public.cliente_inventario;
create policy "inv_update_owner" on public.cliente_inventario for update
  using (cliente_id = public.cliente_owner_id() or cliente_id = auth.uid())
  with check (cliente_id = public.cliente_owner_id() or cliente_id = auth.uid());

drop policy if exists "Users can delete own cliente inventory" on public.cliente_inventario;
create policy "inv_delete_owner" on public.cliente_inventario for delete
  using (cliente_id = public.cliente_owner_id() or cliente_id = auth.uid());

-- Red de seguridad: nombre_producto NOT NULL sin default rompía los inserts que
-- solo setean `nombre`. El frontend ahora sí lo setea; el default evita errores
-- duros en cualquier otra vía de inserción.
alter table public.cliente_inventario alter column nombre_producto set default '';
