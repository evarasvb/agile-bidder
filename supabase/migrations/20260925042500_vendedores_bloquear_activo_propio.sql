-- Hallazgo P1 de Codex: la política de UPDATE deja tocar la fila propia
-- (user_id = auth.uid()), así que un miembro que el dueño desactivó podía
-- volver a poner activo = true él mismo (el botón "Reactivar" de su propia
-- fila inactiva, o una llamada directa) y recuperar el acceso que el dueño
-- le había quitado. Solo el dueño (invitado_por = auth.uid()) o el
-- service_role deberían poder cambiar `activo`; se agrega un trigger que
-- deja ese campo fijo para cualquier otro caso, mismo patrón que ya usan
-- los triggers de invitado_por y notificaciones_log.
create or replace function public.vendedores_bloquear_activo_propio()
returns trigger
language plpgsql
as $function$
begin
  if auth.role() is distinct from 'service_role' and auth.uid() is distinct from old.invitado_por then
    new.activo := old.activo;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_vendedores_bloquear_activo_propio on public.vendedores;
create trigger trg_vendedores_bloquear_activo_propio
before update on public.vendedores
for each row execute function public.vendedores_bloquear_activo_propio();
