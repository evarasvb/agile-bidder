-- Lanzamiento comercial del Experto.
-- Fase activa: beta_10. Las primeras 10 cuentas que USAN el Experto reciben
-- acceso equivalente a Plus. La prueba de 14 dias y el pago quedan conservados
-- pero dormidos hasta cambiar la fase a 'monetizacion'.

create table if not exists public.experto_lanzamiento_config (
  id smallint primary key default 1 check (id = 1),
  fase text not null default 'beta_10' check (fase in ('beta_10', 'monetizacion')),
  cupos_beta integer not null default 10 check (cupos_beta between 1 and 1000),
  updated_at timestamptz not null default now()
);
insert into public.experto_lanzamiento_config (id, fase, cupos_beta)
values (1, 'beta_10', 10) on conflict (id) do nothing;
alter table public.experto_lanzamiento_config enable row level security;
revoke all on table public.experto_lanzamiento_config from public, anon, authenticated;

create table if not exists public.experto_beta_usuarios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  posicion integer not null unique check (posicion > 0),
  ingresado_en timestamptz not null default now()
);
alter table public.experto_beta_usuarios enable row level security;
revoke all on table public.experto_beta_usuarios from public, anon, authenticated;

-- Reserva atomica: el bloqueo de configuracion impide entregar el ultimo cupo
-- a dos usuarios concurrentes. Solo service_role puede indicar el user_id.
create or replace function public.experto_beta_reclamar_usuario(p_user_id uuid)
returns table (fase text, permitido boolean, es_beta boolean, cupos_usados integer, cupos_maximos integer, posicion integer)
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_fase text;
  v_max integer;
  v_usados integer;
  v_pos integer;
  v_tiene_plan boolean;
begin
  select c.fase, c.cupos_beta into v_fase, v_max
    from public.experto_lanzamiento_config c where c.id = 1 for update;
  select count(*)::integer into v_usados from public.experto_beta_usuarios;

  if p_user_id is null then
    return query select v_fase, false, false, v_usados, v_max, null::integer;
    return;
  end if;

  select b.posicion into v_pos from public.experto_beta_usuarios b where b.user_id = p_user_id;
  if v_fase <> 'beta_10' then
    return query select v_fase, false, v_pos is not null, v_usados, v_max, v_pos;
    return;
  end if;

  select exists (
    select 1 from public.experto_pro e where e.user_id = p_user_id and e.hasta > now()
    union all
    select 1 from public.clientes cl where cl.user_id = p_user_id and cl.activo and cl.plan <> 'free'
  ) into v_tiene_plan;
  if v_tiene_plan then
    return query select v_fase, true, false, v_usados, v_max, null::integer;
    return;
  end if;

  if v_pos is null and v_usados < v_max then
    v_pos := v_usados + 1;
    insert into public.experto_beta_usuarios (user_id, posicion)
    values (p_user_id, v_pos) on conflict (user_id) do nothing;
    select b.posicion into v_pos from public.experto_beta_usuarios b where b.user_id = p_user_id;
    select count(*)::integer into v_usados from public.experto_beta_usuarios;
  end if;

  return query select v_fase, v_pos is not null, v_pos is not null, v_usados, v_max, v_pos;
end;
$$;
revoke all on function public.experto_beta_reclamar_usuario(uuid) from public, anon, authenticated;
grant execute on function public.experto_beta_reclamar_usuario(uuid) to service_role;

-- Wrapper autenticado: entrar al espacio del Experto reclama el cupo. Crear una
-- cuenta o visitar precios no lo hace.
create or replace function public.experto_beta_reclamar()
returns table (fase text, permitido boolean, es_beta boolean, cupos_usados integer, cupos_maximos integer, posicion integer)
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesion'; end if;
  return query select * from public.experto_beta_reclamar_usuario(auth.uid());
end;
$$;
revoke all on function public.experto_beta_reclamar() from public, anon;
grant execute on function public.experto_beta_reclamar() to authenticated;

