-- Reviewable proposal: install functions first; enable the separate scheduler
-- only after a production-sized batch has been measured. No full-client delete.
create schema if not exists firmavb_internal;
revoke all on schema firmavb_internal from public, anon, authenticated;
grant usage on schema firmavb_internal to service_role;

create table if not exists firmavb_internal.lic_match_queue (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  cursor_item uuid,
  next_run_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  cycle_started_at timestamptz,
  last_cycle_completed_at timestamptz,
  failure_count integer not null default 0,
  last_error text
);
alter table firmavb_internal.lic_match_queue enable row level security;
revoke all on firmavb_internal.lic_match_queue from public, anon, authenticated;
grant select, insert, update, delete on firmavb_internal.lic_match_queue to service_role;
create index if not exists lic_match_queue_due_idx
  on firmavb_internal.lic_match_queue(next_run_at, last_attempt_at);

create or replace function firmavb_internal.recalcular_lic_lote(
  p_cliente uuid, p_cursor uuid default null, p_limite integer default 10,
  p_umbral real default 0.30
) returns jsonb language plpgsql security invoker set search_path = public, extensions
as $function$
declare v_items uuid[]; v_count integer; n integer; v_limit integer;
begin
  if p_cliente is null then raise exception 'cliente requerido'; end if;
  if p_limite is null or p_limite < 1 or p_limite > 500 then
    raise exception 'limite debe estar entre 1 y 500';
  end if;
  v_limit := p_limite;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_items from (
    select it.id from public.licitaciones_bi_items it
    join public.licitaciones_bi l on l.id = it.licitacion_id
    where (p_cursor is null or it.id > p_cursor)
      and (l.estado is null or l.estado ilike 'publicada' or l.estado ilike 'activa')
      and l.fecha_cierre > now() and it.nombre_norm is not null
    order by it.id limit v_limit
  ) selected;
  v_count := cardinality(v_items);
  -- Delete and replace only this bounded batch, in the same transaction.
  -- If matching fails, both deletion and replacement are rolled back.
  delete from public.lic_item_matches
    where cliente_id = p_cliente and item_id = any(v_items);
  perform set_config('pg_trgm.strict_word_similarity_threshold', '0.45', true);
  perform set_config('pg_trgm.word_similarity_threshold', '0.45', true);
  perform set_config('hnsw.ef_search', '100', true);
  perform set_config('hnsw.iterative_scan', 'relaxed_order', true);
  insert into public.lic_item_matches (licitacion_codigo, item_id, cliente_id, nombre_solicitado, cantidad,
                                        inventario_id, nombre_producto, sku, precio_unitario, score, fecha_cierre)
  select b.codigo, b.item_id, p_cliente, b.nombre_solicitado, b.cantidad,
         b.inv_id, b.nombre_producto, b.sku, b.precio_unitario, round((b.sim*100)::numeric,1), b.fecha_cierre
  from (
    select distinct on (it.id)
           l.codigo, it.id as item_id,
           coalesce(nullif(trim(it.descripcion),''), it.nombre_producto) as nombre_solicitado,
           it.cantidad,
           l.fecha_cierre, m.id as inv_id, m.nombre_producto, m.sku, m.precio_unitario, m.sim
    from public.licitaciones_bi l
    join public.licitaciones_bi_items it on it.licitacion_id = l.id
    cross join lateral (
      select ci.id, ci.nombre_producto, ci.sku, ci.precio_unitario,
             public.match_sim_v3(ci.nombre_norm, ci.busqueda_match, ci.codigo_producto, ci.embedding,
                                 it.nombre_norm, it.codigo_producto, it.embedding) as sim
      from (
        select c1.id from public.cliente_inventario c1
        where c1.cliente_id = p_cliente
          and (c1.nombre_norm %>> it.nombre_norm or c1.busqueda_match %> it.nombre_norm
               or (it.codigo_producto is not null and c1.codigo_producto = it.codigo_producto))
        union
        select c2.id from (
          select c3.id from public.cliente_inventario c3
          where c3.cliente_id = p_cliente and c3.embedding is not null and it.embedding is not null
          order by c3.embedding operator(extensions.<=>) it.embedding
          limit 5
        ) c2
      ) cand
      join public.cliente_inventario ci on ci.id = cand.id
      order by sim desc limit 1
    ) m
    where (l.estado is null or l.estado ilike 'publicada' or l.estado ilike 'activa')
      and l.fecha_cierre > now() and it.nombre_norm is not null
      and it.id = any(v_items)
    order by it.id, m.sim desc
  ) b
  where b.sim >= p_umbral
  on conflict (item_id, cliente_id) do update
    set inventario_id=excluded.inventario_id, nombre_producto=excluded.nombre_producto, sku=excluded.sku,
        precio_unitario=excluded.precio_unitario, score=excluded.score, fecha_cierre=excluded.fecha_cierre,
        nombre_solicitado=excluded.nombre_solicitado, cantidad=excluded.cantidad, updated_at=now();
  get diagnostics n = row_count;
  return jsonb_build_object('processed', v_count, 'matches', n,
    'cursor', case when v_count > 0 then v_items[v_count] else p_cursor end,
    'complete', v_count < v_limit);
