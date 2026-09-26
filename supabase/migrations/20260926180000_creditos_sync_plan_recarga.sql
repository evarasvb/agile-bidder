-- Sincronización de plan + recarga mensual del motor de créditos (interno).
-- 1) creditos_asegurar_cuenta arranca la cuenta con el plan REAL del cliente (no 'free' fijo).
-- 2) Trigger: cuando cambia clientes.plan, se sincroniza creditos_cuenta.
-- 3) Backfill de las cuentas ya creadas.
-- 4) Recarga mensual de los planes con recarga 'mensual' (función + pg_cron).

-- ─────────────────────────────────────────────────────────────
-- 1) ASEGURAR CUENTA con el plan real del cliente
-- ─────────────────────────────────────────────────────────────
create or replace function public.creditos_asegurar_cuenta(p_user_id uuid)
returns public.creditos_cuenta
language plpgsql security definer set search_path to 'public' as $$
declare v_row public.creditos_cuenta; v_plan text; v_cred int;
begin
  select * into v_row from public.creditos_cuenta where user_id = p_user_id;
  if found then return v_row; end if;
  -- Plan real del cliente (si tiene ficha); si no, 'free'.
  select coalesce(c.plan, 'free') into v_plan from public.clientes c where c.user_id = p_user_id limit 1;
  v_plan := coalesce(v_plan, 'free');
  if not exists (select 1 from public.planes where id = v_plan and activo) then v_plan := 'free'; end if;
  select creditos_incluidos into v_cred from public.planes where id = v_plan;
  insert into public.creditos_cuenta (user_id, plan, saldo, renovado_en)
  values (p_user_id, v_plan, coalesce(v_cred, 0), now())
  on conflict (user_id) do nothing;
  insert into public.creditos_movimientos (user_id, accion, creditos, saldo_despues, motivo)
  values (p_user_id, 'bienvenida', coalesce(v_cred,0), coalesce(v_cred,0), 'Créditos de bienvenida (plan '||v_plan||')');
  select * into v_row from public.creditos_cuenta where user_id = p_user_id;
  return v_row;
end; $$;

-- ─────────────────────────────────────────────────────────────
-- 2) TRIGGER: sincroniza la cuenta cuando cambia el plan del cliente
-- ─────────────────────────────────────────────────────────────
create or replace function public.creditos_sync_plan_trigger()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_plan public.planes; v_saldo int;
begin
  if NEW.user_id is null then return NEW; end if;
  if NEW.plan is distinct from OLD.plan and NEW.plan is not null then
    select * into v_plan from public.planes where id = NEW.plan and activo;
    if found then
      insert into public.creditos_cuenta (user_id, plan, saldo, renovado_en)
      values (NEW.user_id, NEW.plan, coalesce(v_plan.creditos_incluidos, 0), now())
      on conflict (user_id) do update
        set plan = excluded.plan,
            saldo = case when v_plan.recarga_creditos in ('mensual','unica')
                         then greatest(public.creditos_cuenta.saldo, v_plan.creditos_incluidos)
                         else public.creditos_cuenta.saldo end,
            renovado_en = now(), actualizado_en = now();
      select saldo into v_saldo from public.creditos_cuenta where user_id = NEW.user_id;
      insert into public.creditos_movimientos (user_id, accion, creditos, saldo_despues, motivo)
      values (NEW.user_id, 'plan', coalesce(v_plan.creditos_incluidos,0), coalesce(v_saldo,0), 'Sincronización de plan '||v_plan.nombre);
    end if;
  end if;
  return NEW;
end; $$;

drop trigger if exists clientes_plan_sync on public.clientes;
create trigger clientes_plan_sync
  after update of plan on public.clientes
  for each row execute function public.creditos_sync_plan_trigger();

-- ─────────────────────────────────────────────────────────────
-- 3) BACKFILL: alinear cuentas existentes con el plan real del cliente
-- ─────────────────────────────────────────────────────────────
update public.creditos_cuenta cc
set plan = c.plan,
    saldo = case when p.recarga_creditos in ('mensual','unica')
                 then greatest(cc.saldo, p.creditos_incluidos) else cc.saldo end,
    renovado_en = coalesce(cc.renovado_en, now()),
    actualizado_en = now()
from public.clientes c
join public.planes p on p.id = c.plan
where cc.user_id = c.user_id
  and c.plan is not null
  and c.plan is distinct from cc.plan;

-- ─────────────────────────────────────────────────────────────
-- 4) RECARGA MENSUAL (planes 'mensual'): resetea al cupo del plan cada ~30 días
-- ─────────────────────────────────────────────────────────────
create or replace function public.creditos_recargar_mensuales()
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int := 0;
begin
  with actualizados as (
    update public.creditos_cuenta cc
    set saldo = p.creditos_incluidos, renovado_en = now(), actualizado_en = now()
    from public.planes p
    where p.id = cc.plan
      and p.recarga_creditos = 'mensual'
      and (cc.renovado_en is null or cc.renovado_en < now() - interval '30 days')
    returning cc.user_id, cc.saldo
  ), mov as (
    insert into public.creditos_movimientos (user_id, accion, creditos, saldo_despues, motivo)
    select user_id, 'recarga', saldo, saldo, 'Recarga mensual del plan' from actualizados
    returning 1
  )
  select count(*) into n from mov;
  return n;
end; $$;

revoke all on function public.creditos_recargar_mensuales() from public, anon, authenticated;
grant execute on function public.creditos_recargar_mensuales() to service_role;

-- Cron diario que recarga a quien le corresponda (idempotente: solo los vencidos).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'creditos-recarga-mensual') then
      perform cron.unschedule('creditos-recarga-mensual');
    end if;
    perform cron.schedule('creditos-recarga-mensual', '13 6 * * *', $cron$select public.creditos_recargar_mensuales();$cron$);
  end if;
end $$;
