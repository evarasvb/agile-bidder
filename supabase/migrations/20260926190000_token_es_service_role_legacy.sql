-- Corrección urgente: el chequeo de autorización agregado a evaristo-vigia (PR #406,
-- hallazgo de bot revisor) comparaba el Authorization contra Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
-- pero el cron real (cron.job "evaristo-vigia") manda el JWT legacy guardado en
-- vault.decrypted_secrets (name='service_role_jwt_legacy') — Supabase migró a un formato de
-- llave nuevo y ese valor ya NO coincide con SUPABASE_SERVICE_ROLE_KEY. Resultado: el propio
-- cron se rechazaba a sí mismo con 401 cada 10 minutos desde que se desplegó el chequeo.
--
-- Esta función deja que la edge function verifique el token recibido contra el secreto real
-- que usa el cron, sin exponer el secreto por la red: la función corre con privilegios para
-- leer vault, pero solo devuelve true/false.
create or replace function public.token_es_service_role_legacy(p_token text)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
as $$
  select p_token is not null and p_token = (
    select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy'
  );
$$;

revoke execute on function public.token_es_service_role_legacy(text) from public, anon, authenticated;
grant execute on function public.token_es_service_role_legacy(text) to service_role;
