-- Monetizacion del Experto: un solo resultado gratis de por vida por cuenta.
-- El uso se consume solo cuando una Edge Function registra una respuesta exitosa.
-- Las pruebas Pro ya iniciadas se respetan hasta su fecha de vencimiento, pero no se
-- pueden iniciar nuevas pruebas de 14 dias.

create or replace function public.experto_prueba_un_uso(p_user_id uuid, p_huella text)
returns table (plan text, usados integer, maximo integer)
language sql stable security definer
set search_path = public, experto
as $$
  with p as (
    select coalesce(
      (select u.plan from public.experto_uso_mes(p_user_id, coalesce(nullif(p_huella, ''), 'anon')) u limit 1),
      'free'
    ) as plan
  )
  select p.plan,
         (select count(*)::integer
            from experto.consultas c
           where c.modo in ('chat', 'informe', 'bajo_agua')
             and (
               (p_user_id is not null and (c.user_id = p_user_id or (c.user_id is null and c.huella = coalesce(nullif(p_huella, ''), 'anon'))))
               or
               (p_user_id is null and c.user_id is null and c.huella = coalesce(nullif(p_huella, ''), 'anon'))
             )),
         case when p.plan = 'free' then 1 else null end
    from p;
$$;

revoke all on function public.experto_prueba_un_uso(uuid, text) from public, anon, authenticated;
grant execute on function public.experto_prueba_un_uso(uuid, text) to service_role;

-- Bajo el Agua comparte el mismo unico uso gratis con chat e informe. Los planes
-- pagados conservan sus cupos mensuales configurables.
create or replace function public.experto_bajo_agua_cuota(p_user_id uuid)
returns table (plan text, usados integer, maximo integer, periodo text)
language sql stable security definer
set search_path = public, experto
as $$
  with p as (
    select coalesce((select u.plan from public.experto_uso_mes(p_user_id, 'libro') u limit 1), 'free') as plan
  ),
  c as (
    select p.plan,
           case when p.plan = 'free' then 1 when q.plan is null then 10 else q.informes end as maximo,
           case when p.plan = 'free' then 'total' else coalesce(q.periodo, 'mes') end as periodo
      from p
      left join public.experto_bajo_agua_cuotas q on q.plan = p.plan
  )
  select c.plan,
         (select count(*)::integer
            from experto.consultas x
           where x.user_id = p_user_id
             and (case when c.plan = 'free' then x.modo in ('chat', 'informe', 'bajo_agua') else x.modo = 'bajo_agua' end)
             and (c.periodo = 'total' or x.creado_en >= date_trunc('month', now()))),
         c.maximo,
         c.periodo
    from c;
$$;

revoke all on function public.experto_bajo_agua_cuota(uuid) from public, anon, authenticated;
grant execute on function public.experto_bajo_agua_cuota(uuid) to service_role;

-- Se conserva la firma de las RPC que existen en produccion para que clientes
-- antiguos reciban una respuesta explicita, sin dejar una via de activacion gratis.
create or replace function public.experto_prueba_estado()
returns table (disponible boolean, usada_en timestamptz, hasta timestamptz)
language sql stable security definer
set search_path = public
as $$
  select false, null::timestamptz, null::timestamptz;
$$;

create or replace function public.experto_prueba_iniciar()
returns timestamptz
language plpgsql security definer
set search_path = public
as $$
begin
  raise exception 'El Experto incluye un uso gratis. Para continuar, activa Experto Pro.';
end;
$$;

revoke all on function public.experto_prueba_iniciar() from public, anon, authenticated;
grant execute on function public.experto_prueba_estado() to authenticated;
