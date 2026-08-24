-- Match ÍTEM POR ÍTEM de las compras ágiles contra el inventario del cliente.
-- (La tabla ca_matches guarda solo la mejor coincidencia por compra; esta guarda
--  una por cada ítem pedido, para mostrar la tabla producto-a-producto.)
create table if not exists public.ca_item_matches (
  id uuid primary key default gen_random_uuid(),
  compra_agil_codigo text not null,
  item_id uuid not null,
  cliente_id uuid not null,
  nombre_solicitado text,
  cantidad numeric,
  inventario_id uuid,
  nombre_producto text,
  sku text,
  precio_unitario numeric,
  score numeric,
  fecha_cierre timestamptz,
  updated_at timestamptz not null default now(),
  unique (item_id, cliente_id)
);
create index if not exists idx_ca_item_matches_codigo_cli on public.ca_item_matches(compra_agil_codigo, cliente_id);
create index if not exists idx_ca_item_matches_cliente on public.ca_item_matches(cliente_id);

alter table public.ca_item_matches enable row level security;
drop policy if exists "ca_item_matches_select_owner" on public.ca_item_matches;
create policy "ca_item_matches_select_owner" on public.ca_item_matches
  for select using (cliente_id = public.cliente_owner_id());

create or replace function public.generar_matches_ca_items(p_cliente uuid, p_umbral real default 0.30)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n integer;
begin
  perform set_config('pg_trgm.word_similarity_threshold', '0.45', true);
  insert into public.ca_item_matches (compra_agil_codigo, item_id, cliente_id, nombre_solicitado, cantidad,
                                       inventario_id, nombre_producto, sku, precio_unitario, score, fecha_cierre)
  select b.codigo, b.item_id, p_cliente, b.nombre_solicitado, b.cantidad,
         b.inv_id, b.nombre_producto, b.sku, b.precio_unitario, round((b.sim*100)::numeric,1), b.fecha_cierre
  from (
    select distinct on (i.id)
           ca.codigo, i.id as item_id, i.nombre_producto as nombre_solicitado, i.cantidad,
           ca.fecha_cierre, m.id as inv_id, m.nombre_producto, m.sku, m.precio_unitario, m.sim
    from public.compras_agiles ca
    join public.compras_agiles_items i on i.compra_agil_id = ca.id
    cross join lateral (
      select id, nombre_producto, sku, precio_unitario, greatest(
        case when i.codigo_producto is not null and codigo_producto is not null and codigo_producto = i.codigo_producto then 1.0::real else 0::real end,
        coalesce(word_similarity(nombre_norm, i.nombre_norm), 0::real)
      ) as sim
      from public.cliente_inventario
      where cliente_id = p_cliente and i.nombre_norm is not null
        and (nombre_norm %> i.nombre_norm or (i.codigo_producto is not null and codigo_producto = i.codigo_producto))
      order by sim desc limit 1
    ) m
    where ca.fecha_cierre >= now() and ca.estado ilike 'publicada' and i.nombre_norm is not null
    order by i.id, m.sim desc
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

create or replace function public.generar_matches_ca_items_todos()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare c record; total integer := 0;
begin
  for c in select id from public.clientes loop
    total := total + public.generar_matches_ca_items(c.id, 0.30);
  end loop;
  return total;
end
$function$;

-- Cron cada 20 min (idempotente).
select cron.unschedule('match-ca-items-horario') where exists (select 1 from cron.job where jobname = 'match-ca-items-horario');
select cron.schedule('match-ca-items-horario', '*/20 * * * *', $$select public.generar_matches_ca_items_todos();$$);
