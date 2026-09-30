-- Pipeline durable para el enriquecimiento de contactos.
-- Corte: desplegar primero la Edge Function compatible y aplicar esta migracion
-- fuera de las 02:00 UTC; ejecutar contact_enrichment_dispatch('enqueue'),
-- verificar HTTP/run/logs y solo luego retirar el Cron/API de Vercel.
-- Rollback: desactivar solo contact-enrichment-daily por jobname; mantener
-- contact-enrichment-worker hasta drenar los despachos y recien entonces
-- reponer Vercel. Conservar tablas para diagnostico.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Versiona la protección que ya existe en producción. Marketing y Tracción
-- son herramientas personales del fundador; un proyecto reconstruido no debe
-- exponer su bitácora a otros usuarios autenticados.
alter table public.contact_enrichment_logs enable row level security;
do $policies$
declare v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'contact_enrichment_logs'
  loop
    execute format('drop policy %I on public.contact_enrichment_logs', v_policy.policyname);
  end loop;
end
$policies$;
revoke all on table public.contact_enrichment_logs from public, anon, authenticated;
grant select on table public.contact_enrichment_logs to authenticated;
grant select, insert, update, delete on table public.contact_enrichment_logs to service_role;
create policy contact_enrichment_logs_founder_select
  on public.contact_enrichment_logs
  for select to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'evaras@firmavb.cl');

create table if not exists public.contact_enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.contact_enrichment_logs(id) on delete restrict,
  trigger_source text not null check (trigger_source in ('cron', 'manual')),
  requested_by uuid,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'error')),
  jobs_total integer not null default 0,
  jobs_completed integer not null default 0,
  jobs_failed integer not null default 0,
  registros_procesados integer not null default 0,
  registros_nuevos integer not null default 0,
  registros_actualizados integer not null default 0,
  errores integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Enqueue idempotente aunque cron y el boton manual coincidan.
create unique index if not exists contact_enrichment_one_active_run
  on public.contact_enrichment_runs ((true))
  where status in ('queued', 'processing');

create table if not exists public.contact_enrichment_jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.contact_enrichment_runs(id) on delete cascade,
  source text not null,
  cursor_value integer not null default 0 check (cursor_value >= 0),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'retry', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  registros_procesados integer not null default 0,
  registros_nuevos integer not null default 0,
  registros_actualizados integer not null default 0,
  errores integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, source)
);

create index if not exists contact_enrichment_jobs_due
  on public.contact_enrichment_jobs (available_at, created_at)
  where status in ('queued', 'retry');

create table if not exists public.contact_enrichment_http_dispatches (
  id uuid primary key default gen_random_uuid(),
  parent_dispatch_id uuid references public.contact_enrichment_http_dispatches(id) on delete set null,
  kind text not null check (kind in ('enqueue', 'worker')),
  request_id bigint not null unique,
  attempt integer not null default 1 check (attempt between 1 and 10),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'retry', 'failed')),
  status_code integer,
  timed_out boolean,
  response_body text,
  error_message text,
  created_at timestamptz not null default now(),
  checked_at timestamptz,
  next_retry_at timestamptz
);

create index if not exists contact_enrichment_http_pending
  on public.contact_enrichment_http_dispatches (created_at)
  where status = 'pending';

alter table public.contact_enrichment_runs enable row level security;
alter table public.contact_enrichment_jobs enable row level security;
alter table public.contact_enrichment_http_dispatches enable row level security;
revoke all on table public.contact_enrichment_runs from public, anon, authenticated;
revoke all on table public.contact_enrichment_jobs from public, anon, authenticated;
revoke all on table public.contact_enrichment_http_dispatches from public, anon, authenticated;
grant select, insert, update, delete on table public.contact_enrichment_runs to service_role;
grant select, insert, update, delete on table public.contact_enrichment_jobs to service_role;
grant select, insert, update, delete on table public.contact_enrichment_http_dispatches to service_role;

create or replace function public.contact_enrichment_retry_delay_seconds(p_attempt integer)
returns integer language sql immutable strict as $$
  select least(3600, (power(2, greatest(p_attempt - 1, 0)) * 60)::integer);
$$;

create or replace function public.contact_enrichment_http_outcome(
  p_status_code integer, p_timed_out boolean, p_error_message text,
  p_attempt integer, p_max_attempts integer
)
returns text language sql immutable as $$
  select case
    when coalesce(p_timed_out, false)
      or nullif(p_error_message, '') is not null
      or p_status_code is null or p_status_code < 200 or p_status_code >= 300
    then case when p_attempt < p_max_attempts then 'retry' else 'failed' end
    else 'succeeded'
  end;
$$;

