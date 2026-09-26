-- Codex encontró que las políticas de vendedores (INSERT/UPDATE con
-- with_check "user_id = auth.uid()") permiten que cualquier usuario
-- autenticado inserte/actualice su propia fila con invitado_por = el
-- user_id de OTRA empresa y activo = true. cliente_owner_id() confía en
-- invitado_por para resolver la empresa dueña, y varias tablas (inventario,
-- facturas_por_cobrar, oportunidad_veredictos, ca_item_matches,
-- notificaciones_log, etc.) confían en cliente_owner_id() en su RLS — así
-- que ese hueco le daba a un atacante acceso de lectura/escritura a todo
-- eso con solo adivinar el user_id de la víctima.
--
-- El flujo legítimo (invitar-miembro / activar-miembro, edge functions)
-- ya escribe invitado_por con el cliente de service_role, que no pasa por
-- RLS. Ningún flujo del cliente (useVendedores.ts, useEquipo.ts) necesita
-- tocar esa columna. Se bloquea con un trigger en vez de tocar las
-- políticas existentes, para no arriesgar romper otros usos legítimos que
-- no alcanzamos a mapear todos.
create or replace function public.vendedores_bloquear_invitado_por_cliente()
returns trigger
language plpgsql
as $function$
begin
  if auth.role() is distinct from 'service_role' then
    if tg_op = 'INSERT' then
      new.invitado_por := null;
    elsif new.invitado_por is distinct from old.invitado_por then
      new.invitado_por := old.invitado_por;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_vendedores_bloquear_invitado_por on public.vendedores;
create trigger trg_vendedores_bloquear_invitado_por
before insert or update on public.vendedores
for each row execute function public.vendedores_bloquear_invitado_por_cliente();
