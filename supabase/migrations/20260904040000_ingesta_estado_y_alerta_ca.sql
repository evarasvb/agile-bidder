-- Marca de agua de las ingestas por tandas y alerta cuando compras ágiles deja de entrar.
create table if not exists public.ingesta_estado (
  clave text primary key,
  valor jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.ingesta_estado enable row level security;

-- Alerta: si en 6 horas no entró ninguna compra ágil, queda un error en system_logs (el admin lo ve en el indicador).
create or replace function public.alerta_ingesta_compras_agiles()
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_ultima timestamptz; v_msg text;
begin
  select max(created_at) into v_ultima from public.compras_agiles;
  if v_ultima is null or v_ultima < now() - interval '6 hours' then
    v_msg := format('[alerta-ingesta-ca] Compras ágiles sin ingesta desde %s (%s horas). Revisar ticket de Mercado Público y fetch-compras-agiles-v2.', to_char(v_ultima, 'DD-MM-YYYY HH24:MI'), round(extract(epoch from now() - v_ultima) / 3600));
    if not exists (select 1 from public.system_logs where mensaje like '[alerta-ingesta-ca]%' and created_at > now() - interval '6 hours') then
      insert into public.system_logs (tipo, severidad, mensaje, detalles) values ('scraping', 'error', v_msg, jsonb_build_object('ultima_insercion', v_ultima));
    end if;
    return v_msg;
  end if;
  return 'ok: última ' || to_char(v_ultima, 'DD-MM-YYYY HH24:MI');
end $$;

-- Crones: ingesta cada 15 min en tandas de 6 páginas; ítems cada 5 min de a 25; alerta cada hora (aplicado en prod).
-- select cron.alter_job(10, schedule := '*/15 * * * *', ...max_paginas 6...); cron.alter_job(17, '*/5 * * * *', limit 25); cron.schedule('alerta-ingesta-ca', '5 * * * *', 'select public.alerta_ingesta_compras_agiles();');