-- Estado publico, sin datos personales, para que la interfaz cambie de etapa
-- desde Postgres y muestre el avance de la beta.
create or replace function public.experto_lanzamiento_publico()
returns table (fase text, cupos_usados integer, cupos_maximos integer)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select c.fase, (select count(*)::integer from public.experto_beta_usuarios), c.cupos_beta
    from public.experto_lanzamiento_config c where c.id = 1;
$$;
revoke all on function public.experto_lanzamiento_publico() from public;
grant execute on function public.experto_lanzamiento_publico() to anon, authenticated, service_role;

-- La prueba de 14 dias se conserva exactamente para monetizacion, pero no se
-- puede iniciar (ni aparece disponible) mientras la fase sea beta_10.
create or replace function public.experto_prueba_estado()
returns table (disponible boolean, usada_en timestamptz, hasta timestamptz)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select ((select c.fase = 'monetizacion' from public.experto_lanzamiento_config c where c.id = 1)
          and auth.uid() is not null
          and not exists (select 1 from public.experto_pruebas p where p.user_id = auth.uid())
          and not exists (select 1 from public.experto_pro e where e.user_id = auth.uid() and e.hasta > now())
          and not exists (select 1 from public.clientes c where c.user_id = auth.uid() and c.activo and c.plan <> 'free')),
         (select p.iniciada_en from public.experto_pruebas p where p.user_id = auth.uid()),
         (select p.hasta from public.experto_pruebas p where p.user_id = auth.uid());
$$;
revoke all on function public.experto_prueba_estado() from public, anon;
grant execute on function public.experto_prueba_estado() to authenticated;

create or replace function public.experto_prueba_iniciar()
returns timestamptz language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_hasta timestamptz;
begin
  if auth.uid() is null then raise exception 'login'; end if;
  if not exists (select 1 from public.experto_lanzamiento_config c where c.id = 1 and c.fase = 'monetizacion') then
    raise exception 'La prueba Pro todavía no está activa: estamos trabajando gratis con los 10 clientes de la beta inicial.';
  end if;
  if exists (select 1 from public.experto_pruebas p where p.user_id = auth.uid()) then raise exception 'La prueba gratis ya se usó en esta cuenta.'; end if;
  if exists (select 1 from public.experto_pro e where e.user_id = auth.uid() and e.hasta > now()) then raise exception 'Ya tienes Experto Pro activo.'; end if;
  v_hasta := public.experto_activar_pro(auth.uid(), 14, 'prueba', 'pro');
  insert into public.experto_pruebas (user_id, hasta) values (auth.uid(), v_hasta);
  return v_hasta;
end;
$$;
revoke all on function public.experto_prueba_iniciar() from public, anon;
grant execute on function public.experto_prueba_iniciar() to authenticated;

-- En beta, los miembros reciben capacidad Plus en todos los RPC y Edge
-- Functions existentes. Los planes pagados y ERP conservan prioridad.
create or replace function public.experto_uso_mes(p_user_id uuid, p_huella text)
returns table (consultas integer, informes integer, plan text)
language sql stable security definer
set search_path = public, experto, pg_temp
as $$
  select
    (select count(*)::int from experto.consultas c where c.creado_en >= date_trunc('month', now()) and ((p_user_id is not null and c.user_id = p_user_id) or (p_user_id is null and c.huella = p_huella)) and c.modo = 'chat'),
    (select count(*)::int from experto.consultas c where c.creado_en >= date_trunc('month', now()) and ((p_user_id is not null and c.user_id = p_user_id) or (p_user_id is null and c.huella = p_huella)) and c.modo = 'informe'),
    coalesce(
      (select e.nivel from public.experto_pro e where e.user_id = p_user_id and e.hasta > now()),
      (select cl.plan from public.clientes cl where cl.user_id = p_user_id and cl.activo and cl.plan <> 'free' limit 1),
      (select 'plus' from public.experto_beta_usuarios b join public.experto_lanzamiento_config lc on lc.id = 1 and lc.fase = 'beta_10' where b.user_id = p_user_id),
      'free');
$$;
revoke all on function public.experto_uso_mes(uuid, text) from public, anon, authenticated;
grant execute on function public.experto_uso_mes(uuid, text) to service_role;

