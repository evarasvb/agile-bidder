-- Marketing Control Center: planificación, ejecución y métricas de campañas
-- Permite automatización completa: plan → execute → monitor → improve

create table if not exists public.marketing_campanas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  objetivo text not null,
  estado text not null default 'draft', -- draft, scheduled, ejecutando, completada, cancelada
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  presupuesto numeric,
  audiencia_estimada int,
  meta_conversiones int,
  meta_registros int,
  meta_asistencia int,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por text,
  notas text
);
alter table public.marketing_campanas enable row level security;
create policy marketing_campanas_all on public.marketing_campanas
  for all to authenticated using ((auth.jwt() ->> 'email') = 'evaras@firmavb.cl');

create table if not exists public.marketing_piezas (
  id uuid primary key default gen_random_uuid(),
  campana_id uuid not null references public.marketing_campanas(id) on delete cascade,
  nombre text not null,
  tipo text not null, -- email, whatsapp, linkedin, instagram, tiktok, web
  canal text not null,
  asunto text,
  contenido text not null,
  url_tracking text,
  programado_para timestamptz,
  estado text not null default 'draft', -- draft, programado, ejecutado, enviado, fallido
  cantidad_objetivo int,
  creado_en timestamptz not null default now(),
  unique (campana_id, nombre)
);
alter table public.marketing_piezas enable row level security;
create policy marketing_piezas_all on public.marketing_piezas
  for all to authenticated using ((auth.jwt() ->> 'email') = 'evaras@firmavb.cl');

create table if not exists public.marketing_contactos (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nombre text,
  telefono text,
  empresa text,
  categoria text, -- lead, contacto, cliente, webinar_asistente, webinar_no_asistente
  origen text, -- formulario, lista, webinar, directo
  estado_suscripcion text default 'suscrito', -- suscrito, no_suscrito, bloqueado
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
alter table public.marketing_contactos enable row level security;
create policy marketing_contactos_all on public.marketing_contactos
  for all to authenticated using ((auth.jwt() ->> 'email') = 'evaras@firmavb.cl');

create table if not exists public.marketing_ejecucion (
  id uuid primary key default gen_random_uuid(),
  pieza_id uuid not null references public.marketing_piezas(id) on delete cascade,
  contacto_id uuid references public.marketing_contactos(id) on delete set null,
  email text,
  estado text not null default 'pendiente', -- pendiente, enviado, entregado, click, fallo, rebote
  respuesta_codigo int,
  respuesta_mensaje text,
  id_externo text,
  abierto boolean default false,
  clicks int default 0,
  conversiones int default 0,
  fecha_envio timestamptz,
  fecha_respuesta timestamptz,
  creado_en timestamptz not null default now()
);
alter table public.marketing_ejecucion enable row level security;
create policy marketing_ejecucion_all on public.marketing_ejecucion
  for all to authenticated using ((auth.jwt() ->> 'email') = 'evaras@firmavb.cl');

create table if not exists public.marketing_metricas (
  id uuid primary key default gen_random_uuid(),
  campana_id uuid not null references public.marketing_campanas(id) on delete cascade,
  fecha date not null,
  total_enviados int default 0,
  total_entregados int default 0,
  total_abiertos int default 0,
  total_clicks int default 0,
  total_conversiones int default 0,
  tasa_entrega numeric,
  tasa_apertura numeric,
  tasa_click numeric,
  tasa_conversion numeric,
  actualizado_en timestamptz not null default now(),
  unique (campana_id, fecha)
);
alter table public.marketing_metricas enable row level security;
create policy marketing_metricas_all on public.marketing_metricas
  for all to authenticated using ((auth.jwt() ->> 'email') = 'evaras@firmavb.cl');

-- Índices para performance
create index idx_marketing_piezas_campana_estado on public.marketing_piezas(campana_id, estado);
create index idx_marketing_ejecucion_pieza_estado on public.marketing_ejecucion(pieza_id, estado);
create index idx_marketing_ejecucion_contacto on public.marketing_ejecucion(contacto_id);
create index idx_marketing_contactos_email on public.marketing_contactos(email);
create index idx_marketing_metricas_campana_fecha on public.marketing_metricas(campana_id, fecha);

-- Function para calcular métricas diarias
create or replace function public.marketing_calcular_metricas(campana_id_in uuid, fecha_in date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_enviados int;
  v_entregados int;
  v_abiertos int;
  v_clicks int;
  v_conversiones int;
begin
  select
    count(*),
    sum(case when estado in ('enviado', 'entregado', 'abierto', 'click') then 1 else 0 end),
    sum(case when abierto then 1 else 0 end),
    sum(clicks),
    sum(conversiones)
  into v_enviados, v_entregados, v_abiertos, v_clicks, v_conversiones
  from public.marketing_ejecucion me
  join public.marketing_piezas mp on me.pieza_id = mp.id
  where mp.campana_id = campana_id_in
    and date(me.fecha_envio) = fecha_in;

  insert into public.marketing_metricas (campana_id, fecha, total_enviados, total_entregados, total_abiertos, total_clicks, total_conversiones)
  values (
    campana_id_in,
    fecha_in,
    coalesce(v_enviados, 0),
    coalesce(v_entregados, 0),
    coalesce(v_abiertos, 0),
    coalesce(v_clicks, 0),
    coalesce(v_conversiones, 0)
  )
  on conflict (campana_id, fecha) do update set
    total_enviados = excluded.total_enviados,
    total_entregados = excluded.total_entregados,
    total_abiertos = excluded.total_abiertos,
    total_clicks = excluded.total_clicks,
    total_conversiones = excluded.total_conversiones,
    actualizado_en = now();
end $$;

-- Trigger para sincronizar automáticamente cada nueva inscripción de webinar
create or replace function public.marketing_sincronizar_webinar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.marketing_contactos (email, nombre, empresa, categoria, origen, estado_suscripcion)
  values (
    new.email,
    new.nombre,
    new.empresa,
    case when new.notificado then 'webinar_asistente' else 'webinar_no_asistente' end,
    'webinar',
    'suscrito'
  )
  on conflict (email) do update set
    categoria = case
      when new.notificado then 'webinar_asistente'
      else 'webinar_no_asistente'
    end,
    actualizado_en = now();
  return new;
end $$;

drop trigger if exists trg_marketing_sincronizar_webinar on public.webinar_inscripciones;
create trigger trg_marketing_sincronizar_webinar
  after insert or update on public.webinar_inscripciones
  for each row execute function public.marketing_sincronizar_webinar();

-- Sincroniza contactos existentes del webinar
insert into public.marketing_contactos (email, nombre, empresa, categoria, origen, estado_suscripcion)
select
  email,
  nombre,
  empresa,
  case when notificado then 'webinar_asistente' else 'webinar_no_asistente' end,
  'webinar',
  'suscrito'
from public.webinar_inscripciones
on conflict (email) do nothing;
