-- Un vendedor invitado tiene su propia fila en clientes (creada por
-- useCliente()) distinta de la fila de la empresa dueña; las políticas de
-- notificaciones_log solo miraban "cliente_id IN (mis propias filas)", así
-- que nunca veía los avisos de la empresa (ni por poll ni por Realtime).
-- Se agrega el match por cliente_owner_id() sin sacar el original, para no
-- perder ningún acceso que ya funcionara.
drop policy if exists "Clients can view their own notification logs" on public.notificaciones_log;
create policy "Clients can view their own notification logs" on public.notificaciones_log
  for select using (
    cliente_id in (select id from public.clientes where user_id = auth.uid())
    or cliente_id = public.cliente_owner_id()
  );

drop policy if exists "notif_log_update_own" on public.notificaciones_log;
create policy "notif_log_update_own" on public.notificaciones_log
  for update using (
    cliente_id in (select id from public.clientes where user_id = auth.uid())
    or cliente_id = public.cliente_owner_id()
  );
