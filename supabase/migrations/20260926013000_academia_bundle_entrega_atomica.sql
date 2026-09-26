-- Entrega auditable e idempotente para compras de Academia, incluido el pack
-- Saga 7x1. La asignación completa ocurre en una sola transacción corta.
alter table public.academia_pagos
  add column if not exists cantidad_accesos integer not null default 0,
  add column if not exists entrega_estado text not null default 'no_asignada',
  add column if not exists accesos_asignados_at timestamptz,
  add column if not exists notificado_at timestamptz,
  add column if not exists entrega_completada_at timestamptz,
  add column if not exists revocado_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'academia_pagos_cantidad_accesos_check'
      and conrelid = 'public.academia_pagos'::regclass
  ) then
    alter table public.academia_pagos
      add constraint academia_pagos_cantidad_accesos_check
      check (cantidad_accesos between 0 and 7);
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'academia_pagos_entrega_estado_check'
      and conrelid = 'public.academia_pagos'::regclass
  ) then
    alter table public.academia_pagos
      add constraint academia_pagos_entrega_estado_check
      check (entrega_estado in ('no_asignada', 'asignada', 'notificada', 'revocada', 'error'));
  end if;
end $$;

-- La tabla ya existe en producción, pero no estaba versionada en las
-- migraciones del repositorio. Esta definición permite reconstruir el esquema
-- desde cero sin alterar la tabla existente.
create table if not exists public.academia_accesos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  curso_slug text not null,
  email text,
  estado text not null default 'disponible',
  mp_payment_id text,
  asignado_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.academia_accesos enable row level security;

-- Este cambio introduce el vínculo autoritativo pago↔acceso. No es seguro
-- adivinarlo si aparecieron ventas antes de aplicar la migración. Producción se
-- verificó vacía al preparar el despliegue; si eso cambia, la migración aborta
-- y obliga a hacer un backfill revisado antes de habilitar el webhook nuevo.
do $$
begin
  if exists (
    select 1
    from public.academia_pagos
    where mp_payment_id is not null
       or codigo_entregado is not null
       or estado in ('approved', 'aprobado', 'aprobado_sin_email')
  ) or exists (
    select 1
    from public.academia_accesos
    where mp_payment_id is not null
       or email is not null
  ) then
    raise exception using
      errcode = '55000',
      message = 'Academia tiene entregas legacy: ejecutar backfill pago-acceso revisado antes de continuar';
  end if;
end $$;

-- En el esquema histórico un payment_id solo podía ocupar un código. El pack
-- necesita que el mismo pago verificado respalde siete accesos distintos.
alter table public.academia_accesos
  drop constraint if exists academia_accesos_mp_payment_id_key;
create index if not exists academia_accesos_mp_payment_id_idx
  on public.academia_accesos (mp_payment_id)
  where mp_payment_id is not null;

create table if not exists public.academia_pago_accesos (
  pago_id uuid not null references public.academia_pagos(id) on delete cascade,
  curso_slug text not null,
  acceso_id uuid not null references public.academia_accesos(id),
  codigo text not null,
  created_at timestamptz not null default now(),
  primary key (pago_id, curso_slug),
  unique (acceso_id)
);

alter table public.academia_pago_accesos enable row level security;
revoke all on table public.academia_pago_accesos from anon, authenticated;
grant all on table public.academia_pago_accesos to service_role;

-- Ventanas de 15 minutos para impedir que el endpoint público de recuperación
-- se use como generador de correos. Solo el service_role puede verla o escribir.
create table if not exists public.academia_recuperaciones (
  email_hash text not null,
  curso_slug text not null,
  ventana_inicio timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (email_hash, curso_slug, ventana_inicio)
);
alter table public.academia_recuperaciones enable row level security;
revoke all on table public.academia_recuperaciones from anon, authenticated;
grant all on table public.academia_recuperaciones to service_role;
create index if not exists academia_recuperaciones_ventana_idx
  on public.academia_recuperaciones (ventana_inicio);

-- Rate limits durables para endpoints públicos. Solo se persisten hashes, no
-- direcciones IP, códigos ni correos en claro.
create table if not exists public.academia_rate_limits (
  accion text not null,
  clave_hash text not null,
  ventana_inicio timestamptz not null,
  intentos bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (accion, clave_hash, ventana_inicio)
);
alter table public.academia_rate_limits enable row level security;
revoke all on table public.academia_rate_limits from anon, authenticated;
grant all on table public.academia_rate_limits to service_role;
create index if not exists academia_rate_limits_ventana_idx
  on public.academia_rate_limits (ventana_inicio);

