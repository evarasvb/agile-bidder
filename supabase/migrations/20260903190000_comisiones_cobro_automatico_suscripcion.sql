-- Cobro automatico de comisiones: se suman al proximo cargo de la suscripcion de Mercado Pago
-- (se ajusta el monto del preapproval) y despues vuelve al fijo. El fijo lo cobra la suscripcion.
-- Aplicado en prod como comisiones_cobro_automatico_suscripcion.
alter table public.facturas_comision
  add column if not exists por_suscripcion boolean not null default false,
  add column if not exists cobro_programado_en timestamptz,
  add column if not exists cobro_preapproval_id text,
  add column if not exists cobro_revertido_en timestamptz;

create or replace function public.comisiones_cerrar_mes(p_periodo text default to_char(now() - interval '1 month', 'YYYY-MM'))
returns table (user_id uuid, cliente_id uuid, email text, periodo text, fijo numeric, comision numeric, total numeric, ocs integer)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with clientes_erp as (
    select c.id, c.user_id, c.email, p.precio_mensual,
           exists (select 1 from public.suscripciones s where s.cliente_id = c.id and s.estado = 'authorized' and s.mp_preapproval_id is not null) as con_suscripcion
    from public.clientes c join public.planes p on p.id = c.plan
    where c.activo and p.id <> 'free' and c.user_id is not null),
  ventas as (
    select v.user_id, sum(v.monto_neto) neto, sum(v.comision_monto) comision, count(*)::int n,
           jsonb_agg(jsonb_build_object('oc', v.codigo_oc, 'licitacion', v.numero_licitacion, 'comprador', v.comprador, 'fecha', v.fecha_aceptacion, 'neto', v.monto_neto, 'comision', v.comision_monto) order by v.fecha_aceptacion) det
    from public.ventas_comisionables v where v.periodo = p_periodo and v.estado = 'pendiente' group by v.user_id),
  ins as (
    insert into public.facturas_comision (user_id, cliente_id, periodo, fecha_emision, fecha_vencimiento, fijo_monto, total_ventas, total_comision, total, estado, validacion_hasta, detalle, por_suscripcion)
    select ce.user_id, ce.id, p_periodo, current_date, current_date + 10, ce.precio_mensual, coalesce(ve.neto, 0), coalesce(ve.comision, 0),
           case when ce.con_suscripcion then coalesce(ve.comision, 0) else ce.precio_mensual + coalesce(ve.comision, 0) end,
           'preforma', now() + interval '2 days',
           jsonb_build_object('ocs', coalesce(ve.det, '[]'::jsonb), 'n', coalesce(ve.n, 0)), ce.con_suscripcion
    from clientes_erp ce left join ventas ve on ve.user_id = ce.user_id
    on conflict (user_id, periodo) do nothing
    returning *)
  select i.user_id, i.cliente_id, ce.email, i.periodo, i.fijo_monto, i.total_comision, i.total, (i.detalle->>'n')::int
  from ins i join clientes_erp ce on ce.user_id = i.user_id;
  update public.ventas_comisionables v set estado = 'preforma', factura_id = f.id, updated_at = now()
  from public.facturas_comision f
  where f.periodo = p_periodo and f.user_id = v.user_id and v.periodo = p_periodo and v.estado = 'pendiente';
end $$;

create or replace function public.comisiones_por_cobrar()
returns table (factura_id uuid, cliente_id uuid, periodo text, total numeric, total_comision numeric, fijo numeric, estado text, cobro_programado_en timestamptz, cobro_preapproval_id text, cobro_revertido_en timestamptz, mp_preapproval_id text, susc_estado text)
language sql stable security definer set search_path = public as $$
  select f.id, f.cliente_id, f.periodo, f.total, f.total_comision, f.fijo_monto, f.estado, f.cobro_programado_en, f.cobro_preapproval_id, f.cobro_revertido_en, s.mp_preapproval_id, s.estado
  from public.facturas_comision f
  left join lateral (select s.* from public.suscripciones s where s.cliente_id = f.cliente_id and s.mp_preapproval_id is not null order by (s.estado = 'authorized') desc, s.updated_at desc limit 1) s on true
  where f.por_suscripcion and (
        (f.estado in ('por_facturar', 'facturada') and f.cobro_programado_en is null)
     or (f.cobro_programado_en is not null and f.cobro_revertido_en is null))
  order by f.periodo;
$$;
revoke all on function public.comisiones_por_cobrar() from public, anon, authenticated;
grant execute on function public.comisiones_por_cobrar() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'comisiones-cobrar';
select cron.schedule('comisiones-cobrar', '45 7 * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/comisiones-cobrar',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);
