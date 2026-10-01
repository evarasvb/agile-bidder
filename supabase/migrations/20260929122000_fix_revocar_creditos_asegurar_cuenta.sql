-- Corrección de seguridad (aplicada en caliente en producción tras la revisión):
-- creditos_asegurar_cuenta debe ser SOLO service_role. La aseguró 20260926190000
-- y 20260929121000 la reabrió a authenticated por error (ya corregido en ese
-- archivo también). Esta migración re-asegura la postura y sirve para dejar el
-- historial del repo alineado con producción. Es idempotente.
do $$
declare sig text;
begin
  for sig in
    select 'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'creditos_asegurar_cuenta'
  loop
    execute 'revoke execute on function '||sig||' from public, anon, authenticated';
    execute 'grant execute on function '||sig||' to service_role';
  end loop;
end $$;
