-- Sistema de créditos FirmaVB
-- Se cuelga de la tabla public.planes existente (id: free/business/pro/enterprise),
-- agregando columnas de créditos, y añade: costos por acción, libreta (saldo + movimientos),
-- medidor de costo real de IA y la lógica de cobro (consumir_creditos). Aditivo e idempotente.

-- ─────────────────────────────────────────────────────────────
-- 1) CRÉDITOS EN LA TABLA DE PLANES EXISTENTE
-- ─────────────────────────────────────────────────────────────
alter table public.planes add column if not exists creditos_incluidos int not null default 0;
alter table public.planes add column if not exists recarga_creditos text not null default 'unica'; -- unica | mensual | ilimitado

update public.planes set creditos_incluidos = 30,   recarga_creditos = 'unica'     where id = 'free'       and creditos_incluidos = 0;
update public.planes set creditos_incluidos = 500,  recarga_creditos = 'mensual'   where id = 'business'   and creditos_incluidos = 0;
update public.planes set creditos_incluidos = 1500, recarga_creditos = 'mensual'   where id = 'pro'        and creditos_incluidos = 0;
update public.planes set creditos_incluidos = 0,    recarga_creditos = 'ilimitado' where id = 'enterprise';

-- ─────────────────────────────────────────────────────────────
-- 2) COSTOS POR ACCIÓN (pesos configurables, sin redeploy)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.creditos_costos (
  accion text primary key,
  grupo text not null,          -- gratis | ligero | medio | pesado | muy_pesado
  creditos int not null,
  descripcion text
);
insert into public.creditos_costos (accion, grupo, creditos, descripcion) values
  ('ver_licitaciones',   'gratis',     0,  'Buscar y ver licitaciones'),
  ('match',              'ligero',     1,  'Match IA de una oportunidad'),
  ('scoring',            'ligero',     1,  'Scoring de una oportunidad'),
  ('veredicto',          'ligero',     1,  'Veredicto de una oportunidad'),
  ('cm_producto',        'ligero',     1,  'Cargar 1 producto en Convenio Marco'),
  ('vectorizar_item',    'ligero',     1,  'Vectorizar 1 ítem de inventario'),
  ('experto_consulta',   'medio',      3,  'Una pregunta al Experto'),
  ('abogado_consulta',   'medio',      3,  'Una consulta al Abogado'),
  ('evaristo_consulta',  'medio',      3,  'Una consulta a Evaristo'),
  ('ficha_tecnica',      'medio',      3,  'Ficha técnica con IA'),
  ('enriquecer_producto','medio',      3,  'Enriquecer 1 producto con IA'),
  ('foto_producto',      'medio',      3,  'Generar/buscar foto de producto'),
  ('marketing_generar',  'medio',      3,  'Generar contenido de marketing'),
  ('experto_bases',      'pesado',     8,  'Estudiar bases completas'),
  ('experto_matriz',     'pesado',     8,  'Matriz de adjudicación'),
  ('experto_bajo_agua',  'pesado',     8,  'Investigación Bajo el Agua'),
  ('anexo_word',         'pesado',     8,  'Generar anexo Word'),
  ('cotizacion_pdf',     'pesado',     8,  'Generar cotización PDF'),
  ('experto_pptx',       'muy_pesado', 15, 'Generar presentación PPTX'),
  ('experto_estudio',    'muy_pesado', 15, 'Estudio profundo multi-documento')
on conflict (accion) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 3) CUENTA DE CRÉDITOS (saldo por usuario)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.creditos_cuenta (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' references public.planes(id),
  saldo int not null default 0,
  renovado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
alter table public.creditos_cuenta enable row level security;
drop policy if exists creditos_cuenta_lee_propia on public.creditos_cuenta;
create policy creditos_cuenta_lee_propia on public.creditos_cuenta
  for select to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 4) MOVIMIENTOS (libreta / ledger)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.creditos_movimientos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  accion text not null,
  creditos int not null,
  saldo_despues int not null,
  referencia text,
  motivo text,
  creado_en timestamptz not null default now()
);
create index if not exists creditos_mov_user_fecha on public.creditos_movimientos (user_id, creado_en desc);
alter table public.creditos_movimientos enable row level security;
drop policy if exists creditos_mov_lee_propia on public.creditos_movimientos;
create policy creditos_mov_lee_propia on public.creditos_movimientos
  for select to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 5) MEDIDOR DE COSTO REAL DE IA