-- Bandeja durable para contracargos. El webhook público solo persiste y
-- confirma recepción; un worker autenticado reconcilia luego con Mercado Pago.
create table if not exists public.academia_mp_inbox (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  event_type text not null check (event_type = 'chargeback'),
  payment_id text not null check (payment_id ~ '^[0-9]{1,32}$'),
  provider_topic text not null,
  provider_event_id text,
  estado text not null default 'queued'
    check (estado in ('queued', 'processing', 'retry', 'done', 'dead')),
  intentos integer not null default 0 check (intentos between 0 and 8),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.academia_mp_inbox enable row level security;
revoke all on table public.academia_mp_inbox from anon, authenticated;
grant all on table public.academia_mp_inbox to service_role;
grant usage, select on sequence public.academia_mp_inbox_id_seq to service_role;
create index if not exists academia_mp_inbox_pending_idx
  on public.academia_mp_inbox (next_attempt_at, created_at)
  where estado in ('queued', 'retry', 'processing');

create or replace function public.academia_reclamar_eventos_mp(
  p_limite integer default 10
)
returns table (evento_id bigint, payment_id text, intentos integer)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_limite < 1 or p_limite > 20 then
    raise exception 'Límite de lote inválido.';
  end if;

  -- Recupera trabajos abandonados por una ejecución interrumpida.
  update public.academia_mp_inbox
  set estado = case when intentos >= 8 then 'dead' else 'retry' end,
      locked_at = null,
      next_attempt_at = case when intentos >= 8 then next_attempt_at else now() end,
      processed_at = case when intentos >= 8 then now() else processed_at end,
      last_error = 'worker_timeout',
      updated_at = now()
  where estado = 'processing'
    and locked_at < now() - interval '10 minutes';

  -- La bitácora autoritativa queda en academia_eventos; esta cola conserva
  -- noventa días de terminales para idempotencia y diagnóstico operacional.
  delete from public.academia_mp_inbox
  where estado in ('done', 'dead')
    and updated_at < now() - interval '90 days';

  return query
  with candidates as (
    select inbox.id
    from public.academia_mp_inbox as inbox
    where inbox.estado in ('queued', 'retry')
      and inbox.intentos < 8
      and inbox.next_attempt_at <= now()
    order by inbox.next_attempt_at, inbox.created_at
    for update skip locked
    limit p_limite
  )
  update public.academia_mp_inbox as inbox
  set estado = 'processing',
      intentos = inbox.intentos + 1,
      locked_at = now(),
      updated_at = now()
  from candidates
  where inbox.id = candidates.id
  returning inbox.id, inbox.payment_id, inbox.intentos;
end;
$$;

revoke all on function public.academia_reclamar_eventos_mp(integer)
  from public, anon, authenticated;
grant execute on function public.academia_reclamar_eventos_mp(integer)
  to service_role;

create or replace function public.academia_finalizar_evento_mp(
  p_evento_id bigint,
  p_exito boolean,
  p_reintentar boolean,
  p_error_code text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempts integer;
begin
  if p_error_code is not null
     and p_error_code !~ '^[a-z0-9_:-]{1,120}$' then
    raise exception 'Código de error inválido.';
  end if;

  select inbox.intentos
  into v_attempts
  from public.academia_mp_inbox as inbox
  where inbox.id = p_evento_id
    and inbox.estado = 'processing'
  for update;
  if not found then
    raise exception 'Evento no reclamado o ya finalizado.';
  end if;

  if p_exito then
    update public.academia_mp_inbox
    set estado = 'done',
        processed_at = now(),
        locked_at = null,
        last_error = null,
        updated_at = now()
    where id = p_evento_id;
  elsif not p_reintentar or v_attempts >= 8 then
    update public.academia_mp_inbox
    set estado = 'dead',
        processed_at = now(),
        locked_at = null,
        last_error = coalesce(p_error_code, 'definitive_error'),
        updated_at = now()
    where id = p_evento_id;
  else
    update public.academia_mp_inbox
    set estado = 'retry',
        next_attempt_at = now() + least(
          interval '1 hour',
          interval '30 seconds' * power(
            2::double precision,
            greatest(v_attempts - 1, 0)::double precision
          )
        ),
        locked_at = null,
        last_error = coalesce(p_error_code, 'retry_required'),
        updated_at = now()
    where id = p_evento_id;
  end if;
end;
$$;

revoke all on function public.academia_finalizar_evento_mp(bigint, boolean, boolean, text)
  from public, anon, authenticated;
grant execute on function public.academia_finalizar_evento_mp(bigint, boolean, boolean, text)
  to service_role;

-- Los materiales premium se sirven exclusivamente mediante enlaces firmados
-- breves. No se crean políticas públicas de lectura para este bucket.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'academia-premium',
  'academia-premium',
  false,
  10485760,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Bitácora operacional sin secretos. Permite auditar rechazos del proveedor,
-- errores de entrega y reversas incluso cuando el correo de alerta no sale.
create table if not exists public.academia_eventos (
  id bigint generated always as identity primary key,
  pago_id uuid references public.academia_pagos(id) on delete set null,
  clave_idempotencia text,
  tipo text not null,
  severidad text not null default 'warning',
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.academia_eventos enable row level security;
alter table public.academia_eventos
  add column if not exists clave_idempotencia text;
revoke all on table public.academia_eventos from anon, authenticated;
grant all on table public.academia_eventos to service_role;
grant usage, select on sequence public.academia_eventos_id_seq to service_role;
create index if not exists academia_eventos_pago_id_idx
  on public.academia_eventos (pago_id)
  where pago_id is not null;
create index if not exists academia_eventos_created_at_idx
  on public.academia_eventos (created_at desc);
create unique index if not exists academia_eventos_clave_idempotencia_idx
  on public.academia_eventos (clave_idempotencia);

create or replace function public.academia_consumir_rate_limit(
  p_accion text,
  p_clave_hash text,
  p_ventana_inicio timestamptz,
  p_limite integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempts bigint;
begin
  if p_accion not in (
    'crear_checkout',
    'validar_codigo',
    'recuperar_acceso',
    'procesar_webhook_red',
    'procesar_webhook_id'
  ) then
    raise exception 'Acción de límite no permitida.';
  end if;
  if p_clave_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Clave de límite inválida.';
  end if;
  if p_limite < 1 or p_limite > 100 then
    raise exception 'Límite inválido.';
  end if;
  if p_ventana_inicio < now() - interval '1 hour'
     or p_ventana_inicio > now() + interval '5 minutes' then
    raise exception 'Ventana inválida.';
  end if;

  -- Retención acotada: conserva margen suficiente para investigar abuso sin
  -- acumular indefinidamente huellas ni solicitudes de recuperación.
  delete from public.academia_rate_limits
  where ventana_inicio < now() - interval '24 hours';
  delete from public.academia_recuperaciones
  where ventana_inicio < now() - interval '24 hours';

  insert into public.academia_rate_limits (
    accion,
    clave_hash,
    ventana_inicio,
    intentos
  ) values (
    p_accion,
    p_clave_hash,
    p_ventana_inicio,
    1
  )
  on conflict (accion, clave_hash, ventana_inicio)
  do update set
    intentos = least(public.academia_rate_limits.intentos + 1, 2147483647::bigint),
    updated_at = now()
  returning intentos into v_attempts;

  return v_attempts <= p_limite;
end;
$$;

revoke all on function public.academia_consumir_rate_limit(text, text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.academia_consumir_rate_limit(text, text, timestamptz, integer)
  to service_role;

create or replace function public.academia_asignar_accesos_pago(
  p_pago_id uuid,
  p_email text,
  p_mp_payment_id text,
  p_cursos text[]
)
returns table (curso_slug text, codigo text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected integer := cardinality(p_cursos);
  v_existing integer;
  v_payment_state text;
  v_delivery_state text;
  v_registered_payment_id text;
  v_slug text;
  v_access_id uuid;
  v_code text;
  v_code_attempt integer;
  v_email text := lower(trim(p_email));
begin
  if v_email is null or v_email = '' then
    raise exception 'Se requiere el correo verificado por el proveedor de pago.';
  end if;
  if p_mp_payment_id is null or trim(p_mp_payment_id) = '' then
    raise exception 'Se requiere el identificador del pago.';
  end if;
  if v_expected is null or v_expected < 1 or v_expected > 7 then
    raise exception 'La cantidad de cursos debe estar entre 1 y 7.';
  end if;
  if (
    select count(distinct requested.slug)
    from unnest(p_cursos) as requested(slug)
  ) <> v_expected then
    raise exception 'La lista de cursos contiene duplicados.';
  end if;

  -- Serializa entrega y reversa del mismo pago. El vínculo con Mercado Pago y
  -- el estado "asignada" se escriben dentro de esta misma transacción.
  select p.estado, p.entrega_estado, p.mp_payment_id
  into v_payment_state, v_delivery_state, v_registered_payment_id
  from public.academia_pagos as p
  where p.id = p_pago_id
  for update;
  if not found then
    raise exception 'Pago no encontrado.';
  end if;
  if v_payment_state in ('refunded', 'charged_back', 'cancelled')
     or v_delivery_state = 'revocada' then
    raise exception 'El pago fue revertido y no admite asignación.';
  end if;
  if v_registered_payment_id is not null
     and v_registered_payment_id is distinct from p_mp_payment_id then
    raise exception 'El identificador del pago no coincide con la entrega.';
  end if;

  select count(*)
  into v_existing
  from public.academia_pago_accesos as a
  where a.pago_id = p_pago_id;

  if v_existing > 0 then
    if v_existing <> v_expected
      or exists (
        select 1
        from unnest(p_cursos) as requested(slug)
        where not exists (
          select 1
          from public.academia_pago_accesos as assigned
          where assigned.pago_id = p_pago_id
            and assigned.curso_slug = requested.slug
        )
      )
      or exists (
        select 1
        from public.academia_pago_accesos as assigned
        where assigned.pago_id = p_pago_id
          and not (assigned.curso_slug = any(p_cursos))
      )
      or exists (
        select 1
        from public.academia_pago_accesos as assigned
        join public.academia_accesos as access on access.id = assigned.acceso_id
        where assigned.pago_id = p_pago_id
          and (
            lower(access.email) is distinct from v_email
            or access.mp_payment_id is distinct from p_mp_payment_id
          )
      ) then
      raise exception 'La entrega existente no coincide con el producto comprado.';
    end if;

    update public.academia_pagos
    set estado = 'aprobado',
        entrega_estado = case
          when entrega_estado = 'notificada' then 'notificada'
          else 'asignada'
        end,
        email = v_email,
        mp_payment_id = p_mp_payment_id,
        codigo_entregado = case
          when v_expected = 1 then (
            select assigned.codigo
            from public.academia_pago_accesos as assigned
            where assigned.pago_id = p_pago_id
            limit 1
          )
          else v_expected::text || ' accesos'
        end,
        cantidad_accesos = v_expected,
        accesos_asignados_at = coalesce(accesos_asignados_at, now()),
        updated_at = now()
    where id = p_pago_id
      and estado not in ('refunded', 'charged_back', 'cancelled')
      and entrega_estado <> 'revocada';
    if not found then
      raise exception 'El pago fue revertido durante la asignación.';
    end if;

    return query
      select assigned.curso_slug, assigned.codigo
      from public.academia_pago_accesos as assigned
      where assigned.pago_id = p_pago_id
      order by array_position(p_cursos, assigned.curso_slug);
    return;
  end if;

  -- Orden estable para reducir la posibilidad de interbloqueos entre packs.
  for v_slug in
    select requested.slug
    from unnest(p_cursos) as requested(slug)
    order by requested.slug
  loop
    select access.id, access.codigo
    into v_access_id, v_code
    from public.academia_accesos as access
    where access.curso_slug = v_slug
      and access.estado = 'disponible'
      and access.email is null
    order by access.created_at, access.id
    for update skip locked
    limit 1;

    if not found then
      -- Los códigos son credenciales internas, no licencias finitas. Si no hay
      -- uno precreado, se genera dentro de esta misma transacción. UNIQUE y el
      -- retry cubren una colisión improbable sin cobrar una compra sin acceso.
      v_access_id := null;
      for v_code_attempt in 1..5 loop
        begin
          v_code := 'FVB-' || upper(encode(extensions.gen_random_bytes(10), 'hex'));
          insert into public.academia_accesos (
            codigo,
            curso_slug,
            estado
          ) values (
            v_code,
            v_slug,
            'disponible'
          )
          returning id, codigo into v_access_id, v_code;
          exit;
        exception when unique_violation then
          v_access_id := null;
        end;
      end loop;
      if v_access_id is null then
        raise exception 'No se pudo generar un acceso único para %.', v_slug;
      end if;
    end if;

    update public.academia_accesos
    set email = v_email,
        mp_payment_id = p_mp_payment_id,
        asignado_at = now()
    where id = v_access_id;

    insert into public.academia_pago_accesos (
      pago_id,
      curso_slug,
      acceso_id,
      codigo
    ) values (
      p_pago_id,
      v_slug,
      v_access_id,
      v_code
    );
  end loop;

  update public.academia_pagos
  set estado = 'aprobado',
      entrega_estado = case
        when entrega_estado = 'notificada' then 'notificada'
        else 'asignada'
      end,
      email = v_email,
      mp_payment_id = p_mp_payment_id,
      codigo_entregado = case
        when v_expected = 1 then (
          select assigned.codigo
          from public.academia_pago_accesos as assigned
          where assigned.pago_id = p_pago_id
          limit 1
        )
        else v_expected::text || ' accesos'
      end,
      cantidad_accesos = v_expected,
      accesos_asignados_at = coalesce(accesos_asignados_at, now()),
      updated_at = now()
  where id = p_pago_id
    and estado not in ('refunded', 'charged_back', 'cancelled')
    and entrega_estado <> 'revocada';
  if not found then
    raise exception 'El pago fue revertido durante la asignación.';
  end if;

  return query
    select assigned.curso_slug, assigned.codigo
    from public.academia_pago_accesos as assigned
    where assigned.pago_id = p_pago_id
    order by array_position(p_cursos, assigned.curso_slug);
end;
$$;

revoke all on function public.academia_asignar_accesos_pago(uuid, text, text, text[])
  from public, anon, authenticated;
grant execute on function public.academia_asignar_accesos_pago(uuid, text, text, text[])
  to service_role;

comment on function public.academia_asignar_accesos_pago(uuid, text, text, text[])
  is 'Asigna de forma atómica e idempotente uno o siete accesos de Academia a un pago verificado.';

create or replace function public.academia_revocar_accesos_pago(
  p_pago_id uuid,
  p_mp_payment_id text,
  p_estado text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_registered_payment_id text;
  v_assigned integer;
  v_revoked integer;
begin
  if p_estado not in ('refunded', 'charged_back', 'cancelled') then
    raise exception 'Estado de reversa no permitido.';
  end if;
  if p_mp_payment_id is null or trim(p_mp_payment_id) = '' then
    raise exception 'Se requiere el identificador del pago.';
  end if;

  select payment.mp_payment_id
  into v_registered_payment_id
  from public.academia_pagos as payment
  where payment.id = p_pago_id
  for update;
  if not found then
    raise exception 'Pago no encontrado.';
  end if;

  select count(*)
  into v_assigned
  from public.academia_pago_accesos as assigned
  where assigned.pago_id = p_pago_id;

  if v_registered_payment_id is not null
     and v_registered_payment_id is distinct from p_mp_payment_id then
    raise exception 'El pago de la reversa no coincide con la entrega.';
  end if;

  update public.academia_accesos as access
  set estado = 'revocado'
  where access.id in (
    select assigned.acceso_id
    from public.academia_pago_accesos as assigned
    where assigned.pago_id = p_pago_id
  )
    and access.estado <> 'revocado';
  get diagnostics v_revoked = row_count;

  update public.academia_pagos
  set estado = p_estado,
      entrega_estado = case when v_assigned > 0 then 'revocada' else entrega_estado end,
      revocado_at = case when v_assigned > 0 then now() else revocado_at end,
      updated_at = now()
  where id = p_pago_id;

  insert into public.academia_eventos (
    pago_id,
    clave_idempotencia,
    tipo,
    severidad,
    detalle
  )
  values (
    p_pago_id,
    'reversa:' || p_pago_id::text || ':' || p_mp_payment_id || ':' || p_estado,
    'accesos_revocados',
    'critical',
    jsonb_build_object(
      'estado_mp', p_estado,
      'accesos_vinculados', v_assigned,
      'accesos_revocados_ahora', v_revoked
    )
  )
  on conflict (clave_idempotencia) do nothing;

  return v_revoked;
end;
$$;

revoke all on function public.academia_revocar_accesos_pago(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.academia_revocar_accesos_pago(uuid, text, text)
  to service_role;

comment on function public.academia_revocar_accesos_pago(uuid, text, text)
  is 'Revoca los accesos vinculados a un pago ante reembolso, contracargo o cancelación verificados.';
