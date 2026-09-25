alter table public.facturas_por_cobrar
  add column if not exists factura_archivo_url text,
  add column if not exists factura_archivo_nombre text,
  add column if not exists guia_archivo_url text,
  add column if not exists guia_archivo_nombre text;
