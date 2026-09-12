-- YouTube channel tracking for marketing campaigns
-- Allows syncing YouTube subscribers as marketing contacts

create table if not exists public.youtube_channels (
  id uuid primary key default gen_random_uuid(),
  canal_id text not null unique, -- YouTube channel ID (format: UC...)
  nombre text not null,
  descripcion text,
  url_canal text,
  foto_perfil text,
  suscriptores_estimados int,
  estado text not null default 'conectado', -- conectado, desconectado, error
  access_token text, -- encrypted JWT para API calls
  refresh_token text,
  token_expira_en timestamptz,
  ultima_sincronizacion timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.youtube_channels enable row level security;
create policy youtube_channels_admin on public.youtube_channels
  for all to authenticated using ((auth.jwt() ->> 'email') = 'evaras@firmavb.cl');

-- Sincroniza suscriptores de YouTube como contactos de marketing
create table if not exists public.youtube_subscribers (
  id uuid primary key default gen_random_uuid(),
  canal_id uuid not null references public.youtube_channels(id) on delete cascade,
  contacto_id uuid references public.marketing_contactos(id) on delete set null,
  channel_user_id text not null, -- ID del suscriptor en YouTube
  nombre text,
  email text,
  foto_perfil text,
  estado_suscripcion text default 'activo', -- activo, cancelado, spam
  fecha_suscripcion timestamptz,
  ultima_actividad timestamptz,
  creado_en timestamptz not null default now(),
  unique(canal_id, channel_user_id)
);

alter table public.youtube_subscribers enable row level security;
create policy youtube_subscribers_admin on public.youtube_subscribers
  for all to authenticated using ((auth.jwt() ->> 'email') = 'evaras@firmavb.cl');

-- Function para sincronizar suscriptores de YouTube a marketing_contactos
create or replace function public.youtube_sincronizar_suscriptores(p_canal_id uuid)
returns table(sincronizados int, duplicados int, errores int) language plpgsql security definer set search_path = public as $$
declare
  v_sincronizados int := 0;
  v_duplicados int := 0;
  v_errores int := 0;
  v_row record;
begin
  for v_row in
    select id, nombre, email from public.youtube_subscribers
    where canal_id = p_canal_id and email is not null
  loop
    begin
      insert into public.marketing_contactos (email, nombre, categoria, fuente_datos, estado_suscripcion, campos_adicionales)
      values (
        v_row.email,
        v_row.nombre,
        'youtube_subscriber',
        'youtube',
        'suscrito',
        jsonb_build_object('youtube_subscriber_id', v_row.id::text)
      )
      on conflict (email) do update set
        categoria = case when marketing_contactos.categoria != 'youtube_subscriber'
          then 'youtube_subscriber' else marketing_contactos.categoria end,
        fuente_datos = 'youtube',
        actualizado_en = now();

      v_sincronizados := v_sincronizados + 1;
    exception when unique_violation then
      v_duplicados := v_duplicados + 1;
    exception when others then
      v_errores := v_errores + 1;
    end;
  end loop;

  -- Update last sync time
  update public.youtube_channels set ultima_sincronizacion = now() where id = p_canal_id;

  return query select v_sincronizados, v_duplicados, v_errores;
end $$;

-- Índices para performance
create index idx_youtube_subscribers_canal on public.youtube_subscribers(canal_id);
create index idx_youtube_subscribers_contacto on public.youtube_subscribers(contacto_id);
create index idx_youtube_channels_estado on public.youtube_channels(estado);
