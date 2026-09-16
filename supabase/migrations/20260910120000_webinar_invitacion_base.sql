-- Base de invitación al webinar recurrente "Véndele al Estado" (proveedores del Estado).
-- Se siembra desde los prospectos del CRM y se envía de a pocos (edge function webinar-invitar)
-- con opción de baja (edge function webinar-baja). Correo humano, de partner.
create table if not exists public.webinar_invitacion (
  id uuid primary key default gen_random_uuid(),
  campana text not null default 'vendele-al-estado',
  email text not null,
  nombre text,
  empresa text,
  estado text not null default 'pendiente',   -- pendiente | enviado | error | baja
  enviado_en timestamptz,
  intentos int not null default 0,
  error text,
  creado_en timestamptz not null default now(),
  unique (campana, email)
);
create index if not exists idx_webinar_invitacion_estado on public.webinar_invitacion (campana, estado);

alter table public.webinar_invitacion enable row level security;
do $$ begin
  if not exists (select 1 from pg_policy where polname='webinar_invitacion_admin' and polrelid='public.webinar_invitacion'::regclass) then
    create policy webinar_invitacion_admin on public.webinar_invitacion
      for select to authenticated using ((auth.jwt() ->> 'email') = 'evaras@firmavb.cl');
  end if;
end $$;

-- Siembra inicial desde prospects (correos válidos, sin duplicar, sin internos de firmavb).
insert into public.webinar_invitacion (email, nombre, empresa)
select distinct on (lower(trim(email)))
  lower(trim(email)) as email,
  nullif(trim(nombre), '') as nombre,
  nullif(trim(empresa), '') as empresa
from public.prospects
where email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  and email not ilike '%@firmavb.cl'
order by lower(trim(email)), created_at nulls last
on conflict (campana, email) do nothing;
