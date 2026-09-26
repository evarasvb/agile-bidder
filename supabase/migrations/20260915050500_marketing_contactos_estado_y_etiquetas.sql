-- El panel de administración de contactos de marketing (MarketingContactosAdmin.tsx)
-- ya lee, escribe y filtra por estado_contacto y etiquetas desde hace tiempo, pero
-- estas columnas nunca se crearon: hoy esas consultas fallan (400 de PostgREST) y
-- la pantalla completa de contactos aparece vacía.
alter table public.marketing_contactos
  add column if not exists estado_contacto text not null default 'activo';

alter table public.marketing_contactos
  add column if not exists etiquetas text[];
