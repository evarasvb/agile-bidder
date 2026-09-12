-- Add convenience functions to import contacts from existing webinar registrations
-- This enables marketing to reach webinar participants automatically

-- Create view for easy webinar subscriber contact import
create or replace view public.vw_webinar_contacts as
select
  distinct on (email)
  id::text,
  email,
  nombre,
  empresa,
  'webinar_inscrito' as categoria,
  'webinar' as fuente_datos,
  case when notificado then 'suscrito' else 'no_suscrito' end as estado_suscripcion,
  created_at
from public.webinar_inscripciones
where email is not null
order by email, created_at desc;

-- Function para importar suscriptores de webinars con un solo call
create or replace function public.marketing_importar_webinars()
returns table(importados int, duplicados int, errores int) language plpgsql security definer set search_path = public as $$
declare
  v_importados int := 0;
  v_duplicados int := 0;
  v_errores int := 0;
begin
  insert into public.marketing_contactos (email, nombre, empresa, categoria, fuente_datos, estado_suscripcion, estado_contacto, consentimiento_marketing, consentimiento_fecha)
  select
    wc.email,
    wc.nombre,
    wc.empresa,
    wc.categoria,
    wc.fuente_datos,
    wc.estado_suscripcion,
    'activo'::text,
    true,
    now()
  from public.vw_webinar_contacts wc
  on conflict (email) do update set
    fuente_datos = 'webinar',
    categoria = 'webinar_inscrito',
    actualizado_en = now();

  get diagnostics v_importados = row_count;

  -- Register audit
  insert into public.marketing_contactos_auditoria (accion, fuente, cantidad_registros, registros_exitosos)
  values ('importacion', 'webinar_inscripciones', v_importados, v_importados);

  return query select v_importados, 0::int, 0::int;
end $$;

-- Índice para mejorar queries en webinars
create index if not exists idx_webinar_inscripciones_email on public.webinar_inscripciones(email);
