-- =====================================================================
-- Nivel 2: la IA aprende del comportamiento del cliente
-- =====================================================================
-- Registramos SEÑALES (qué descarta, qué cotiza) para que la IA vaya afinando
-- los filtros del cliente con el tiempo.

create table if not exists public.cliente_senales (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null,                 -- 'descartada' | 'cotizada' | 'guardada' | 'vista'
  oportunidad_tipo text,              -- 'compra_agil' | 'licitacion'
  codigo text,
  titulo text,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_senales_cliente_tipo on public.cliente_senales (cliente_id, tipo, created_at desc);

alter table public.cliente_senales enable row level security;

drop policy if exists "senales_select_own" on public.cliente_senales;
create policy "senales_select_own" on public.cliente_senales for select
  using (cliente_id in (select id from public.clientes where user_id = (select auth.uid())));
drop policy if exists "senales_insert_own" on public.cliente_senales;
create policy "senales_insert_own" on public.cliente_senales for insert
  with check (cliente_id in (select id from public.clientes where user_id = (select auth.uid())));
drop policy if exists "senales_service" on public.cliente_senales;
create policy "senales_service" on public.cliente_senales for all
  using ((select auth.role()) = 'service_role');

-- La IA aprende: analiza los títulos de lo DESCARTADO (candidatas a excluir) y de
-- lo COTIZADO (candidatas a incluir/reforzar), descartando lo que ya está en los
-- filtros. Devuelve sugerencias accionables.
create or replace function public.cliente_aprendizaje(p_cliente uuid, p_dias int default 120)
returns jsonb
language sql stable security definer set search_path = public
as $function$
  with stop as (
    select unnest(array['para','con','sin','por','los','las','del','una','uno','que','the','and',
      'servicio','servicios','adquisicion','compra','contratacion','suministro','provision','arriendo',
      'municipalidad','hospital','ilustre','direccion','region','regional','comunal','publico','publica',
      'material','materiales','insumo','insumos','varios','varias','general','generales','ano','anos']) as w
  ),
  incl as (
    select lower(public.f_unaccent(w)) w from unnest(coalesce(
      (select palabras_incluir from public.cliente_filtros_oportunidades where cliente_id = p_cliente), '{}'::text[])) w
  ),
  excl as (
    select lower(public.f_unaccent(w)) w from unnest(coalesce(
      (select palabras_excluir from public.cliente_filtros_oportunidades where cliente_id = p_cliente), '{}'::text[])) w
  ),
  desc_tok as (
    select w, count(*) c from (
      select t as w from public.cliente_senales s,
        regexp_split_to_table(lower(public.f_unaccent(coalesce(s.titulo,''))), '[^a-z]+') t
      where s.cliente_id = p_cliente and s.tipo = 'descartada'
        and s.created_at > now() - (p_dias||' days')::interval
    ) x
    where length(w) >= 4 and w not in (select w from stop) and w not in (select w from excl)
    group by w
  ),
  cot_tok as (
    select w, count(*) c from (
      select t as w from public.cliente_senales s,
        regexp_split_to_table(lower(public.f_unaccent(coalesce(s.titulo,''))), '[^a-z]+') t
      where s.cliente_id = p_cliente and s.tipo = 'cotizada'
        and s.created_at > now() - (p_dias||' days')::interval
    ) x
    where length(w) >= 4 and w not in (select w from stop) and w not in (select w from incl)
    group by w
  )
  select jsonb_build_object(
    'total_senales', (select count(*) from public.cliente_senales where cliente_id = p_cliente),
    'descartadas', (select count(*) from public.cliente_senales where cliente_id = p_cliente and tipo='descartada'),
    'cotizadas', (select count(*) from public.cliente_senales where cliente_id = p_cliente and tipo='cotizada'),
    'excluir_sugeridas', coalesce((select jsonb_agg(x) from (select w as palabra, c as veces from desc_tok where c >= 2 order by c desc limit 6) x), '[]'::jsonb),
    'incluir_sugeridas', coalesce((select jsonb_agg(x) from (select w as palabra, c as veces from cot_tok where c >= 2 order by c desc limit 6) x), '[]'::jsonb)
  );
$function$;

grant execute on function public.cliente_aprendizaje(uuid, int) to anon, authenticated;
