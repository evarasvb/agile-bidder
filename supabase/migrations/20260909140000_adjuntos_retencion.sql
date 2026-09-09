-- Retención del bucket bases-licitacion: los adjuntos de licitaciones y compras ágiles cerradas hace
-- más de 60 días se borran (archivos + filas). Las bases leídas por el Experto quedan en
-- bases_licitacion (texto, secciones, resumen). El bucket crecía ~0,5 GB por día sin límite.
create or replace function public.licitaciones_adjuntos_vencidos(p_dias integer default 60, p_limite integer default 200)
returns table (codigo text)
language sql stable security definer set search_path = public as $$
  select e.codigo
  from public.licitaciones_adjuntos_estado e
  left join public.licitaciones_bi l on l.codigo = e.codigo
  left join public.compras_agiles c on c.codigo = e.codigo
  where coalesce(l.fecha_cierre, c.fecha_cierre) < now() - make_interval(days => greatest(30, coalesce(p_dias, 60)))
  order by coalesce(l.fecha_cierre, c.fecha_cierre)
  limit greatest(1, least(coalesce(p_limite, 200), 1000));
$$;
revoke all on function public.licitaciones_adjuntos_vencidos(integer, integer) from public, anon, authenticated;
grant execute on function public.licitaciones_adjuntos_vencidos(integer, integer) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'licitacion-adjuntos-retencion';
select cron.schedule('licitacion-adjuntos-retencion', '10 5 * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/licitacion-adjuntos',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{"limpiar":true,"dias":60,"limit":300}'::jsonb, timeout_milliseconds := 120000);
$$);
