-- Hallazgo P1 de Codex: el fix anterior solo clampaba user_id en INSERT.
-- En UPDATE, el trigger restauraba invitado_por si cambiaba, pero no tocaba
-- user_id en absoluto — un atacante con una fila propia (invitado_por = su
-- auth.uid(), la crea él mismo con "Nuevo Vendedor") podía hacer UPDATE de
-- esa misma fila para poner user_id = el auth.uid() de una víctima (visto en
-- el roster) y activo = true. El UPDATE pasa la política (invitado_por sigue
-- siendo el suyo) y el trigger no lo bloqueaba, logrando el mismo secuestro
-- de tenant que el fix anterior cerró para INSERT. Se bloquea igual que
-- invitado_por: en UPDATE, user_id queda fijo para cualquiera que no sea
-- service_role (ningún flujo del cliente lo cambia vía UPDATE; activar-miembro
-- lo hace con service_role).
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
    else
      if new.invitado_por is distinct from old.invitado_por then
        new.invitado_por := old.invitado_por;
      end if;
      if new.user_id is distinct from old.user_id then
        new.user_id := old.user_id;
      end if;
    end if;
  end if;
  return new;
end;
$function$;
