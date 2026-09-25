-- Aviso cuando alguien se registra en la app.
-- profiles se crea al registrarse el usuario. Marca de "ya avisado" para no
-- repetir, y RPC que devuelve los registros nuevos con datos del cliente.
alter table public.profiles
  add column if not exists avisado boolean not null default false;
-- Baseline: los usuarios ya existentes no se re-avisan.
update public.profiles set avisado = true where avisado = false;
create index if not exists idx_profiles_avisado
  on public.profiles (avisado) where avisado = false;

-- Registros nuevos por avisar, con empresa/plan del cliente si ya lo cargó.
-- SECURITY DEFINER + service_role.
create or replace function public.registros_por_avisar()
returns table(id uuid, email text, nombre text, empresa text, plan text, creado_en timestamptz)
language sql security definer set search_path to 'public'
as $$
  select p.id,
         coalesce(p.email, c.email, c.email_contacto),
         coalesce(p.full_name, c.nombre_responsable, c.representante_nombre),
         c.empresa_nombre, c.plan, p.created_at
  from public.profiles p
  left join public.clientes c on c.user_id = p.id
  where p.avisado = false
  order by p.created_at;
$$;

revoke all on function public.registros_por_avisar() from public, anon, authenticated;
grant execute on function public.registros_por_avisar() to service_role;
