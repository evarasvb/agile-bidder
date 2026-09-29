-- Estas funciones se usan en políticas RLS para usuarios autenticados. No
-- deben estar disponibles para anon ni para PUBLIC.
revoke execute on function public.get_user_primary_role(uuid) from public, anon;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.user_can_access_section(uuid, text) from public, anon;

grant execute on function public.get_user_primary_role(uuid) to authenticated, service_role;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.user_can_access_section(uuid, text) to authenticated, service_role;
