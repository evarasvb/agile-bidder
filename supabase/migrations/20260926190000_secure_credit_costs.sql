-- La tabla define cuánto descuenta cada acción del saldo de créditos. No debe
-- poder leerse ni modificarse directamente desde una clave pública.
alter table public.creditos_costos enable row level security;

revoke all privileges on table public.creditos_costos from public, anon, authenticated;
grant all privileges on table public.creditos_costos to service_role;

-- Solo la RPC de saldo forma parte de la API del cliente. La inicialización de
-- cuentas y el trigger se ejecutan internamente con los privilegios del dueño.
revoke execute on function public.creditos_asegurar_cuenta(uuid) from public, anon, authenticated;
grant execute on function public.creditos_asegurar_cuenta(uuid) to service_role;

revoke execute on function public.creditos_saldo() from public, anon;
grant execute on function public.creditos_saldo() to authenticated, service_role;

revoke execute on function public.creditos_sync_plan_trigger() from public, anon, authenticated;
grant execute on function public.creditos_sync_plan_trigger() to service_role;

-- Las operaciones del fundador y los resúmenes privados siguen disponibles
-- para Enrique autenticado, pero ya no se publican a visitantes anónimos.
revoke execute on function public.fundador_costo_set(text, integer) from public, anon;
revoke execute on function public.fundador_costos_listar() from public, anon;
revoke execute on function public.fundador_creditos_otorgar(uuid, integer, text) from public, anon;
revoke execute on function public.fundador_metricas() from public, anon;
revoke execute on function public.fundador_plan_set(uuid, text) from public, anon;
revoke execute on function public.fundador_uso_ia_resumen(integer) from public, anon;

grant execute on function public.fundador_costo_set(text, integer) to authenticated, service_role;
grant execute on function public.fundador_costos_listar() to authenticated, service_role;
grant execute on function public.fundador_creditos_otorgar(uuid, integer, text) to authenticated, service_role;
grant execute on function public.fundador_metricas() to authenticated, service_role;
grant execute on function public.fundador_plan_set(uuid, text) to authenticated, service_role;
grant execute on function public.fundador_uso_ia_resumen(integer) to authenticated, service_role;

revoke execute on function public.admin_campanas_resumen() from public, anon;
revoke execute on function public.admin_clientes_nuevos(integer, integer) from public, anon;
revoke execute on function public.admin_clientes_para_importar() from public, anon;
revoke execute on function public.admin_marketing_contactos_cruce() from public, anon;
revoke execute on function public.admin_traccion_resumen() from public, anon;

grant execute on function public.admin_campanas_resumen() to authenticated, service_role;
grant execute on function public.admin_clientes_nuevos(integer, integer) to authenticated, service_role;
grant execute on function public.admin_clientes_para_importar() to authenticated, service_role;
grant execute on function public.admin_marketing_contactos_cruce() to authenticated, service_role;
grant execute on function public.admin_traccion_resumen() to authenticated, service_role;

-- Postcondiciones: abortan la migración si la superficie pública sigue abierta.
do $$
begin
  if not (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'creditos_costos'
  ) then
    raise exception 'creditos_costos debe tener RLS habilitado';
  end if;

  if has_table_privilege('anon', 'public.creditos_costos', 'select')
     or has_table_privilege('anon', 'public.creditos_costos', 'insert')
     or has_table_privilege('anon', 'public.creditos_costos', 'update')
     or has_table_privilege('anon', 'public.creditos_costos', 'delete')
     or has_table_privilege('authenticated', 'public.creditos_costos', 'select')
     or has_table_privilege('authenticated', 'public.creditos_costos', 'insert')
     or has_table_privilege('authenticated', 'public.creditos_costos', 'update')
     or has_table_privilege('authenticated', 'public.creditos_costos', 'delete') then
    raise exception 'creditos_costos conserva privilegios de cliente';
  end if;

  if not has_table_privilege('service_role', 'public.creditos_costos', 'select') then
    raise exception 'service_role perdió acceso a creditos_costos';
  end if;

  if has_function_privilege('anon', 'public.creditos_asegurar_cuenta(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.creditos_asegurar_cuenta(uuid)', 'execute')
     or has_function_privilege('anon', 'public.fundador_costo_set(text,integer)', 'execute')
     or has_function_privilege('anon', 'public.admin_traccion_resumen()', 'execute') then
    raise exception 'las RPC privadas conservan acceso de cliente';
  end if;
end
$$;