create or replace function public.contact_enrichment_refresh_run(p_run_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_pending integer; v_completed integer; v_failed integer;
  v_processed integer; v_new integer; v_updated integer; v_errors integer;
  v_status text; v_log_id uuid; v_last_error text;
begin
  select
    count(*) filter (where status in ('queued', 'processing', 'retry')),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'failed'),
    coalesce(sum(registros_procesados), 0), coalesce(sum(registros_nuevos), 0),
    coalesce(sum(registros_actualizados), 0), coalesce(sum(errores), 0),
    max(last_error) filter (where last_error is not null)
  into v_pending, v_completed, v_failed, v_processed, v_new, v_updated,
       v_errors, v_last_error
  from public.contact_enrichment_jobs where run_id = p_run_id;

  v_status := case when v_pending > 0 then 'processing'
    when v_failed > 0 or v_errors > 0 then 'error' else 'completed' end;

  update public.contact_enrichment_runs
  set status = v_status, jobs_completed = v_completed, jobs_failed = v_failed,
      registros_procesados = v_processed, registros_nuevos = v_new,
      registros_actualizados = v_updated, errores = v_errors + v_failed,
      last_error = v_last_error, started_at = coalesce(started_at, now()),
      finished_at = case when v_status in ('completed', 'error') then now() else null end,
      updated_at = now()
  where id = p_run_id returning log_id into v_log_id;

  update public.contact_enrichment_logs
  set estado = case v_status
        when 'processing' then 'procesando'
        when 'completed' then 'completado'
        else 'error'
      end,
      registros_procesados = v_processed, registros_nuevos = v_new,
      registros_actualizados = v_updated, errores = v_errors + v_failed,
      mensaje_error = v_last_error,
      fecha_fin = case when v_status in ('completed', 'error') then now() else null end,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'run_id', p_run_id, 'jobs_completados', v_completed, 'jobs_fallidos', v_failed)
  where id = v_log_id;
end;
$$;

