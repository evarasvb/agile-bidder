-- Experto Pro por pago unico (Mercado Pago Checkout Pro) y estudio profundo por organismo.
-- Dos lineas: "one shot" gratis (chat/informe con limites) y Pro (estudio profundo y sin limites),
-- que se activa 30 dias por cada pago aprobado (experto_pro), ademas del plan de clientes por suscripcion.
create table if not exists public.experto_pro (
  user_id uuid primary key,
  hasta timestamptz not null,
  origen text,
  updated_at timestamptz not null default now()
);
alter table public.experto_pro enable row level security;
drop policy if exists experto_pro_propio on public.experto_pro;
create policy experto_pro_propio on public.experto_pro for select to authenticated using (user_id = auth.uid());

create table if not exists public.experto_pagos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  producto text not null,
  monto numeric not null,
  moneda text not null default 'CLP',
  estado text not null default 'pendiente',
  mp_preference_id text,
  mp_payment_id text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.experto_pagos enable row level security;
drop policy if exists experto_pagos_propios on public.experto_pagos;
create policy experto_pagos_propios on public.experto_pagos for select to authenticated using (user_id = auth.uid());

create or replace function public.experto_activar_pro(p_user_id uuid, p_dias integer, p_origen text)
returns timestamptz language sql security definer set search_path = public as $$
  insert into public.experto_pro (user_id, hasta, origen, updated_at)
  values (p_user_id, now() + make_interval(days => p_dias), p_origen, now())
  on conflict (user_id) do update
    set hasta = greatest(public.experto_pro.hasta, now()) + make_interval(days => p_dias), origen = excluded.origen, updated_at = now()
  returning hasta;
$$;
revoke all on function public.experto_activar_pro(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.experto_activar_pro(uuid, integer, text) to service_role;

-- Plan: Pro pagado (experto_pro vigente) o plan del cliente (suscripcion); si no, free.
create or replace function public.experto_uso_mes(p_user_id uuid, p_huella text)
returns table (consultas integer, informes integer, plan text)
language sql stable security definer set search_path = public, experto as $$
  select
    (select count(*)::int from experto.consultas c where c.creado_en >= date_trunc('month', now()) and ((p_user_id is not null and c.user_id = p_user_id) or (p_user_id is null and c.huella = p_huella)) and c.modo = 'chat'),
    (select count(*)::int from experto.consultas c where c.creado_en >= date_trunc('month', now()) and ((p_user_id is not null and c.user_id = p_user_id) or (p_user_id is null and c.huella = p_huella)) and c.modo = 'informe'),
    coalesce(
      (select 'pro' from public.experto_pro e where e.user_id = p_user_id and e.hasta > now()),
      (select cl.plan from public.clientes cl where cl.user_id = p_user_id and cl.activo and cl.plan <> 'free' limit 1),
      'free');
$$;

-- Historial de procesos parecidos de un organismo (OCDS + licitaciones_bi) para el estudio profundo.
create or replace function public.experto_estudio_organismo(p_rut text, p_texto text, p_meses integer default 36, p_cantidad integer default 40)
returns table (codigo text, titulo text, fecha timestamptz, estado text, monto_estimado numeric, num_oferentes integer, oferentes text, adjudicatario text, adjudicatario_rut text, monto_adjudicado numeric, similitud real, fuente text)
language sql stable security definer set search_path = public, extensions as $$
  with q as (select lower(unaccent(coalesce(p_texto, ''))) t)
  select * from (
    select o.codigo, o.titulo, coalesce(o.fecha_publicacion, o.fecha_cierre)::timestamptz as fecha, coalesce(nullif(o.estado_award, ''), o.estado_tender) as estado, o.monto_estimado, o.num_oferentes,
           (select string_agg(x->>'nombre', ', ') from jsonb_array_elements(coalesce(o.oferentes, '[]'::jsonb)) x) as oferentes,
           (select string_agg(x->>'nombre', ', ') from jsonb_array_elements(coalesce(o.adjudicatarios, '[]'::jsonb)) x) as adjudicatario,
           (select string_agg(x->>'rut', ', ') from jsonb_array_elements(coalesce(o.adjudicatarios, '[]'::jsonb)) x) as adjudicatario_rut,
           o.monto_adjudicado,
           similarity(lower(unaccent(coalesce(o.titulo, ''))), q.t)::real as similitud, 'ocds'::text as fuente
    from public.ocds_procesos o, q
    where o.comprador_rut = p_rut and coalesce(o.fecha_publicacion, o.fecha_cierre) >= now() - make_interval(months => p_meses)
      and (q.t = '' or similarity(lower(unaccent(coalesce(o.titulo, ''))), q.t) > 0.2)
    union all
    select b.codigo, b.nombre, b.fecha_publicacion::timestamptz, b.estado, null, null, null, null, null, null,
           similarity(lower(unaccent(coalesce(b.nombre, ''))), q.t)::real, 'bi'::text
    from public.licitaciones_bi b, q
    where b.institucion_rut = p_rut and b.fecha_publicacion >= now() - make_interval(months => p_meses)
      and not exists (select 1 from public.ocds_procesos o where o.codigo = b.codigo)
      and (q.t = '' or similarity(lower(unaccent(coalesce(b.nombre, ''))), q.t) > 0.2)
  ) h
  order by h.similitud desc, h.fecha desc
  limit least(p_cantidad, 60);
$$;
revoke all on function public.experto_estudio_organismo(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.experto_estudio_organismo(text, text, integer, integer) to service_role;
