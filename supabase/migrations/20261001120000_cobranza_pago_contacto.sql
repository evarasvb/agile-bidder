-- CRM de cobranza: seguimiento del pago real y contacto del deudor.
-- - fecha_pago_real / monto_pagado: cuándo y cuánto pagó efectivamente el deudor,
--   para medir la diferencia de días (plazo vs. pago) y cerrar la cobranza.
-- - deudor_email: destinatario del borrador de cobro (nota de cobro / nota de
--   débito exenta) que luego se deja en el Gmail sincronizado del usuario.
-- Todo idempotente.

alter table public.facturas_por_cobrar
  add column if not exists fecha_pago_real date,
  add column if not exists monto_pagado numeric,
  add column if not exists deudor_email text;

-- La UI de cobranza calcula el interés moratorio real con calcular_interes_mora
-- (tramos mensuales de la tasa máxima convencional, Ley 18.010). La función es
-- SECURITY DEFINER; se asegura el permiso de ejecución para usuarios autenticados.
grant execute on function public.calcular_interes_mora(numeric, date, date) to authenticated;
