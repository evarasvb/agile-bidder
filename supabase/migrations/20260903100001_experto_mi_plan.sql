-- Plan efectivo del usuario para el front: 'pro' si pagó Experto Pro (pago único) o tiene
-- suscripción de cliente; 'free' si no. Con esto el Pro del Experto ve riesgo de pago y
-- competencia dentro de la plataforma (modo vitrina para free).
create or replace function public.experto_mi_plan()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select 'pro' from public.experto_pro e where e.user_id = auth.uid() and e.hasta > now()),
    (select cl.plan from public.clientes cl where cl.user_id = auth.uid() and cl.activo and cl.plan <> 'free' limit 1),
    'free');
$$;
grant execute on function public.experto_mi_plan() to authenticated;
