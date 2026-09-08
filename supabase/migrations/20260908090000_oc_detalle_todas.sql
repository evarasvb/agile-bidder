-- Órdenes de compra: detalle para TODAS las cabeceras (no solo las `relevante`).
-- Sin proveedor, institución, montos e ítems, el 88% de las OC quedaba como un nombre suelto.
-- 1) Índice parcial para la cola del enriquecedor (sin organismo, no stale), relevantes y recientes primero.
-- 2) enrich-oc-detalle pasa de cada 15 min / 20 OC a cada 2 min / 60 OC con presupuesto de 100 s
--    (~30 mil OC/día de capacidad; el día trae ~16 mil y el atraso desde el 31-08 se absorbe en ~3 días).

create index if not exists idx_oc_cola_detalle
  on public.ordenes_compra (relevante desc nulls last, fecha_envio_oc desc nulls last)
  where organismo_comprador is null and (stale is null or stale = false);

do $$
declare v_jobid int;
begin
  select jobid into v_jobid from cron.job where jobname = 'enrich-oc-detalle-cron';
  if v_jobid is not null then
    perform cron.alter_job(job_id := v_jobid, schedule := '*/2 * * * *', command := $cmd$
  SELECT net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/enrich-oc-detalle',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_jwt_legacy')),
    body := '{"limit":60,"tipo":"todos","presupuesto_ms":100000}'::jsonb,
    timeout_milliseconds := 150000
  );
$cmd$);
  end if;
end $$;
