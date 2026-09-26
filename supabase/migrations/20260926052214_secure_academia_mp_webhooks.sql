-- Endurece el flujo de contracargos de Academia:
-- 1) solo procesa notificaciones cuya firma ya fue validada por la Edge Function;
-- 2) deduplica por data.id firmado (recurso de contracargo), no por payment_id;
-- 3) ejecuta el worker cada cinco minutos con service_role leído desde Vault.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

alter table public.academia_mp_inbox
  add column if not exists provider_resource_id text,
  add column if not exists signature_verified boolean not null default false;

-- Ninguna fila creada antes de validar x-signature puede revocar accesos. Se
-- conserva para auditoría, pero queda fuera de la cola ejecutable.
update public.academia_mp_inbox
set estado = 'dead',
    processed_at = coalesce(processed_at, now()),
    locked_at = null,
    last_error = 'unsigned_event_quarantined',
    updated_at = now()
where not signature_verified
  and estado in ('queued', 'processing', 'retry');

create unique index if not exists academia_mp_inbox_provider_resource_key
  on public.academia_mp_inbox (provider_topic, provider_resource_id)
  where provider_resource_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'academia_mp_inbox_verified_identity_check'
      and conrelid = 'public.academia_mp_inbox'::regclass
  ) then
    alter table public.academia_mp_inbox
      add constraint academia_mp_inbox_verified_identity_check
      check (
        not signature_verified
        or (
          nullif(provider_event_id, '') is not null
          and length(provider_event_id) <= 128
          and nullif(provider_resource_id, '') is not null
          and length(provider_resource_id) <= 256
        )
      );
  end if;
end $$;

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

  update public.academia_mp_inbox
  set estado = case when intentos >= 8 then 'dead' else 'retry' end,
      locked_at = null,
      next_attempt_at = case when intentos >= 8 then next_attempt_at else now() end,
      processed_at = case when intentos >= 8 then now() else processed_at end,
      last_error = 'worker_timeout',
      updated_at = now()
  where signature_verified
    and estado = 'processing'
    and locked_at < now() - interval '10 minutes';

  delete from public.academia_mp_inbox
  where estado in ('done', 'dead')
    and updated_at < now() - interval '90 days';

  return query
  with candidates as (
    select inbox.id
    from public.academia_mp_inbox as inbox
    where inbox.signature_verified
      and inbox.estado in ('queued', 'retry')
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

-- Un error global de credenciales de Mercado Pago no consume los intentos de
-- cada evento. Todo el lote reclamado vuelve a retry y queda trazable.
create or replace function public.academia_pausar_eventos_mp(
  p_eventos bigint[],
  p_error_code text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if coalesce(cardinality(p_eventos), 0) < 1 or cardinality(p_eventos) > 20 then
    raise exception 'Lote inválido.';
  end if;
  if p_error_code !~ '^[a-z0-9_:-]{1,120}$' then
    raise exception 'Código de error inválido.';
  end if;

  update public.academia_mp_inbox
  set estado = 'retry',
      intentos = greatest(intentos - 1, 0),
      next_attempt_at = now() + interval '5 minutes',
      locked_at = null,
      last_error = p_error_code,
      updated_at = now()
  where id = any(p_eventos)
    and estado = 'processing';
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.academia_pausar_eventos_mp(bigint[], text)
  from public, anon, authenticated;
grant execute on function public.academia_pausar_eventos_mp(bigint[], text)
  to service_role;

create or replace function public.academia_despachar_mp_inbox()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service_role text;
  v_request_id bigint;
begin
  if not exists (
    select 1
    from public.academia_mp_inbox
    where signature_verified
      and (
        (estado in ('queued', 'retry') and next_attempt_at <= now())
        or (estado = 'processing' and locked_at < now() - interval '10 minutes')
      )
  ) then
    return null;
  end if;

  select decrypted_secret
  into v_service_role
  from vault.decrypted_secrets
  where name = 'service_role_jwt_legacy'
    and nullif(decrypted_secret, '') is not null
  limit 1;
  if v_service_role is null then
    raise exception 'Vault secret service_role_jwt_legacy is required';
  end if;

  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/procesar-academia-mp-inbox',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role,
      'apikey', v_service_role
    ),
    body := jsonb_build_object('limit', 20, 'source', 'pg_cron'),
    timeout_milliseconds := 120000
  ) into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function public.academia_despachar_mp_inbox()
  from public, anon, authenticated;
grant execute on function public.academia_despachar_mp_inbox()
  to service_role;

do $migration$
declare
  v_job record;
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'service_role_jwt_legacy'
      and nullif(decrypted_secret, '') is not null
  ) then
    raise exception 'Vault secret service_role_jwt_legacy is required before this migration';
  end if;

  for v_job in
    select jobid
    from cron.job
    where jobname = 'academia-mp-inbox-worker'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  perform cron.schedule(
    'academia-mp-inbox-worker',
    '*/5 * * * *',
    $cron$select public.academia_despachar_mp_inbox();$cron$
  );
end
$migration$;
