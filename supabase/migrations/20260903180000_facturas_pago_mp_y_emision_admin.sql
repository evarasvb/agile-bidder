-- Pago de facturas (fijo + comisiones) por Mercado Pago y emision manual por el admin.
alter table public.experto_pagos add column if not exists factura_id uuid references public.facturas_comision(id);

create or replace function public.facturas_marcar_emitida(p_id uuid, p_numero text, p_url text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'evaras@firmavb.cl' then raise exception 'solo administrador'; end if;
  update public.facturas_comision set estado = 'facturada', numero_factura = p_numero, documento_url = coalesce(p_url, documento_url), fecha_emision = current_date
  where id = p_id and estado in ('preforma', 'por_facturar', 'facturada');
end $$;
grant execute on function public.facturas_marcar_emitida(uuid, text, text) to authenticated;

create or replace function public.facturas_admin()
returns table (id uuid, email text, empresa text, periodo text, fijo numeric, comision numeric, total numeric, estado text, numero_factura text, documento_url text, validacion_hasta timestamptz, ocs integer)
language sql stable security definer set search_path = public as $$
  select f.id, c.email, c.empresa_nombre, f.periodo, f.fijo_monto, f.total_comision, f.total, f.estado, f.numero_factura, f.documento_url, f.validacion_hasta, (f.detalle->>'n')::int
  from public.facturas_comision f left join public.clientes c on c.user_id = f.user_id
  where coalesce(auth.jwt() ->> 'email', '') = 'evaras@firmavb.cl' and f.estado in ('preforma', 'por_facturar', 'facturada')
  order by f.periodo desc, f.estado;
$$;
grant execute on function public.facturas_admin() to authenticated;