-- ─────────────────────────────────────────────────────────────
create table if not exists public.uso_ia_costo (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  funcion text not null,
  modelo text,
  tokens_in int,
  tokens_out int,
  costo_usd numeric(12,6),
  creditos_cobrados int,
  referencia text,
  creado_en timestamptz not null default now()
);
create index if not exists uso_ia_costo_fecha on public.uso_ia_costo (creado_en desc);
create index if not exists uso_ia_costo_funcion on public.uso_ia_costo (funcion);
alter table public.uso_ia_costo enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 6) ASEGURAR CUENTA (créditos de bienvenida)
-- ─────────────────────────────────────────────────────────────
create or replace function public.creditos_asegurar_cuenta(p_user_id uuid)
returns public.creditos_cuenta
language plpgsql security definer set search_path to 'public' as $$
declare v_row public.creditos_cuenta; v_bienvenida int;
begin
  select * into v_row from public.creditos_cuenta where user_id = p_user_id;
  if found then return v_row; end if;
  select creditos_incluidos into v_bienvenida from public.planes where id = 'free';
  insert into public.creditos_cuenta (user_id, plan, saldo, renovado_en)
  values (p_user_id, 'free', coalesce(v_bienvenida, 0), now())
  on conflict (user_id) do nothing;
  insert into public.creditos_movimientos (user_id, accion, creditos, saldo_despues, motivo)
  values (p_user_id, 'bienvenida', coalesce(v_bienvenida,0), coalesce(v_bienvenida,0), 'Créditos de bienvenida (Free)');
  select * into v_row from public.creditos_cuenta where user_id = p_user_id;
  return v_row;
end; $$;

-- ─────────────────────────────────────────────────────────────
-- 7) CONSUMIR CRÉDITOS (la lógica de cobro; el muro)
-- ─────────────────────────────────────────────────────────────
create or replace function public.consumir_creditos(
  p_accion text, p_cantidad int default 1, p_referencia text default null, p_user_id uuid default null
) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_role text := coalesce((select auth.jwt() ->> 'role'), '');
  v_uid uuid; v_peso int; v_costo int;
  v_cuenta public.creditos_cuenta; v_plan public.planes;
begin
  v_uid := case when v_role = 'service_role' then coalesce(p_user_id, auth.uid()) else auth.uid() end;
  if v_uid is null then return jsonb_build_object('ok', false, 'motivo', 'sin_usuario'); end if;
  v_cuenta := public.creditos_asegurar_cuenta(v_uid);
  select * into v_plan from public.planes where id = v_cuenta.plan;
  select creditos into v_peso from public.creditos_costos where accion = p_accion;
  v_peso := coalesce(v_peso, 0);
  v_costo := v_peso * greatest(coalesce(p_cantidad, 1), 1);
  if coalesce(v_plan.recarga_creditos, '') = 'ilimitado' then
    insert into public.creditos_movimientos (user_id, accion, creditos, saldo_despues, referencia, motivo)
    values (v_uid, p_accion, 0, v_cuenta.saldo, p_referencia, 'ilimitado');
    return jsonb_build_object('ok', true, 'saldo', v_cuenta.saldo, 'cobrado', 0, 'motivo', 'ilimitado');
  end if;
  if v_costo = 0 then
    return jsonb_build_object('ok', true, 'saldo', v_cuenta.saldo, 'cobrado', 0, 'motivo', 'gratis');
  end if;
  if v_cuenta.saldo < v_costo then
    return jsonb_build_object('ok', false, 'saldo', v_cuenta.saldo, 'cobrado', 0, 'requiere', v_costo, 'motivo', 'sin_creditos');
  end if;
  update public.creditos_cuenta set saldo = saldo - v_costo, actualizado_en = now()
    where user_id = v_uid returning * into v_cuenta;
  insert into public.creditos_movimientos (user_id, accion, creditos, saldo_despues, referencia)
  values (v_uid, p_accion, -v_costo, v_cuenta.saldo, p_referencia);
  return jsonb_build_object('ok', true, 'saldo', v_cuenta.saldo, 'cobrado', v_costo, 'motivo', 'ok');
end; $$;

-- ─────────────────────────────────────────────────────────────
-- 8) SALDO (barra de créditos)
-- ─────────────────────────────────────────────────────────────
create or replace function public.creditos_saldo()
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_cuenta public.creditos_cuenta; v_plan public.planes;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  v_cuenta := public.creditos_asegurar_cuenta(auth.uid());
  select * into v_plan from public.planes where id = v_cuenta.plan;
  return jsonb_build_object('ok', true, 'saldo', v_cuenta.saldo, 'plan', v_cuenta.plan,
    'plan_nombre', v_plan.nombre, 'ilimitado', (v_plan.recarga_creditos = 'ilimitado'));
end; $$;

-- ─────────────────────────────────────────────────────────────
-- 9) MEDIDOR: registrar costo real (service_role)
-- ─────────────────────────────────────────────────────────────
create or replace function public.registrar_uso_ia(
  p_funcion text, p_modelo text, p_tokens_in int, p_tokens_out int,
  p_costo_usd numeric, p_user_id uuid default null, p_creditos_cobrados int default null, p_referencia text default null
) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.uso_ia_costo (user_id, funcion, modelo, tokens_in, tokens_out, costo_usd, creditos_cobrados, referencia)
  values (p_user_id, p_funcion, p_modelo, p_tokens_in, p_tokens_out, p_costo_usd, p_creditos_cobrados, p_referencia);
