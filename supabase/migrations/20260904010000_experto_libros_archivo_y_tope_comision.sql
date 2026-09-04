-- Libros del Experto: se guardan todos (sin límite), se pueden archivar y buscar.
-- Comisión ERP: tope mensual configurable por plan (null = sin tope; se activa cambiando el dato).
create table if not exists experto.libros_meta (
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo text not null,
  archivado boolean not null default false,
  nota text,
  actualizado_en timestamptz not null default now(),
  primary key (user_id, codigo)
);
alter table experto.libros_meta enable row level security;

create or replace function public.experto_libro_archivar(p_codigo text, p_archivado boolean default true)
returns void language sql security definer set search_path to 'public', 'experto' as $$
  insert into experto.libros_meta (user_id, codigo, archivado, actualizado_en)
  select auth.uid(), upper(p_codigo), p_archivado, now() where auth.uid() is not null
  on conflict (user_id, codigo) do update set archivado = excluded.archivado, actualizado_en = now();
$$;
grant execute on function public.experto_libro_archivar(text, boolean) to authenticated;

drop function if exists public.experto_mis_libros();
create or replace function public.experto_mis_libros(p_archivados boolean default false, p_buscar text default null)
returns table(codigo text, nombre text, institucion text, cierre timestamptz, ultima timestamptz, consultas integer, archivado boolean)
language sql stable security definer set search_path to 'public', 'experto' as $$
  select c.licitacion, l.nombre, l.institucion_nombre, l.fecha_cierre, max(c.creado_en), count(*)::int, coalesce(m.archivado, false)
  from experto.consultas c
  left join public.licitaciones_bi l on l.codigo = c.licitacion
  left join experto.libros_meta m on m.user_id = c.user_id and m.codigo = upper(c.licitacion)
  where c.user_id = auth.uid() and c.licitacion is not null
    and coalesce(m.archivado, false) = p_archivados
    and (p_buscar is null or btrim(p_buscar) = '' or c.licitacion ilike '%' || p_buscar || '%' or l.nombre ilike '%' || p_buscar || '%' or l.institucion_nombre ilike '%' || p_buscar || '%')
  group by c.licitacion, l.nombre, l.institucion_nombre, l.fecha_cierre, m.archivado
  order by max(c.creado_en) desc limit 200;
$$;
grant execute on function public.experto_mis_libros(boolean, text) to authenticated;

alter table public.planes add column if not exists comision_tope_mensual numeric;
comment on column public.planes.comision_tope_mensual is 'Tope mensual de comisión en pesos (null = sin tope).';

create or replace function public.comisiones_cerrar_mes(p_periodo text default to_char((now() - '1 mon'::interval), 'YYYY-MM'))
returns table(user_id uuid, cliente_id uuid, email text, periodo text, fijo numeric, comision numeric, total numeric, ocs integer)
language plpgsql security definer set search_path to 'public' as $function$
begin
  return query
  with clientes_erp as (
    select c.id, c.user_id, c.email, p.precio_mensual, p.comision_tope_mensual,
           exists (select 1 from public.suscripciones s where s.cliente_id = c.id and s.estado = 'authorized' and s.mp_preapproval_id is not null) as con_suscripcion
    from public.clientes c join public.planes p on p.id = c.plan
    where c.activo and p.id <> 'free' and c.user_id is not null),
  ventas as (
    select v.user_id, sum(v.monto_neto) neto, sum(v.comision_monto) comision, count(*)::int n,
           jsonb_agg(jsonb_build_object('oc', v.codigo_oc, 'licitacion', v.numero_licitacion, 'comprador', v.comprador, 'fecha', v.fecha_aceptacion, 'neto', v.monto_neto, 'comision', v.comision_monto) order by v.fecha_aceptacion) det
    from public.ventas_comisionables v where v.periodo = p_periodo and v.estado = 'pendiente' group by v.user_id),
  calc as (
    select ce.*, coalesce(ve.neto, 0) neto, coalesce(ve.det, '[]'::jsonb) det, coalesce(ve.n, 0) n,
           -- comisión del mes con tope si el plan lo define
           case when ce.comision_tope_mensual is not null then least(coalesce(ve.comision, 0), ce.comision_tope_mensual) else coalesce(ve.comision, 0) end as comision_mes
    from clientes_erp ce left join ventas ve on ve.user_id = ce.user_id),
  ins as (
    insert into public.facturas_comision (user_id, cliente_id, periodo, fecha_emision, fecha_vencimiento, fijo_monto, total_ventas, total_comision, total, estado, validacion_hasta, detalle, por_suscripcion)
    select ca.user_id, ca.id, p_periodo, current_date, current_date + 10, ca.precio_mensual, ca.neto, ca.comision_mes,
           case when ca.con_suscripcion then ca.comision_mes else ca.precio_mensual + ca.comision_mes end,
           'preforma', now() + interval '2 days',
           jsonb_build_object('ocs', ca.det, 'n', ca.n, 'tope', ca.comision_tope_mensual),
           ca.con_suscripcion
    from calc ca
    on conflict (user_id, periodo) do nothing
    returning *)
  select i.user_id, i.cliente_id, ce.email, i.periodo, i.fijo_monto, i.total_comision, i.total, (i.detalle->>'n')::int
  from ins i join clientes_erp ce on ce.user_id = i.user_id;
  update public.ventas_comisionables v set estado = 'preforma', factura_id = f.id, updated_at = now()
  from public.facturas_comision f where f.periodo = p_periodo and f.user_id = v.user_id and v.periodo = p_periodo and v.estado = 'pendiente';
end $function$;