end
$function$;
revoke all on function firmavb_internal.recalcular_lic_lote(uuid,uuid,integer,real)
  from public, anon, authenticated;
grant execute on function firmavb_internal.recalcular_lic_lote(uuid,uuid,integer,real) to service_role;

create or replace function firmavb_internal.procesar_lic_match_queue(p_limite integer default 10)
returns jsonb language plpgsql security invoker set search_path = public, extensions
as $function$
declare q firmavb_internal.lic_match_queue%rowtype; result jsonb;
begin
  if p_limite is null or p_limite < 1 or p_limite > 500 then
    raise exception 'limite debe estar entre 1 y 500';
  end if;
  insert into firmavb_internal.lic_match_queue(cliente_id)
    select cliente_id from public.cliente_inventario
    union select cliente_id from public.lic_item_matches
    on conflict(cliente_id) do nothing;
  select * into q from firmavb_internal.lic_match_queue
    where next_run_at <= now()
    order by next_run_at, last_attempt_at nulls first, cliente_id
    limit 1 for update skip locked;
  if not found then return jsonb_build_object('status','idle'); end if;
  -- Exception block is a subtransaction. Cursor only advances on success.
  begin
    if not exists (select 1 from public.cliente_inventario where cliente_id=q.cliente_id) then
      delete from public.lic_item_matches where cliente_id=q.cliente_id;
      result := jsonb_build_object('processed',0,'matches',0,'complete',true,'cursor',null);
    else
      result := firmavb_internal.recalcular_lic_lote(q.cliente_id,q.cursor_item,p_limite);
    end if;
    if (result->>'complete')::boolean then
      -- Reconcile retired opportunities/removed inventory after a full pass.
      delete from public.lic_item_matches lm where lm.cliente_id=q.cliente_id
        and (not exists (
          select 1 from public.licitaciones_bi_items it join public.licitaciones_bi l on l.id=it.licitacion_id
          where it.id=lm.item_id and it.nombre_norm is not null and l.fecha_cierre>now()
            and (l.estado is null or l.estado ilike 'publicada' or l.estado ilike 'activa')
        ) or not exists (select 1 from public.cliente_inventario ci
          where ci.id=lm.inventario_id and ci.cliente_id=q.cliente_id));
    end if;
    update firmavb_internal.lic_match_queue set
      cursor_item=case when (result->>'complete')::boolean then null else (result->>'cursor')::uuid end,
      next_run_at=case when (result->>'complete')::boolean then now()+interval '1 hour' else now() end,
      last_attempt_at=clock_timestamp(), last_success_at=clock_timestamp(),
      cycle_started_at=case when (result->>'complete')::boolean then null else coalesce(q.cycle_started_at,now()) end,
      last_cycle_completed_at=case when (result->>'complete')::boolean then clock_timestamp() else q.last_cycle_completed_at end,
      failure_count=0, last_error=null where cliente_id=q.cliente_id;
    return result || jsonb_build_object('status','ok');
  exception when query_canceled or others then
    update firmavb_internal.lic_match_queue set last_attempt_at=clock_timestamp(),
      failure_count=q.failure_count+1, last_error=left(sqlerrm,1000),
      next_run_at=now()+make_interval(mins=>least(q.failure_count+1,15))
      where cliente_id=q.cliente_id;
    return jsonb_build_object('status','retry','sqlstate',sqlstate);
  end;
end
$function$;
revoke all on function firmavb_internal.procesar_lic_match_queue(integer) from public, anon, authenticated;
grant execute on function firmavb_internal.procesar_lic_match_queue(integer) to service_role;