end; $$;

-- ─────────────────────────────────────────────────────────────
-- 10) FUNDADOR
-- ─────────────────────────────────────────────────────────────
create or replace function public.fundador_creditos_otorgar(p_user_id uuid, p_creditos int, p_motivo text default 'ajuste manual')
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_cuenta public.creditos_cuenta;
begin
  if coalesce((select auth.jwt() ->> 'email'), '') <> 'evaras@firmavb.cl' then return jsonb_build_object('ok', false); end if;
  perform public.creditos_asegurar_cuenta(p_user_id);
  update public.creditos_cuenta set saldo = greatest(saldo + p_creditos, 0), actualizado_en = now()
    where user_id = p_user_id returning * into v_cuenta;
  insert into public.creditos_movimientos (user_id, accion, creditos, saldo_despues, motivo)
  values (p_user_id, 'ajuste', p_creditos, v_cuenta.saldo, p_motivo);
  return jsonb_build_object('ok', true, 'saldo', v_cuenta.saldo);
end; $$;

create or replace function public.fundador_plan_set(p_user_id uuid, p_plan text)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_plan public.planes; v_cuenta public.creditos_cuenta;
begin
  if coalesce((select auth.jwt() ->> 'email'), '') <> 'evaras@firmavb.cl' then return jsonb_build_object('ok', false); end if;
  select * into v_plan from public.planes where id = p_plan and activo;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'plan_invalido'); end if;
  perform public.creditos_asegurar_cuenta(p_user_id);
  update public.creditos_cuenta
    set plan = p_plan,
        saldo = case when v_plan.recarga_creditos in ('mensual','unica') then saldo + v_plan.creditos_incluidos else saldo end,
        renovado_en = now(), actualizado_en = now()
    where user_id = p_user_id returning * into v_cuenta;
  insert into public.creditos_movimientos (user_id, accion, creditos, saldo_despues, motivo)
  values (p_user_id, 'plan', v_plan.creditos_incluidos, v_cuenta.saldo, 'Cambio a plan '||v_plan.nombre);
  return jsonb_build_object('ok', true, 'saldo', v_cuenta.saldo, 'plan', p_plan);
end; $$;

create or replace function public.fundador_costos_listar()
returns setof public.creditos_costos
language sql security definer set search_path to 'public' as $$
  select * from public.creditos_costos
  where coalesce((select auth.jwt() ->> 'email'), '') = 'evaras@firmavb.cl'
  order by creditos, accion;
$$;

create or replace function public.fundador_costo_set(p_accion text, p_creditos int)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce((select auth.jwt() ->> 'email'), '') <> 'evaras@firmavb.cl' then return jsonb_build_object('ok', false); end if;
  update public.creditos_costos set creditos = p_creditos where accion = p_accion;
  return jsonb_build_object('ok', found);
end; $$;

create or replace function public.fundador_uso_ia_resumen(p_dias int default 7)
returns table(funcion text, llamadas bigint, costo_usd_total numeric, costo_usd_prom numeric, tokens_prom numeric)
language sql security definer set search_path to 'public' as $$
  select funcion, count(*)::bigint,
         round(sum(costo_usd)::numeric, 4),
         round(avg(costo_usd)::numeric, 6),
         round(avg(coalesce(tokens_in,0)+coalesce(tokens_out,0))::numeric, 0)
  from public.uso_ia_costo
  where coalesce((select auth.jwt() ->> 'email'), '') = 'evaras@firmavb.cl'
    and creado_en >= now() - make_interval(days => p_dias)
  group by funcion order by 2 desc;
$$;

-- ─────────────────────────────────────────────────────────────
-- 11) PERMISOS
-- ─────────────────────────────────────────────────────────────
revoke all on function public.consumir_creditos(text,int,text,uuid) from public, anon;
grant execute on function public.consumir_creditos(text,int,text,uuid) to authenticated, service_role;
grant execute on function public.creditos_saldo() to authenticated;
grant execute on function public.creditos_asegurar_cuenta(uuid) to authenticated, service_role;
revoke all on function public.registrar_uso_ia(text,text,int,int,numeric,uuid,int,text) from public, anon, authenticated;
grant execute on function public.registrar_uso_ia(text,text,int,int,numeric,uuid,int,text) to service_role;
grant execute on function public.fundador_creditos_otorgar(uuid,int,text) to authenticated;
grant execute on function public.fundador_plan_set(uuid,text) to authenticated;
grant execute on function public.fundador_costos_listar() to authenticated;
grant execute on function public.fundador_costo_set(text,int) to authenticated;
grant execute on function public.fundador_uso_ia_resumen(int) to authenticated;
