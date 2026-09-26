-- Hallazgo P2 de Codex: notificaciones_log_leidas arranca vacía, pero
-- useAvisos ya deriva "leída" solo de esa tabla — sin esto, todo lo que el
-- dueño ya había marcado leído (notificaciones_log.leida = true) le
-- aparecía como no leído de nuevo apenas se despliega este cambio. Se
-- siembra un recibo para el dueño de cada empresa (clientes.user_id) por
-- cada fila que ya estaba marcada leída. Idempotente (on conflict do nothing).
insert into public.notificaciones_log_leidas (notificacion_id, user_id, leida_en)
select nl.id, c.user_id, now()
from public.notificaciones_log nl
join public.clientes c on c.id = nl.cliente_id
where nl.leida is true
on conflict (notificacion_id, user_id) do nothing;
