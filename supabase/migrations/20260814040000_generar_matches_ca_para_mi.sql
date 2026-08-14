-- Wrapper para disparar el match ON-DEMAND (ej. al terminar el onboarding) desde
-- el frontend con seguridad: resuelve el cliente del propio usuario (auth.uid())
-- y corre el match. SECURITY DEFINER para poder escribir en ca_matches sin que
-- la RLS del usuario lo bloquee, pero SIN permitir apuntar a otro cliente.
create or replace function public.generar_matches_ca_para_mi()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente uuid;
  n integer;
begin
  select id into v_cliente
  from public.clientes
  where user_id = auth.uid()
  order by created_at asc
  limit 1;

  if v_cliente is null then
    return 0;
  end if;

  n := public.generar_matches_ca(v_cliente);
  return n;
end $$;

revoke all on function public.generar_matches_ca_para_mi() from public;
grant execute on function public.generar_matches_ca_para_mi() to authenticated;
