-- Plan FirmaVB ERP: fijo mensual + 3% sobre las ordenes de compra ACEPTADAS cuya oferta salio
-- de FirmaVB (cliente_ofertas.estado = 'enviada' por la extension). Cierre mensual con preforma
-- (fijo + comisiones del mes anterior), 2 dias de validacion y luego pasa a "por facturar".
-- Aplicado en prod como comisiones_erp_ventas_atribuidas + comisiones_oc_id_bigint.
update public.planes set comision_porcentaje = 3 where id = 'pro';

create table if not exists public.empresas_billing (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  nombre_empresa text,
  plan text,
  comision_porcentaje numeric not null default 3,
  tope_comision numeric not null default 300000,
  tarjeta_ultimos_4 text, tarjeta_marca text, tarjeta_expiracion text,
  created_at timestamptz not null default now()
);
alter table public.empresas_billing enable row level security;
drop policy if exists empresas_billing_propio on public.empresas_billing;
create policy empresas_billing_propio on public.empresas_billing for select to authenticated using (user_id = auth.uid());

create table if not exists public.facturas_comision (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  cliente_id uuid,
  numero_factura text,
  periodo text not null,
  fecha_emision date not null default current_date,
  fecha_vencimiento date,
  fijo_monto numeric not null default 0,
  total_ventas numeric not null default 0,
  total_comision numeric not null default 0,
  total numeric not null default 0,
  estado text not null default 'preforma',  -- preforma | por_facturar | facturada | pagada | anulada
  validacion_hasta timestamptz,
  fecha_pago date,
  documento_url text,
  detalle jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, periodo)
);
alter table public.facturas_comision enable row level security;
drop policy if exists facturas_comision_propias on public.facturas_comision;
create policy facturas_comision_propias on public.facturas_comision for select to authenticated using (user_id = auth.uid());

