-- Aviso cuando un cliente completa el onboarding (clientes.onboarding_completado).
-- Marca aparte para no repetir el aviso, y RPC con los datos del cliente.
alter table public.clientes
  add column if not exists aviso_onboarding boolean not null default false;
-- Baseline: los que ya completaron el onboarding no se re-avisan.
update public.clientes set aviso_onboarding = true
  where aviso_onboarding = false and onboarding_completado = true;
create index if not exists idx_clientes_aviso_onboarding
  on public.clientes (aviso_onboarding)
  where aviso_onboarding = false and onboarding_completado = true;

-- Onboardings recién completados por avisar. SECURITY DEFINER + service_role.
create or replace function public.onboardings_por_avisar()
returns table(id uuid, nombre text, empresa text, email text, plan text,
              rut text, region text, telefono text, completado_en timestamptz)
language sql security definer set search_path to 'public'
as $$
  select c.id,
         coalesce(c.nombre_responsable, c.representante_nombre, p.full_name),
         c.empresa_nombre,
         coalesce(c.email, c.email_contacto, p.email),
         c.plan, c.rut, c.region, c.telefono, c.updated_at
  from public.clientes c
  left join public.profiles p on p.id = c.user_id
  where c.onboarding_completado = true and c.aviso_onboarding = false
  order by c.updated_at;
$$;

revoke all on function public.onboardings_por_avisar() from public, anon, authenticated;
grant execute on function public.onboardings_por_avisar() to service_role;
