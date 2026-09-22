-- Fix de seguridad (hallazgo de Codex en PR #336): la política de insert de
-- evaristo_acciones solo exige que user_id = auth.uid(), pero el trigger anterior
-- preservaba cualquier cliente_id no nulo que el propio cliente mandara en el insert.
-- Un usuario autenticado podía mandar su user_id real junto al cliente_id de OTRO
-- cliente y colar una acción (incluido publicar_cm) que extension-api entrega a la
-- extensión de ese otro cliente, saltándose la confirmación del chat.
-- Ahora cliente_id sale SIEMPRE de user_id, nunca de lo que mande el cliente.
create or replace function public.evaristo_acciones_antes()
returns trigger language plpgsql as $$
begin
  select c.id into new.cliente_id from public.clientes c where c.user_id = new.user_id limit 1;
  new.actualizado_en := now();
  return new;
end $$;
