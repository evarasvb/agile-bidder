-- Cruce cliente/prospecto para la pantalla de Marketing > Contactos: marketing_contactos
-- solo la lee su dueño via RLS de auth.uid() en varias tablas relacionadas, pero clientes
-- tiene RLS "cada quien ve su propia fila" (no un admin viendo todas). Mismo patrón que
-- admin_traccion_resumen: RPC security-definer que revisa el email del admin adentro.
create or replace function public.admin_marketing_contactos_cruce()
returns table (
  contacto_id uuid,
  es_cliente boolean,
  campanas_enviadas int
)
language sql stable security definer set search_path = public as $$
  select
    mc.id as contacto_id,
    exists (
      select 1 from clientes c where lower(c.email) = lower(mc.email)
    ) as es_cliente,
    (select count(*)::int from marketing_ejecucion me where me.contacto_id = mc.id) as campanas_enviadas
  from marketing_contactos mc
  where (auth.jwt() ->> 'email') = 'evaras@firmavb.cl';
$$;
grant execute on function public.admin_marketing_contactos_cruce() to authenticated;