create or replace function public.contact_enrichment_enqueue(
  p_trigger_source text, p_requested_by uuid default null
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_run_id uuid; v_log_id uuid; v_reused boolean := false;
  v_sources constant text[] := array[
    -- El endpoint público /api/v1/proveedores/search ya no existe (404). La
    -- fuente local proveedores_estado conserva esos datos sin esa dependencia.
    'proveedores_estado', 'webinars', 'youtube', 'clientes',
    'webinar_invitacion', 'profiles', 'prospectos', 'academia_leads',
    'agendamientos', 'validacion'
  ];
begin
  if p_trigger_source not in ('cron', 'manual') then raise exception 'invalid trigger source'; end if;
  perform pg_advisory_xact_lock(hashtext('contact-enrichment-enqueue'));
  select id into v_run_id from public.contact_enrichment_runs
  where status in ('queued', 'processing') order by created_at desc limit 1;

  if v_run_id is not null then
    v_reused := true;
  else
    insert into public.contact_enrichment_logs (proceso, estado, metadata)
    values ('enriquecimiento_por_lotes', 'procesando', jsonb_build_object('trigger', p_trigger_source))
    returning id into v_log_id;
    insert into public.contact_enrichment_runs (log_id, trigger_source, requested_by, jobs_total)
    values (v_log_id, p_trigger_source, p_requested_by, cardinality(v_sources))
    returning id into v_run_id;
    insert into public.contact_enrichment_jobs (run_id, source)
    select v_run_id, source from unnest(v_sources) as sources(source);
    update public.contact_enrichment_logs
    set metadata = metadata || jsonb_build_object('run_id', v_run_id) where id = v_log_id;
  end if;
  return jsonb_build_object('run_id', v_run_id, 'reused', v_reused);
end;
$$;

create or replace function public.contact_enrichment_claim_job()
returns table (job_id uuid, run_id uuid, source text, cursor_value integer,
  attempt integer, max_attempts integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_exhausted_run uuid;
begin
  for v_exhausted_run in
    update public.contact_enrichment_jobs
    set status = 'failed', last_error = coalesce(last_error, 'Worker sin confirmacion'),
        locked_at = null, updated_at = now()
    where status = 'processing' and locked_at < now() - interval '5 minutes'
      and attempts >= max_attempts
    returning contact_enrichment_jobs.run_id
  loop perform public.contact_enrichment_refresh_run(v_exhausted_run); end loop;

  return query
  with candidate as (
    select j.id from public.contact_enrichment_jobs j
    where j.attempts < j.max_attempts and (
      (j.status in ('queued', 'retry') and j.available_at <= now())
      or (j.status = 'processing' and j.locked_at < now() - interval '5 minutes'))
    order by j.available_at, j.created_at for update skip locked limit 1
  ), claimed as (
    update public.contact_enrichment_jobs j
    set status = 'processing', attempts = j.attempts + 1, locked_at = now(), updated_at = now()
    from candidate c where j.id = c.id
    returning j.id, j.run_id, j.source, j.cursor_value, j.attempts, j.max_attempts
  )
  select c.id, c.run_id, c.source, c.cursor_value, c.attempts, c.max_attempts from claimed c;
end;
$$;

create or replace function public.contact_enrichment_finish_job(
  p_job_id uuid, p_has_more boolean, p_next_cursor integer,
  p_processed integer, p_new integer, p_updated integer, p_errors integer
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_run_id uuid; v_rows integer;
begin
  update public.contact_enrichment_jobs
  set status = case when p_has_more then 'queued' else 'completed' end,
      cursor_value = case when p_has_more then greatest(p_next_cursor, 0) else cursor_value end,
      attempts = case when p_has_more then 0 else attempts end,
      available_at = now(), locked_at = null,
      registros_procesados = registros_procesados + greatest(coalesce(p_processed, 0), 0),
      registros_nuevos = registros_nuevos + greatest(coalesce(p_new, 0), 0),
      registros_actualizados = registros_actualizados + greatest(coalesce(p_updated, 0), 0),
      errores = errores + greatest(coalesce(p_errors, 0), 0),
      last_error = null, updated_at = now()
  where id = p_job_id and status = 'processing' returning run_id into v_run_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'job_not_claimed'; end if;
  perform public.contact_enrichment_refresh_run(v_run_id);
  return jsonb_build_object('run_id', v_run_id, 'has_more', p_has_more);
end;
$$;

create or replace function public.contact_enrichment_fail_job(p_job_id uuid, p_error text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_run_id uuid; v_status text; v_available_at timestamptz; v_rows integer;
begin
  update public.contact_enrichment_jobs
  set status = case when attempts < max_attempts then 'retry' else 'failed' end,
      available_at = case when attempts < max_attempts then now() + make_interval(
        secs => public.contact_enrichment_retry_delay_seconds(attempts)) else available_at end,
      locked_at = null,
      last_error = left(coalesce(nullif(p_error, ''), 'Error de lote no especificado'), 500),
      updated_at = now()
  where id = p_job_id and status = 'processing'
  returning run_id, status, available_at into v_run_id, v_status, v_available_at;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'job_not_claimed'; end if;
  perform public.contact_enrichment_refresh_run(v_run_id);
  return jsonb_build_object('run_id', v_run_id, 'status', v_status, 'available_at', v_available_at);
end;
$$;

create or replace function public.contact_enrichment_dispatch(
  p_kind text, p_attempt integer default 1, p_parent_dispatch_id uuid default null
)
returns bigint language plpgsql security definer set search_path = public, vault, net, pg_temp as $$
declare v_secret text; v_request_id bigint;
begin
  if p_kind not in ('enqueue', 'worker') then raise exception 'invalid dispatch kind'; end if;
  if p_attempt < 1 or p_attempt > 5 then raise exception 'invalid dispatch attempt'; end if;
  if p_kind = 'worker' and not exists (
    select 1 from public.contact_enrichment_jobs
    where (status in ('queued', 'retry') and available_at <= now())
       or (status = 'processing' and locked_at < now() - interval '5 minutes'))
  then return null; end if;
  if exists (
    select 1 from public.contact_enrichment_http_dispatches
    where kind = p_kind and status = 'pending' and created_at > now() - interval '3 minutes'
  ) then return null; end if;
  if p_attempt = 1 and exists (
    select 1 from public.contact_enrichment_http_dispatches
    where kind = p_kind and status = 'retry' and next_retry_at > now()
  ) then return null; end if;
  if p_attempt = 1 and exists (
    select 1 from public.contact_enrichment_http_dispatches
    where kind = p_kind and status = 'failed' and checked_at > now() - interval '1 hour'
  ) then return null; end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets
  where name = 'service_role_jwt_legacy' and nullif(decrypted_secret, '') is not null limit 1;
  if v_secret is null then raise exception 'Vault secret service_role_jwt_legacy is required'; end if;

  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/contact-enrichment',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret, 'apikey', v_secret),
    body := jsonb_build_object('action', p_kind, 'source', 'pg_cron'),
    timeout_milliseconds := 120000
  ) into v_request_id;
  insert into public.contact_enrichment_http_dispatches
    (parent_dispatch_id, kind, request_id, attempt)
  values (p_parent_dispatch_id, p_kind, v_request_id, p_attempt);
  return v_request_id;
end;
$$;

create or replace function public.contact_enrichment_reconcile_http()
returns integer language plpgsql security definer set search_path = public, net, pg_temp as $$
declare v_dispatch record; v_outcome text; v_count integer := 0; v_error text;
begin
  for v_dispatch in
    select d.*, r.status_code as http_status_code, r.content as http_content,
      r.timed_out as http_timed_out, r.error_msg as http_error
    from public.contact_enrichment_http_dispatches d
    left join net._http_response r on r.id = d.request_id
    where d.status = 'pending'
      and (r.id is not null or d.created_at < now() - interval '3 minutes')
    order by d.created_at
  loop
    v_count := v_count + 1;
    v_error := coalesce(nullif(v_dispatch.http_error, ''),
      case when v_dispatch.http_status_code is null then 'Respuesta HTTP no recibida' end,
      case when v_dispatch.http_status_code not between 200 and 299
        then 'HTTP ' || v_dispatch.http_status_code::text end);
    v_outcome := public.contact_enrichment_http_outcome(
      v_dispatch.http_status_code, v_dispatch.http_timed_out, v_error,
      v_dispatch.attempt, v_dispatch.max_attempts);
    update public.contact_enrichment_http_dispatches
    set status = v_outcome, status_code = v_dispatch.http_status_code,
        timed_out = v_dispatch.http_timed_out,
        response_body = left(v_dispatch.http_content, 2000),
        error_message = left(v_error, 500), checked_at = now(),
        next_retry_at = case when v_outcome = 'retry' then now() + make_interval(
          secs => public.contact_enrichment_retry_delay_seconds(v_dispatch.attempt)) end
    where id = v_dispatch.id;

    if v_outcome = 'failed' then
      insert into public.contact_enrichment_logs
        (proceso, estado, errores, mensaje_error, fecha_fin, metadata)
      values ('despacho_enriquecimiento_' || v_dispatch.kind, 'error', 1,
        left(coalesce(v_error, 'Fallo HTTP sin detalle'), 500), now(),
        jsonb_build_object('request_id', v_dispatch.request_id, 'attempts', v_dispatch.attempt));
    end if;
  end loop;
  delete from public.contact_enrichment_http_dispatches
  where status in ('succeeded', 'retry') and checked_at < now() - interval '30 days';
  return v_count;
end;
$$;

create or replace function public.contact_enrichment_dispatch_due_retries()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_retry record; v_request_id bigint; v_count integer := 0;
begin
  for v_retry in
    select id, kind, attempt
    from public.contact_enrichment_http_dispatches
    where status = 'retry' and next_retry_at <= now()
    order by next_retry_at
    for update skip locked
    limit 5
  loop
    v_request_id := public.contact_enrichment_dispatch(
      v_retry.kind, v_retry.attempt + 1, v_retry.id);
    if v_request_id is not null then
      update public.contact_enrichment_http_dispatches
      set next_retry_at = null where id = v_retry.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

create or replace function public.contact_enrichment_tick()
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_request_id bigint;
begin
  perform public.contact_enrichment_reconcile_http();
  perform public.contact_enrichment_dispatch_due_retries();
  v_request_id := public.contact_enrichment_dispatch('worker');
  return v_request_id;
end;
$$;

revoke execute on function public.contact_enrichment_retry_delay_seconds(integer) from public, anon, authenticated;
revoke execute on function public.contact_enrichment_http_outcome(integer, boolean, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.contact_enrichment_refresh_run(uuid) from public, anon, authenticated;
revoke execute on function public.contact_enrichment_enqueue(text, uuid) from public, anon, authenticated;
revoke execute on function public.contact_enrichment_claim_job() from public, anon, authenticated;
revoke execute on function public.contact_enrichment_finish_job(uuid, boolean, integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.contact_enrichment_fail_job(uuid, text) from public, anon, authenticated;
revoke execute on function public.contact_enrichment_dispatch(text, integer, uuid) from public, anon, authenticated;
revoke execute on function public.contact_enrichment_reconcile_http() from public, anon, authenticated;
revoke execute on function public.contact_enrichment_dispatch_due_retries() from public, anon, authenticated;
revoke execute on function public.contact_enrichment_tick() from public, anon, authenticated;
grant execute on function public.contact_enrichment_retry_delay_seconds(integer) to service_role;
grant execute on function public.contact_enrichment_http_outcome(integer, boolean, text, integer, integer) to service_role;
grant execute on function public.contact_enrichment_enqueue(text, uuid) to service_role;
grant execute on function public.contact_enrichment_claim_job() to service_role;
grant execute on function public.contact_enrichment_finish_job(uuid, boolean, integer, integer, integer, integer, integer) to service_role;
grant execute on function public.contact_enrichment_fail_job(uuid, text) to service_role;

do $migration$
declare v_job record;
begin
  for v_job in select jobid from cron.job where jobname in (
    'contact-enrichment-daily', 'contact-enrichment-cron',
    'enrichment-scheduler-daily', 'contact-enrichment-worker')
  loop perform cron.unschedule(v_job.jobid); end loop;
  perform cron.schedule('contact-enrichment-daily', '0 2 * * *',
    $cron$select public.contact_enrichment_dispatch('enqueue');$cron$);
  perform cron.schedule('contact-enrichment-worker', '* * * * *',
    $cron$select public.contact_enrichment_tick();$cron$);
end
$migration$;
