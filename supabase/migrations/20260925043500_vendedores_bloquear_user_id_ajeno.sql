-- Hallazgo P1 de Codex: la política de INSERT permite invitado_por = auth.uid()
-- con CUALQUIER user_id — el trigger solo validaba invitado_por, no user_id.
-- Un atacante autenticado podía insertar una fila con invitado_por = su propio
-- auth.uid() (permitido) pero user_id = el auth.uid() de OTRA persona (visto
-- en el roster), activo = true. cliente_owner_id() y vendedores_owner_auth_id()
-- resuelven "mi empresa" buscando la fila MÁS RECIENTE con user_id = mi propio
-- auth.uid() y activo = true — así que la víctima, al resolver su propia
-- empresa, encontraba esa fila plantada y quedaba redirigida a la empresa del
-- atacante (invitado_por = uid del atacante). Se extiende el mismo trigger que
-- ya protege invitado_por: en INSERT, un no-service_role solo puede dejar
-- user_id en null o en su propio auth.uid(), nunca en el de otra persona.
-- Ningún flujo del cliente necesita insertar con un user_id ajeno (siempre
-- mandan null; el activar-miembro real lo hace vía service_role).
create or replace function public.vendedores_bloquear_invitado_por_cliente()
returns trigger
language plpgsql
as $function$
begin
  if auth.role() is distinct from 'service_role' then
    if tg_op = 'INSERT' then
      if new.invitado_por is distinct from auth.uid() then
        new.invitado_por := null;
      end if;
      if new.user_id is distinct from auth.uid() then
        new.user_id := null;
      end if;
    elsif new.invitado_por is distinct from old.invitado_por then
      new.invitado_por := old.invitado_por;
    end if;
  end if;
  return new;
end;
$function$;
