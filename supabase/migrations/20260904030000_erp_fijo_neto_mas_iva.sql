-- FirmaVB ERP: fijo $149.990 NETO + IVA (Mercado Pago cobra $178.488); comisión 3% del neto de cada OC + IVA.
-- facturas_comision.iva_fijo; comisiones_cerrar_mes: total = fijo + IVA fijo (si no hay suscripción) + comisión + IVA comisión.
-- Función completa aplicada en producción como erp_fijo_neto_mas_iva.
alter table public.facturas_comision add column if not exists iva_fijo numeric not null default 0;
comment on column public.facturas_comision.iva_fijo is 'IVA 19% sobre el fijo del mes (0 si el fijo lo cobra la suscripción de Mercado Pago).';
