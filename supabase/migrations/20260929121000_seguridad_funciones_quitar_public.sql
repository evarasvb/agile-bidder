-- Paso 1 (corrección): las funciones sensibles seguían ejecutables por anónimos
-- porque el permiso EXECUTE venía del rol PUBLIC (por defecto en Postgres), no de
-- un grant directo a 'anon'. Aquí se revoca EXECUTE a PUBLIC y anon, y se re-otorga
-- explícitamente a 'authenticated' para no romper la app (service_role no necesita
-- grant: siempre puede). Las funciones de trigger no reciben grant (solo corren
-- por el trigger, como definer).

do $$
declare
  fn text;
  sig text;
  -- RPC que la app/fundador llaman desde el cliente: revocar public/anon, dejar authenticated.
  rpc_nombres text[] := array[
    'fundador_creditos_otorgar',
    'admin_clientes_nuevos',
    'admin_clientes_para_importar',
    'noticias_refrescar_clientes',
    'experto_libro_eliminar',
    'consumir_creditos',
    'creditos_saldo',
    'experto_bajo_agua_mi_cuota',
    'experto_jurisprudencia',
    'experto_leyes',
    'experto_licitaciones_similares',
    'cliente_panel_proveedor',
    'inteligencia_oc_oportunidad'
  ];
  -- Funciones de trigger o exclusivas del backend: nadie las llama directo desde
  -- el cliente. Revocar a todos los roles cliente (solo service_role).
  -- creditos_asegurar_cuenta es SECURITY DEFINER, recibe un UUID arbitrario y
  -- devuelve la cuenta/plan/saldo de ese usuario: debe quedar solo service_role
  -- (lo aseguró 20260926190000).
  trg_nombres text[] := array['creditos_sync_plan_trigger', 'creditos_asegurar_cuenta'];
begin
  foreach fn in array rpc_nombres loop
    for sig in
      select 'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=fn
    loop
      execute 'revoke execute on function '||sig||' from public, anon';
      execute 'grant execute on function '||sig||' to authenticated';
    end loop;
  end loop;

  foreach fn in array trg_nombres loop
    for sig in
      select 'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=fn
    loop
      execute 'revoke execute on function '||sig||' from public, anon, authenticated';
    end loop;
  end loop;
end $$;
