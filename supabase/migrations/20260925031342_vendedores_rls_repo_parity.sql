-- Documenta en el repo el estado real de las políticas de `vendedores`.
-- Codex citó la política original y amplia "Authenticated users can update
-- vendedores" (FOR UPDATE USING (auth.uid() IS NOT NULL) — cualquier
-- autenticado podía tocar cualquier fila) de la migración
-- 20260113202457_9ff35a76-30c0-4f68-a1fc-c24cc9a5b7de.sql. Esa política YA
-- NO existe en la base viva: en algún momento se reemplazó por las
-- políticas *_owner (scoped a cliente_owner_id()/auth.uid()), pero esa
-- migración nunca quedó como archivo en el repo — el código fuente no
-- reflejaba la realidad. Esta migración es idempotente y deja explícito el
-- estado correcto (las 4 políticas *_owner + service_role_all), sin cambiar
-- el comportamiento actual.
drop policy if exists "Authenticated users can view vendedores" on public.vendedores;
drop policy if exists "Authenticated users can insert vendedores" on public.vendedores;
drop policy if exists "Authenticated users can update vendedores" on public.vendedores;
drop policy if exists "Authenticated users can delete vendedores" on public.vendedores;

drop policy if exists "vendedores_select_owner" on public.vendedores;
create policy "vendedores_select_owner" on public.vendedores
  for select using (
    user_id = public.cliente_owner_id() or user_id = auth.uid()
  );

drop policy if exists "vendedores_insert_owner" on public.vendedores;
create policy "vendedores_insert_owner" on public.vendedores
  for insert with check (
    user_id = public.cliente_owner_id() or user_id = auth.uid()
  );

drop policy if exists "vendedores_update_owner" on public.vendedores;
create policy "vendedores_update_owner" on public.vendedores
  for update using (
    user_id = public.cliente_owner_id() or user_id = auth.uid()
  );

drop policy if exists "vendedores_delete_owner" on public.vendedores;
create policy "vendedores_delete_owner" on public.vendedores
  for delete using (
    user_id = public.cliente_owner_id() or user_id = auth.uid()
  );
