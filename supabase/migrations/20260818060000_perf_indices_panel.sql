-- =====================================================================
-- Rendimiento del Panel de Oportunidades y de Órdenes de Compra
-- =====================================================================
-- El panel filtraba las licitaciones activas con `fecha_cierre > now()` sobre
-- licitaciones_bi (128k filas) SIN índice de fecha_cierre => Seq Scan de ~2.1 s.
-- Con este índice el planner hace Index Scan (solo ~4.2k activas) => ~20 ms.
--
-- La página de Órdenes de Compra ordena por fecha_emision sobre 22k filas SIN
-- índice => Seq Scan + sort de ~865 ms. Con el índice desc => ~2 ms.

create index if not exists idx_licbi_fecha_cierre
  on public.licitaciones_bi (fecha_cierre);

create index if not exists idx_oc_fecha_emision
  on public.ordenes_compra (fecha_emision desc nulls last);
