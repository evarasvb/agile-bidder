-- Qualify columns that share names with RETURNS TABLE variables.
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

  update public.academia_mp_inbox as inbox
  set estado = case when inbox.intentos >= 8 then 'dead' else 'retry' end,
      locked_at = null,
      next_attempt_at = case when inbox.intentos >= 8 then inbox.next_attempt_at else now() end,
      processed_at = case when inbox.intentos >= 8 then now() else inbox.processed_at end,
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

