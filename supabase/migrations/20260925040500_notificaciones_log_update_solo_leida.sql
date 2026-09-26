-- Hallazgo P2 de Codex: la política de UPDATE de notificaciones_log solo tiene
-- USING (sin WITH CHECK separado, así que Postgres usa el mismo USING como
-- WITH CHECK implícito) — un miembro del equipo puede, vía llamada directa a
-- la API (no por la UI, que solo manda {leida: true}), reescribir cualquier
-- columna de cualquier notificación de su propia empresa (tipo, datos,
-- licitacion_id, created_at, email_enviado), no solo marcarla leída.
-- Se agrega un trigger que, para quien no sea service_role, deja fijas todas
-- las columnas salvo `leida` (mismo patrón ya usado para vendedores.invitado_por).
create or replace function public.notificaciones_log_bloquear_columnas_cliente()
returns trigger
language plpgsql
as $function$
begin
  if auth.role() is distinct from 'service_role' then
    new.id := old.id;
    new.cliente_id := old.cliente_id;
    new.tipo := old.tipo;
    new.licitacion_id := old.licitacion_id;
    new.email_enviado := old.email_enviado;
    new.datos := old.datos;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_notificaciones_log_bloquear_columnas on public.notificaciones_log;
create trigger trg_notificaciones_log_bloquear_columnas
before update on public.notificaciones_log
for each row execute function public.notificaciones_log_bloquear_columnas_cliente();
