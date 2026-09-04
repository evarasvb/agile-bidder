-- Comisión ERP: 3% del NETO de cada OC aceptada, sin topes (ni por OC ni mensual), más IVA 19% en la factura.
-- (Función completa aplicada en producción como comision_sin_topes_con_iva; aquí el resumen de cambios.)
update public.planes set comision_tope_mensual = null where id = 'pro';
alter table public.facturas_comision add column if not exists iva_comision numeric not null default 0;
comment on column public.facturas_comision.iva_comision is 'IVA 19% sobre la comisión neta del mes.';
-- comisiones_atribuir: el tope por OC solo aplica si empresas_billing.tope_comision está definido (antes: 300.000 por defecto).
-- comisiones_cerrar_mes: total = (fijo si no hay suscripción MP) + comisión neta + IVA 19%; detalle.iva_pct = 19.
