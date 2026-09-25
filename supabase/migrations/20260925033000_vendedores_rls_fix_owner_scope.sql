-- Corrige 2 hallazgos reales de Codex sobre 20260925031342_vendedores_rls_repo_parity.sql:
--
-- 1) Esa migración de paridad no eliminaba "admin_full_access_vendedores" ni
--    "vendedores_read_active" (creadas en 20260318000002_gestion_vendedores.sql,
--    nunca eliminadas por ningún archivo del repo). En la base viva ya no
--    existen (alguien las sacó sin dejar migración), pero un ambiente
--    reconstruido SOLO desde los archivos del repo (preview, test, disaster
--    recovery) las recrearía y PostgreSQL las combina con OR junto a las
--    políticas *_owner: cualquier fila con rol 'admin' en user_roles podría
--    actualizar vendedores de CUALQUIER empresa. Se eliminan explícito.
--
-- 2) Las políticas *_owner comparaban "vendedores.user_id = cliente_owner_id()".
--    cliente_owner_id() devuelve un clientes.id; vendedores.user_id referencia
--    auth.users(id) — son dominios de UUID distintos que nunca calzan, así que
--    esa rama nunca fue una puerta de acceso (no es el hueco de seguridad que
--    se investigó en la otra PR), pero tampoco funcionaba para lo que se
--    necesitaba: el dueño de la empresa no podía ver ni gestionar a su propio
--    equipo invitado (useEquipoMembers, useUpdateVendedor,
--    useToggleVendedorActivo hacían SELECT/UPDATE directo contra `vendedores`
--    confiando en RLS). El campo que sí identifica "quién invitó a esta fila"
--    es vendedores.invitado_por, que cliente_owner_id() ya usa internamente
--    (v.invitado_por = c.user_id): se cambia la comparación a
--    "invitado_por = auth.uid()". El trigger de la otra migración
--    (vendedores_bloquear_invitado_por_cliente) sigue siendo quien impide que
--    cualquiera escriba ese campo salvo el service_role, así que esto no abre
--    ninguna puerta nueva: solo deja funcionar el chequeo de lectura/edición
--    que ya se pretendía tener.

drop policy if exists "admin_full_access_vendedores" on public.vendedores;
drop policy if exists "vendedores_read_active" on public.vendedores;

drop policy if exists "vendedores_select_owner" on public.vendedores;
create policy "vendedores_select_owner" on public.vendedores
  for select using (
    user_id = auth.uid() or invitado_por = auth.uid()
  );

drop policy if exists "vendedores_insert_owner" on public.vendedores;
create policy "vendedores_insert_owner" on public.vendedores
  for insert with check (
    user_id = auth.uid() or invitado_por = auth.uid()
  );

drop policy if exists "vendedores_update_owner" on public.vendedores;
create policy "vendedores_update_owner" on public.vendedores
  for update using (
    user_id = auth.uid() or invitado_por = auth.uid()
  );

drop policy if exists "vendedores_delete_owner" on public.vendedores;
create policy "vendedores_delete_owner" on public.vendedores
  for delete using (
    user_id = auth.uid() or invitado_por = auth.uid()
  );
