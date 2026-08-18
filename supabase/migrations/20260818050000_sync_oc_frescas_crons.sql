-- =====================================================================
-- Órdenes de Compra FRESCAS desde la API oficial de Mercado Público
-- =====================================================================
-- La tabla `ordenes_compra` estaba congelada en enero 2026 (se alimentaba por
-- push de una extensión que dejó de correr). La edge function
-- `sync-ordenes-compra-api` baja OC frescas desde la API oficial
-- (api.mercadopublico.cl/.../ordenesdecompra.json):
--   FASE 1 (lista por fecha): guarda solo las OC RELEVANTES al rubro de los
--     clientes (palabras a incluir + set base), para no llenar la tabla con las
--     ~20 mil OC diarias del Estado.
--   FASE 2 (detalle por código): completa comprador/proveedor/montos + ítems.
-- Dos cron jobs: la lista cada 3 horas (hoy y ayer) y el detalle cada 10 min
-- (tandas de 40 pendientes, las más nuevas primero).
--
-- El JWT se lee del vault EN TIEMPO DE EJECUCIÓN (no se hornea en el comando).

do $cron$
begin
  -- Lista de OC relevantes (hoy y ayer), cada 3 horas.
  if exists (select 1 from cron.job where jobname = 'sync-oc-lista') then
    perform cron.unschedule('sync-oc-lista');
  end if;
  perform cron.schedule('sync-oc-lista', '0 */3 * * *',
    $$ select net.http_post(
         url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/sync-ordenes-compra-api',
         headers := jsonb_build_object('Content-Type','application/json',
           'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_jwt_legacy')),
         body := '{"days":2,"limit":15}'::jsonb,
         timeout_milliseconds := 180000); $$);

  -- Enriquecer detalle de OC pendientes (sin comprador), cada 10 min, tandas de 40.
  if exists (select 1 from cron.job where jobname = 'sync-oc-detalle') then
    perform cron.unschedule('sync-oc-detalle');
  end if;
  perform cron.schedule('sync-oc-detalle', '*/10 * * * *',
    $$ select net.http_post(
         url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/sync-ordenes-compra-api',
         headers := jsonb_build_object('Content-Type','application/json',
           'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_jwt_legacy')),
         body := '{"skipList":true,"limit":40}'::jsonb,
         timeout_milliseconds := 180000); $$);
end $cron$;
