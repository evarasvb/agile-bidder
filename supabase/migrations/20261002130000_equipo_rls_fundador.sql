-- Acota el acceso de los admin a SU propio equipo y deja el acceso total solo
-- para el fundador (super_admin). Antes, cualquier admin podía leer todos los
-- perfiles y todos los roles de la plataforma, y crear/borrar roles de
-- cualquiera (incluido super_admin). Esta migración:
--   1. Define el equipo del usuario actual (dueño + miembros que invitó).
--   2. Reconoce al fundador como super_admin por user_roles o users_extended.
--   3. Promueve al fundador a super_admin (idempotente, por email).
--   4. profiles: el fundador ve todo; un admin solo ve a su equipo.
--   5. user_roles SELECT: cada quien ve su rol y el de su equipo; fundador todo.
--   6. user_roles INSERT/DELETE: ningún admin puede tocar el rol super_admin.
--
-- Idempotente: se puede volver a correr sin efectos colaterales.

-- 1) Equipo del usuario actual. SECURITY DEFINER para leer vendedores sin
--    recursión de RLS. Incluye al dueño efectivo y a los miembros que invitó.
create or replace function public.mi_equipo_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.vendedores_owner_auth_id()
  union
  select v.user_id
  from public.vendedores v
  where v.invitado_por = public.vendedores_owner_auth_id()
    and v.user_id is not null;
$$;

-- 2) El fundador se reconoce por users_extended O por user_roles (super_admin).
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.users_extended ue
    where ue.id = auth.uid() and ue.role = 'super_admin'
  ) or exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'super_admin'
  );
$$;

-- 3) Promover al fundador a super_admin (idempotente).
insert into public.user_roles (user_id, role)
select au.id, 'super_admin'::app_role
from auth.users au
where au.email = 'evaras@firmavb.cl'
  and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = au.id and ur.role = 'super_admin'::app_role
  );

-- 4) profiles: fundador ve todo; admin solo su equipo. (El perfil propio ya está
--    cubierto por la política "Users can view their own profile".)
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can view team profiles" on public.profiles;
drop policy if exists "zz_tmp_test" on public.profiles; -- artefacto de depuración, limpiar si existe
create policy "Admins can view team profiles"
on public.profiles
for select
to authenticated
using (
  public.is_super_admin()
  or (
    public.has_role(auth.uid(), 'admin'::app_role)
    and user_id in (select public.mi_equipo_user_ids())
  )
);

-- 5) user_roles SELECT: propio + equipo; fundador todo. (has_role es SECURITY
--    DEFINER, así que el control de roles de la app no depende de esta política.)
drop policy if exists "Authenticated users can view all roles" on public.user_roles;
drop policy if exists "View own and team roles" on public.user_roles;
create policy "View own and team roles"
on public.user_roles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_super_admin()
  or user_id in (select public.mi_equipo_user_ids())
);

-- 6) user_roles INSERT/DELETE: solo el fundador puede crear o borrar el rol
--    super_admin. Un admin puede seguir gestionando roles normales de su gente.
drop policy if exists "Admins can insert roles" on public.user_roles;
drop policy if exists "Admins insert roles (no super_admin)" on public.user_roles;
create policy "Admins insert roles (no super_admin)"
on public.user_roles
for insert
to authenticated
with check (
  public.is_super_admin()
  or (public.is_current_user_admin() and role <> 'super_admin'::app_role)
);

drop policy if exists "Admins can delete roles" on public.user_roles;
drop policy if exists "Admins delete roles (no super_admin)" on public.user_roles;
create policy "Admins delete roles (no super_admin)"
on public.user_roles
for delete
to authenticated
using (
  public.is_super_admin()
  or (public.is_current_user_admin() and role <> 'super_admin'::app_role)
);
