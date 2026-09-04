-- Webinar "Cómo postular al Convenio Marco de SaaS y no morir en el intento" (martes 8 de
-- septiembre 2026, 19:00 hrs Chile). Inscripción pública desde www.firmavb.cl; al insertar,
-- se dispara el envío automático de la confirmación con el evento para el calendario.
create table if not exists public.webinar_inscripciones (
  id uuid primary key default gen_random_uuid(),
  evento_slug text not null default 'convenio-marco-saas-2026-09-08',
  nombre text not null,
  email text not null,
  whatsapp text,
  empresa text,
  creado_en timestamptz not null default now(),
  notificado boolean not null default false,
  unique (evento_slug, email)
);
alter table public.webinar_inscripciones enable row level security;

create policy webinar_inscripciones_insert_public on public.webinar_inscripciones
  for insert to anon, authenticated with check (true);
create policy webinar_inscripciones_select_admin on public.webinar_inscripciones
  for select to authenticated using ((auth.jwt() ->> 'email') = 'evaras@firmavb.cl');

create or replace function public.webinar_notificar_inscripcion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/webinar-confirmar',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := jsonb_build_object('id', new.id),
    timeout_milliseconds := 15000
  );
  return new;
end $$;

drop trigger if exists trg_webinar_notificar on public.webinar_inscripciones;
create trigger trg_webinar_notificar
  after insert on public.webinar_inscripciones
  for each row execute function public.webinar_notificar_inscripcion();
