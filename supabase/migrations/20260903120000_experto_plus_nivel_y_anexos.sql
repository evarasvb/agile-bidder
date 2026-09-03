-- Experto Plus ($100.000 / 30 dias): nivel en experto_pro, plan 'plus' en uso_mes y mi_plan,
-- y tabla de anexos generados.
alter table public.experto_pro add column if not exists nivel text not null default 'pro';

create or replace function public.experto_activar_pro(p_user_id uuid, p_dias integer, p_origen text, p_nivel text default 'pro')
returns timestamptz language sql security definer set search_path = public as $$
  insert into public.experto_pro (user_id, hasta, origen, nivel, updated_at)
  values (p_user_id, now() + make_interval(days => p_dias), p_origen, p_nivel, now())
  on conflict (user_id) do update
    set hasta = greatest(public.experto_pro.hasta, now()) + make_interval(days => p_dias),
        origen = excluded.origen,
        nivel = case when excluded.nivel = 'plus' or public.experto_pro.nivel = 'plus' then 'plus' else 'pro' end,
        updated_at = now()
  returning hasta;
$$;
revoke all on function public.experto_activar_pro(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.experto_activar_pro(uuid, integer, text, text) to service_role;

create or replace function public.experto_uso_mes(p_user_id uuid, p_huella text)
returns table (consultas integer, informes integer, plan text)
language sql stable security definer set search_path = public, experto as $$
  select
    (select count(*)::int from experto.consultas c where c.creado_en >= date_trunc('month', now()) and ((p_user_id is not null and c.user_id = p_user_id) or (p_user_id is null and c.huella = p_huella)) and c.modo = 'chat'),
    (select count(*)::int from experto.consultas c where c.creado_en >= date_trunc('month', now()) and ((p_user_id is not null and c.user_id = p_user_id) or (p_user_id is null and c.huella = p_huella)) and c.modo = 'informe'),
    coalesce(
      (select e.nivel from public.experto_pro e where e.user_id = p_user_id and e.hasta > now()),
      (select cl.plan from public.clientes cl where cl.user_id = p_user_id and cl.activo and cl.plan <> 'free' limit 1),
      'free');
$$;

create or replace function public.experto_mi_plan()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select e.nivel from public.experto_pro e where e.user_id = auth.uid() and e.hasta > now()),
    (select cl.plan from public.clientes cl where cl.user_id = auth.uid() and cl.activo and cl.plan <> 'free' limit 1),
    'free');
$$;

create table if not exists public.experto_anexos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  codigo text not null,
  contenido text not null,
  faltantes jsonb,
  creado_en timestamptz not null default now()
);
alter table public.experto_anexos enable row level security;
drop policy if exists experto_anexos_propios on public.experto_anexos;
create policy experto_anexos_propios on public.experto_anexos for select to authenticated using (user_id = auth.uid());