create or replace function public.experto_mi_plan()
returns text language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select e.nivel from public.experto_pro e where e.user_id = auth.uid() and e.hasta > now()),
    (select cl.plan from public.clientes cl where cl.user_id = auth.uid() and cl.activo and cl.plan <> 'free' limit 1),
    (select 'plus' from public.experto_beta_usuarios b join public.experto_lanzamiento_config lc on lc.id = 1 and lc.fase = 'beta_10' where b.user_id = auth.uid()),
    'free');
$$;
revoke all on function public.experto_mi_plan() from public, anon;
grant execute on function public.experto_mi_plan() to authenticated;

-- Preparado para la etapa siguiente: un resultado gratis antes de la prueba Pro
-- y del cobro. Los beta registrados no llegan a esta regla.
create or replace function public.experto_prueba_un_uso(p_user_id uuid, p_huella text)
returns table (plan text, usados integer, maximo integer)
language sql stable security definer
set search_path = public, experto, pg_temp
as $$
  with p as (select coalesce((select u.plan from public.experto_uso_mes(p_user_id, coalesce(nullif(p_huella, ''), 'anon')) u limit 1), 'free') as plan)
  select p.plan,
         (select count(*)::integer from experto.consultas c
           where c.modo in ('chat', 'informe', 'bajo_agua') and (
             (p_user_id is not null and (c.user_id = p_user_id or (c.user_id is null and c.huella = coalesce(nullif(p_huella, ''), 'anon'))))
             or (p_user_id is null and c.user_id is null and c.huella = coalesce(nullif(p_huella, ''), 'anon')))),
         case when p.plan = 'free' then 1 else null end
    from p;
$$;
revoke all on function public.experto_prueba_un_uso(uuid, text) from public, anon, authenticated;
grant execute on function public.experto_prueba_un_uso(uuid, text) to service_role;

create or replace function public.experto_bajo_agua_cuota(p_user_id uuid)
returns table (plan text, usados integer, maximo integer, periodo text)
language sql stable security definer
set search_path = public, experto, pg_temp
as $$
  with p as (select coalesce((select u.plan from public.experto_uso_mes(p_user_id, 'libro') u limit 1), 'free') as plan),
  c as (select p.plan, case when p.plan = 'free' then 1 when q.plan is null then 10 else q.informes end as maximo,
               case when p.plan = 'free' then 'total' else coalesce(q.periodo, 'mes') end as periodo
          from p left join public.experto_bajo_agua_cuotas q on q.plan = p.plan)
  select c.plan,
         (select count(*)::integer from experto.consultas x where x.user_id = p_user_id
           and (case when c.plan = 'free' then x.modo in ('chat', 'informe', 'bajo_agua') else x.modo = 'bajo_agua' end)
           and (c.periodo = 'total' or x.creado_en >= date_trunc('month', now()))),
         c.maximo, c.periodo from c;
$$;
revoke all on function public.experto_bajo_agua_cuota(uuid) from public, anon, authenticated;
grant execute on function public.experto_bajo_agua_cuota(uuid) to service_role;

-- Metricas internas de adopcion y uso de los 10 clientes.
create or replace function public.experto_beta_metricas()
returns table (posicion integer, user_id uuid, email text, ingresado_en timestamptz, consultas bigint, informes bigint, ultimo_uso timestamptz)
language sql stable security definer
set search_path = public, experto, auth, pg_temp
as $$
  select b.posicion, b.user_id, u.email, b.ingresado_en,
         count(c.*) filter (where c.modo = 'chat'),
         count(c.*) filter (where c.modo <> 'chat'), max(c.creado_en)
    from public.experto_beta_usuarios b join auth.users u on u.id = b.user_id
    left join experto.consultas c on c.user_id = b.user_id
   group by b.posicion, b.user_id, u.email, b.ingresado_en order by b.posicion;
$$;
revoke all on function public.experto_beta_metricas() from public, anon, authenticated;
grant execute on function public.experto_beta_metricas() to service_role;
