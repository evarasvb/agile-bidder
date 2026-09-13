-- Match producto-por-producto de LICITACIONES, POR CLIENTE (como ca_item_matches
-- para compras ágiles). Antes el match de licitaciones se guardaba en la fila
-- COMPARTIDA de la licitación (licitaciones_bi.match_score) y se calculaba contra
-- el inventario de TODOS los clientes: no había desglose por ítem y el % podía
-- venir de productos de otro cliente. Esta tabla lo hace por cliente y por ítem.
create table if not exists public.lic_item_matches (
  id                 uuid primary key default gen_random_uuid(),
  licitacion_codigo  text not null,
  item_id            uuid not null,
  cliente_id         uuid not null,
  nombre_solicitado  text,
  cantidad           numeric,
  inventario_id      uuid,
  nombre_producto    text,
  sku                text,
  precio_unitario    numeric,
  score              numeric,
  fecha_cierre       timestamptz,
  updated_at         timestamptz not null default now(),
  unique (item_id, cliente_id)
);

create index if not exists idx_lic_item_matches_cliente_cierre on public.lic_item_matches(cliente_id, fecha_cierre);
create index if not exists idx_lic_item_matches_codigo on public.lic_item_matches(licitacion_codigo);

alter table public.lic_item_matches enable row level security;
drop policy if exists lic_item_matches_select_owner on public.lic_item_matches;
create policy lic_item_matches_select_owner on public.lic_item_matches
  for select using (cliente_id = (select public.cliente_owner_id()));

-- Generador por cliente. Mismo patrón que generar_matches_ca_items pero sobre
-- licitaciones_bi / licitaciones_bi_items. Código ONU aporta base 0.5 + 0.5*texto.
create or replace function public.generar_matches_lic_items_cliente(p_cliente uuid, p_umbral real default 0.30)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n integer;
begin
  perform set_config('pg_trgm.word_similarity_threshold', '0.45', true);
  insert into public.lic_item_matches (licitacion_codigo, item_id, cliente_id, nombre_solicitado, cantidad,
                                        inventario_id, nombre_producto, sku, precio_unitario, score, fecha_cierre)
  select b.codigo, b.item_id, p_cliente, b.nombre_solicitado, b.cantidad,
         b.inv_id, b.nombre_producto, b.sku, b.precio_unitario, round((b.sim*100)::numeric,1), b.fecha_cierre
  from (
    select distinct on (it.id)
           l.codigo, it.id as item_id, it.nombre_producto as nombre_solicitado, it.cantidad,
           l.fecha_cierre, m.id as inv_id, m.nombre_producto, m.sku, m.precio_unitario, m.sim
    from public.licitaciones_bi l
    join public.licitaciones_bi_items it on it.licitacion_id = l.id
    cross join lateral (
      select id, nombre_producto, sku, precio_unitario,
        case when it.codigo_producto is not null and codigo_producto is not null and codigo_producto = it.codigo_producto
             then 0.5::real + 0.5::real * coalesce(word_similarity(nombre_norm, it.nombre_norm), 0::real)
             else coalesce(word_similarity(nombre_norm, it.nombre_norm), 0::real) end as sim
      from public.cliente_inventario
      where cliente_id = p_cliente and it.nombre_norm is not null
        and (nombre_norm %> it.nombre_norm or (it.codigo_producto is not null and codigo_producto = it.codigo_producto))
      order by sim desc limit 1
    ) m
    where (l.estado is null or l.estado ilike 'publicada' or l.estado ilike 'activa')
      and l.fecha_cierre > now() and it.nombre_norm is not null
    order by it.id, m.sim desc
  ) b
  where b.sim >= p_umbral
  on conflict (item_id, cliente_id) do update
    set inventario_id=excluded.inventario_id, nombre_producto=excluded.nombre_producto, sku=excluded.sku,
        precio_unitario=excluded.precio_unitario, score=excluded.score, fecha_cierre=excluded.fecha_cierre,
        nombre_solicitado=excluded.nombre_solicitado, cantidad=excluded.cantidad, updated_at=now();
  get diagnostics n = row_count;
  return n;
end
$function$;

-- Lote: recorre los clientes con inventario, reconcilia (borra lo viejo del
-- cliente) y regenera. Lo corre el cron; es demasiado pesado para una llamada
-- sincrónica del navegador (por eso las licitaciones NO se recalculan on-demand
-- al cargar inventario; se refrescan por cron, que es suficiente porque las
-- licitaciones tienen plazos largos).
create or replace function public.generar_matches_lic_items_todos()
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare r record; total int := 0; k int;
begin
  for r in select distinct cliente_id from public.cliente_inventario loop
    delete from public.lic_item_matches where cliente_id = r.cliente_id;
    k := public.generar_matches_lic_items_cliente(r.cliente_id);
    total := total + coalesce(k,0);
  end loop;
  return total;
end
$function$;

-- Cron horario (idempotente).
select cron.unschedule('match-lic-items-cliente-horario')
where exists (select 1 from cron.job where jobname = 'match-lic-items-cliente-horario');
select cron.schedule('match-lic-items-cliente-horario', '37 * * * *',
  $job$ set statement_timeout=0; select public.generar_matches_lic_items_todos(); $job$);
