-- Mi propia migración de fix de seguridad del Frente 18
-- (fix_admin_monitoreo_experto_y_evaristo_acciones_seguridad, aplicada 16:46)
-- redefinió evaristo_acciones_antes() basándose en la versión ORIGINAL del
-- trigger (con "if new.cliente_id is null then ... end if;"), sin saber que
-- otra sesión ya había aplicado 36 minutos antes un fix distinto
-- (evaristo_acciones_fix_cliente, aplicado 16:10, hallazgo de Codex en la
-- PR #336) que cierra un IDOR real: un cliente autenticado podía mandar su
-- propio user_id junto al cliente_id de OTRO cliente, y el trigger antiguo
-- preservaba ese cliente_id ajeno (la extensión terminaba ejecutando la
-- acción, incluida publicar_cm ya confirmada, contra la sesión de Mercado
-- Público del cliente equivocado). Como mi migración corrió después, pisó
-- ese fix y reabrió el hueco durante ~19 minutos hasta que se detectó acá.
-- Se combinan ambos fixes: cliente_id SIEMPRE sale de user_id (nunca de lo
-- que mande el cliente) y publicar_cm SIEMPRE nace en 'confirmar'.
create or replace function public.evaristo_acciones_antes()
returns trigger language plpgsql as $$
begin
  select c.id into new.cliente_id from public.clientes c where c.user_id = new.user_id limit 1;
  if tg_op = 'INSERT' and new.tipo = 'publicar_cm' then
    new.estado := 'confirmar';
  end if;
  new.actualizado_en := now();
  return new;
end $$;

-- Corregir el trigger no alcanza: cualquier fila insertada mientras estuvo
-- regresionado conserva el cliente_id que haya mandado el cliente. Se
-- recalcula para toda acción que todavía puede ejecutarse (no terminal);
-- una acción ya hecha/fallida/cancelada no la vuelve a tomar la extensión.
-- (No hubo ninguna acción creada en la ventana de ~19 minutos expuesta,
-- verificado por fecha antes de aplicar esto; se deja igual por si acaso.)
update public.evaristo_acciones ea
set cliente_id = c.id
from public.clientes c
where c.user_id = ea.user_id
  and ea.estado not in ('hecha', 'fallida', 'cancelada')
  and ea.cliente_id is distinct from c.id;
