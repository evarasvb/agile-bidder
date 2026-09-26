-- 2 hallazgos P2 de Codex sobre 20260925033000_vendedores_rls_fix_owner_scope.sql:
--
-- 1) "Nuevo Vendedor" (GestionVendedores.tsx / AsignarVendedorModal.tsx)
--    inserta una fila pendiente con user_id null y sin invitado_por: ni
--    user_id = auth.uid() ni invitado_por = auth.uid() se cumplían, así
--    que el INSERT quedaba bloqueado por RLS (ya lo estaba antes de este
--    PR con la política anterior — user_id = cliente_owner_id() tampoco
--    lo permitía con user_id null —, no es una regresión de este PR, pero
--    como toca la misma familia de políticas se corrige acá). El trigger
--    que protege invitado_por ahora deja que quien inserta fije
--    invitado_por a SU PROPIO auth.uid() (nunca al de otra persona), y
--    useCreateVendedor lo manda así.
--
-- 2) Con invitado_por = auth.uid() como único criterio de "somos del mismo
--    equipo", un miembro invitado (no dueño) solo veía su propia fila en
--    useEquipoMembers()/AsignarPipelineModal: sus compañeros tienen
--    invitado_por = el auth.uid() del DUEÑO, no el suyo. Se agrega
--    vendedores_owner_auth_id(), que resuelve "el auth.uid() del dueño
--    efectivo" (el propio si no es miembro invitado, o el invitado_por de
--    mi propia fila si lo soy), y se usa en el SELECT para que dueño y
--    equipo vean el mismo roster. UPDATE/DELETE quedan igual (solo el
--    dueño gestiona altas/bajas), no hace falta que un miembro edite a
--    otro.

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
    elsif new.invitado_por is distinct from old.invitado_por then
      new.invitado_por := old.invitado_por;
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.vendedores_owner_auth_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (
      select v.invitado_por
      from public.vendedores v
      where v.user_id = auth.uid()
        and v.activo is true
        and v.invitado_por is not null
      order by v.updated_at desc nulls last
      limit 1
    ),
    auth.uid()
  );
$function$;

grant execute on function public.vendedores_owner_auth_id() to authenticated, anon;

drop policy if exists "vendedores_select_owner" on public.vendedores;
create policy "vendedores_select_owner" on public.vendedores
  for select using (
    user_id = auth.uid() or invitado_por = public.vendedores_owner_auth_id()
  );
