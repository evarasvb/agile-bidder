-- Detalle completo de cada compra ágil (API v2 ChileCompra, /compra-agil/{codigo}).
-- Antes el enriquecedor guardaba solo la lista de productos y botaba descripción,
-- entrega, ofertas recibidas, adjuntos, unidad de compra y tipo de presupuesto.
alter table public.compras_agiles
  add column if not exists unidad_compra text,
  add column if not exists ofertas_recibidas integer,
  add column if not exists documentos jsonb,
  add column if not exists detalle_actualizado_at timestamptz;

-- Pendientes = abiertas a las que nunca se les bajó el detalle completo. Se ordenan
-- por cierre más próximo para que lo urgente se enriquezca primero.
create index if not exists idx_ca_pendientes_detalle
  on public.compras_agiles (fecha_cierre)
  where detalle_actualizado_at is null;

create or replace function public.compras_agiles_pendientes_items(p_limit integer default 60)
returns table(id bigint, codigo text)
language sql security definer set search_path to 'public'
as $$
  select c.id, c.codigo
  from public.compras_agiles c
  where (c.estado ilike 'publicada' or c.estado ilike 'activa')
    and c.fecha_cierre > now() and c.codigo is not null
    and c.detalle_actualizado_at is null
  order by c.fecha_cierre asc
  limit greatest(1, least(p_limit, 100));
$$;

-- Cron aplicado en producción (documentado aquí, no se ejecuta en la migración):
--   enrich-ca-items-cron (job 55): cada 5 min, body {"limit":60}; la función procesa de a 4
--   en paralelo con presupuesto de 45 s. Con esto el atraso de ~5.900 compras abiertas sin
--   detalle se limpia en pocas horas en vez de un día.