create table if not exists public.ventas_comisionables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  cliente_id uuid,
  oc_id bigint unique,
  codigo_oc text,
  numero_licitacion text,
  oferta_id uuid,
  fecha_aceptacion timestamptz,
  comprador text,
  estado_oc text,
  monto_neto numeric not null default 0,
  comision_pct numeric not null default 3,
  comision_monto numeric not null default 0,
  periodo text not null,
  estado text not null default 'pendiente', -- pendiente | preforma | facturada | anulada
  factura_id uuid references public.facturas_comision(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ventas_comisionables_user_periodo on public.ventas_comisionables (user_id, periodo);
alter table public.ventas_comisionables enable row level security;
drop policy if exists ventas_comisionables_propias on public.ventas_comisionables;
create policy ventas_comisionables_propias on public.ventas_comisionables for select to authenticated using (user_id = auth.uid());

-- Cuerpo del RUT sin puntos ni digito verificador ("77.171.575-3" -> 77171575).
create or replace function public.rut_cuerpo(p text) returns text language sql immutable as $$
  select case when regexp_replace(lower(coalesce(p,'')), '[^0-9k]', '', 'g') ~ '^[0-9]{7,8}[0-9k]$'
              then left(regexp_replace(lower(p), '[^0-9k]', '', 'g'), length(regexp_replace(lower(p), '[^0-9k]', '', 'g')) - 1)
              else regexp_replace(lower(coalesce(p,'')), '[^0-9k]', '', 'g') end;
$$;

-- Atribucion: OC aceptada (5) o recepcionada (6, 12) del RUT del cliente, con oferta enviada
-- desde FirmaVB para esa misma licitacion. Las canceladas (9) se anulan si aun no se facturaron.
create or replace function public.comisiones_atribuir()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.ventas_comisionables (user_id, cliente_id, oc_id, codigo_oc, numero_licitacion, oferta_id, fecha_aceptacion, comprador, estado_oc, monto_neto, comision_pct, comision_monto, periodo)
  select c.user_id, c.id, o.id, coalesce(o.numero_oc, o.codigo), o.numero_licitacion, of.id,
         coalesce(o.fecha_envio_oc, o.fecha_emision, o.created_at), coalesce(o.demandante, o.organismo_comprador), o.estado,
         round(coalesce(o.neto, o.total / 1.19, o.monto_total / 1.19, 0)),
         coalesce(eb.comision_porcentaje, p.comision_porcentaje, 3),
         least(round(coalesce(o.neto, o.total / 1.19, o.monto_total / 1.19, 0) * coalesce(eb.comision_porcentaje, p.comision_porcentaje, 3) / 100), coalesce(eb.tope_comision, 300000)),
         to_char(coalesce(o.fecha_envio_oc, o.fecha_emision, o.created_at), 'YYYY-MM')
  from public.ordenes_compra o
  join public.clientes c on c.activo and c.rut is not null
       and (public.rut_cuerpo(c.rut) = public.rut_cuerpo(o.rut_proveedor) or regexp_replace(lower(c.rut), '[^0-9k]', '', 'g') = public.rut_cuerpo(o.rut_proveedor))
  join public.planes p on p.id = c.plan and p.id <> 'free'
  join lateral (select of1.id from public.cliente_ofertas of1
                 where of1.cliente_id = c.id and of1.estado = 'enviada' and of1.licitacion_id = o.numero_licitacion
                 order by of1.updated_at desc limit 1) of on true
  left join public.empresas_billing eb on eb.user_id = c.user_id
  where o.estado in ('5', '6', '12') and o.numero_licitacion is not null
    and not exists (select 1 from public.ventas_comisionables v where v.oc_id = o.id);
  get diagnostics n = row_count;
  update public.ventas_comisionables v set estado = 'anulada', updated_at = now()
  from public.ordenes_compra o
  where v.oc_id = o.id and o.estado = '9' and v.estado in ('pendiente', 'preforma');
  return n;
end $$;

-- Cierre de mes: preforma por cliente ERP con fijo + comisiones del periodo (por defecto el mes anterior).
create or replace function public.comisiones_cerrar_mes(p_periodo text default to_char(now() - interval '1 month', 'YYYY-MM'))
returns table (user_id uuid, cliente_id uuid, email text, periodo text, fijo numeric, comision numeric, total numeric, ocs integer)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with clientes_erp as (
    select c.id, c.user_id, c.email, p.precio_mensual
    from public.clientes c join public.planes p on p.id = c.plan
    where c.activo and p.id <> 'free' and c.user_id is not null),
  ventas as (
    select v.user_id, sum(v.monto_neto) neto, sum(v.comision_monto) comision, count(*)::int n,
           jsonb_agg(jsonb_build_object('oc', v.codigo_oc, 'licitacion', v.numero_licitacion, 'comprador', v.comprador, 'fecha', v.fecha_aceptacion, 'neto', v.monto_neto, 'comision', v.comision_monto) order by v.fecha_aceptacion) det
    from public.ventas_comisionables v where v.periodo = p_periodo and v.estado = 'pendiente' group by v.user_id),
  ins as (
    insert into public.facturas_comision (user_id, cliente_id, periodo, fecha_emision, fecha_vencimiento, fijo_monto, total_ventas, total_comision, total, estado, validacion_hasta, detalle)
    select ce.user_id, ce.id, p_periodo, current_date, current_date + 10, ce.precio_mensual, coalesce(ve.neto, 0), coalesce(ve.comision, 0),
           ce.precio_mensual + coalesce(ve.comision, 0), 'preforma', now() + interval '2 days',
           jsonb_build_object('ocs', coalesce(ve.det, '[]'::jsonb), 'n', coalesce(ve.n, 0))
    from clientes_erp ce left join ventas ve on ve.user_id = ce.user_id
    on conflict (user_id, periodo) do nothing
    returning *)
  select i.user_id, i.cliente_id, ce.email, i.periodo, i.fijo_monto, i.total_comision, i.total, (i.detalle->>'n')::int
  from ins i join clientes_erp ce on ce.user_id = i.user_id;
  update public.ventas_comisionables v set estado = 'preforma', factura_id = f.id, updated_at = now()
  from public.facturas_comision f
  where f.periodo = p_periodo and f.user_id = v.user_id and v.periodo = p_periodo and v.estado = 'pendiente';
end $$;

-- Tras la ventana de validacion la preforma pasa a "por facturar" (la factura la emite FirmaVB).
create or replace function public.comisiones_confirmar_preformas()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.facturas_comision set estado = 'por_facturar' where estado = 'preforma' and validacion_hasta < now();
  get diagnostics n = row_count;
  update public.ventas_comisionables v set estado = 'facturada', updated_at = now()
  from public.facturas_comision f where v.factura_id = f.id and f.estado = 'por_facturar' and v.estado = 'preforma';
  return n;
end $$;

revoke all on function public.comisiones_atribuir() from public, anon, authenticated;
revoke all on function public.comisiones_cerrar_mes(text) from public, anon, authenticated;
revoke all on function public.comisiones_confirmar_preformas() from public, anon, authenticated;
grant execute on function public.comisiones_atribuir(), public.comisiones_confirmar_preformas() to service_role;
grant execute on function public.comisiones_cerrar_mes(text) to service_role;

select cron.unschedule(jobid) from cron.job where jobname in ('comisiones-atribuir', 'comisiones-cerrar-mes', 'comisiones-confirmar');
select cron.schedule('comisiones-atribuir', '15 6 * * *', $$ select public.comisiones_atribuir(); $$);
select cron.schedule('comisiones-cerrar-mes', '0 7 1 * *', $$ select public.comisiones_cerrar_mes(); $$);
select cron.schedule('comisiones-confirmar', '30 7 * * *', $$ select public.comisiones_confirmar_preformas(); $$);
