-- Órdenes de compra: se guarda la CABECERA de todas las OC del día (unas 20 mil) y el
-- detalle con ítems solo de las relevantes al rubro de los clientes. `relevante` marca
-- cuáles entran a la cola de detalle. Las filas existentes eran todas relevantes.
alter table public.ordenes_compra
  add column if not exists relevante boolean not null default true;

create index if not exists idx_oc_pendientes_detalle
  on public.ordenes_compra (fecha_envio_oc desc nulls last)
  where organismo_comprador is null and relevante;

create index if not exists idx_oc_relevante_fecha
  on public.ordenes_compra (relevante, fecha_emision desc);
