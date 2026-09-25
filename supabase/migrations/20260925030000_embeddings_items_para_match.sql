-- Paso 1 del match semántico (inspirado en lo que hace Lici): vectorizar los ítems de
-- compras ágiles y licitaciones con el mismo modelo que el inventario
-- (gemini-embedding-001, 768 dims, ya existe en cliente_inventario.embedding) para que
-- el match compare significados y no letras. Esta migración solo agrega el almacenamiento,
-- la invalidación al editar y el cron que llama a la edge function embed-items; la fórmula
-- de match cambia en la migración siguiente, una vez calibrada con datos reales.

alter table public.compras_agiles_items add column if not exists embedding extensions.vector(768);
alter table public.licitaciones_bi_items add column if not exists embedding extensions.vector(768);

-- Texto que se vectoriza (misma fuente que nombre_norm, más la categoría como contexto).
create or replace function public.item_texto_embedding(p_descripcion text, p_nombre text)
returns text language sql immutable as $$
  select left(
    case when nullif(trim(p_descripcion), '') is not null and lower(trim(p_descripcion)) <> lower(trim(coalesce(p_nombre,'')))
         then trim(p_descripcion) || ' (' || coalesce(trim(p_nombre), '') || ')'
         else coalesce(nullif(trim(p_descripcion), ''), trim(p_nombre), '') end, 500);
$$;

-- Si cambia el texto del ítem (enrich-ca-items vuelve a cargar descripciones), el vector viejo
-- ya no sirve: se deja en null y embed-items lo recalcula.
create or replace function public.items_invalidar_embedding()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'compras_agiles_items' then
    if (new.descripcion_producto is distinct from old.descripcion_producto
        or new.nombre_producto is distinct from old.nombre_producto)
       and new.embedding is not distinct from old.embedding then
      new.embedding := null;
    end if;
  else
    if (new.descripcion is distinct from old.descripcion
        or new.nombre_producto is distinct from old.nombre_producto)
       and new.embedding is not distinct from old.embedding then
      new.embedding := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_ca_items_invalidar_embedding on public.compras_agiles_items;
create trigger trg_ca_items_invalidar_embedding before update on public.compras_agiles_items
for each row execute function public.items_invalidar_embedding();

drop trigger if exists trg_lic_items_invalidar_embedding on public.licitaciones_bi_items;
create trigger trg_lic_items_invalidar_embedding before update on public.licitaciones_bi_items
for each row execute function public.items_invalidar_embedding();

-- Índices parciales para que el robot encuentre rápido lo pendiente.
create index if not exists idx_ca_items_sin_embedding on public.compras_agiles_items (compra_agil_id) where embedding is null;
create index if not exists idx_lic_items_sin_embedding on public.licitaciones_bi_items (licitacion_id) where embedding is null;
create index if not exists idx_cliente_inventario_sin_embedding on public.cliente_inventario (cliente_id) where embedding is null;

-- Pendientes, con prioridad: inventario, luego ítems de compras ágiles abiertas (cierran
-- antes), luego ítems de licitaciones abiertas. Solo lo abierto: lo cerrado no se matchea.
create or replace function public.items_pendientes_embedding(p_limite integer default 200)
returns table (tabla text, id uuid, texto text)
language sql stable security definer set search_path to 'public'
as $$
  (select 'cliente_inventario'::text, ci.id,
          left(concat_ws(' ', ci.nombre_producto, ci.categoria, ci.marca, ci.descripcion), 500)
   from public.cliente_inventario ci
   where ci.embedding is null
   order by ci.updated_at desc nulls last
   limit p_limite)
  union all
  (select 'compras_agiles_items', i.id, public.item_texto_embedding(i.descripcion_producto, i.nombre_producto)
   from public.compras_agiles_items i
   join public.compras_agiles c on c.id = i.compra_agil_id
   where i.embedding is null and c.fecha_cierre > now() and c.estado ilike 'publicada'
   order by c.fecha_cierre asc
   limit p_limite)
  union all
  (select 'licitaciones_bi_items', i.id, public.item_texto_embedding(i.descripcion, i.nombre_producto)
   from public.licitaciones_bi_items i
   join public.licitaciones_bi l on l.id = i.licitacion_id
   where i.embedding is null and l.fecha_cierre > now()
     and (l.estado is null or l.estado ilike 'publicada' or l.estado ilike 'activa')
   order by l.fecha_cierre asc
   limit p_limite);
$$;
revoke execute on function public.items_pendientes_embedding(integer) from public, anon, authenticated;

-- Cron: cada 3 minutos, la edge function embed-items procesa hasta ~100 s de lotes.
do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'embed-items-cron';
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
  perform cron.schedule('embed-items-cron', '*/3 * * * *', $cmd$
    select net.http_post(
      url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/embed-items',
      headers := jsonb_build_object('Content-Type','application/json',
        'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_jwt_legacy')),
      body := '{"presupuesto_ms":100000}'::jsonb,
      timeout_milliseconds := 120000);
  $cmd$);
end $$;
