-- Hallazgos de Codex en PR #461 (ya mergeada, se corrige acá):
--   P1: invitar-miembro normalizaba cualquier rol que no fuera
--       admin/cobranza/visor a 'vendedor' — un Comprador invitado quedaba
--       guardado (y activado) como Vendedor.
--   P2: editar el rol de un miembro YA activado (EquipoMemberList) solo
--       actualiza vendedores.rol — user_roles (de donde useProfile() lee
--       isAdmin/isSuperAdmin y el resto de la app decide permisos) nunca se
--       enteraba del cambio. Esto no era nuevo de 'comprador': ya pasaba con
--       cualquier cambio de rol de un miembro activo (ej. vendedor -> cobranza),
--       solo que nadie lo había notado.
--
-- Fix de raíz para el P2 (y cualquier rol futuro): un trigger que mantiene
-- user_roles sincronizado con vendedores.rol cada vez que cambia (o que se
-- activa la cuenta y user_id pasa de null a un uuid). Nunca toca 'super_admin'
-- (es un nivel aparte, no viene de vendedores.rol).

create or replace function public.vendedores_sync_user_role()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_role public.app_role;
begin
  if new.user_id is null then return new; end if;
  v_role := case lower(coalesce(new.rol, ''))
    when 'admin' then 'admin'
    when 'cobranza' then 'cobranza'
    when 'comprador' then 'comprador'
    when 'visor' then 'visor'
    when 'viewer' then 'visor'
    else 'vendedor'
  end::public.app_role;

  delete from public.user_roles
    where user_id = new.user_id
      and role in ('admin', 'vendedor', 'visor', 'cobranza', 'comprador')
      and role <> v_role;

  insert into public.user_roles (user_id, role)
  values (new.user_id, v_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$function$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_vendedores_sync_user_role') then
    create trigger trg_vendedores_sync_user_role
      after update of rol, user_id on public.vendedores
      for each row
      when (new.user_id is not null)
      execute function public.vendedores_sync_user_role();
  end if;
end $$;
