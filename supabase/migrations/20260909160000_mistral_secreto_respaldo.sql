-- Clave de Mistral (plan Experiment, gratis) como respaldo cuando Gemini se queda sin cuota al resumir
-- bases. Se guarda en Vault, igual que el resto de credenciales sensibles, y se expone con una función
-- mínima de solo lectura para que experto-bases la use (no queda visible en variables de entorno ni en
-- el código).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'mistral_api_key') then
    perform vault.create_secret(
      'VdjCMZAIpnuOHdqYHEL3YYjT8MsK8DT1',
      'mistral_api_key',
      'Clave API de Mistral (plan Experiment, gratis) usada como respaldo de resumen de bases cuando Gemini no tiene cuota.'
    );
  end if;
end $$;

create or replace function public.experto_bases_secreto(p_nombre text)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_nombre limit 1;
$$;

revoke all on function public.experto_bases_secreto(text) from public, anon, authenticated;
grant execute on function public.experto_bases_secreto(text) to service_role;
