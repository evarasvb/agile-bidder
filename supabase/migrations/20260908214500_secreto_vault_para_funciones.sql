-- Lectura de secretos de la bóveda desde las Edge Functions (solo service_role).
-- Permite tener más de un ticket de Mercado Público sin tocar los secretos de las funciones:
-- p. ej. 'mercadopublico_ticket_oc' dedicado al detalle de órdenes de compra.
create or replace function public.secreto_vault(p_nombre text)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_nombre limit 1;
$$;
revoke all on function public.secreto_vault(text) from public, anon, authenticated;
grant execute on function public.secreto_vault(text) to service_role;
