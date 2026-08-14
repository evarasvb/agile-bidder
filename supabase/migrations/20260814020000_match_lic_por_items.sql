-- =====================================================================
-- Match de LICITACIONES por ÍTEM (Fase 2) — reemplaza el match solo-título
-- =====================================================================
-- Ahora que licitaciones_bi_items se puebla (enrich-licitaciones-bi v4 baja el
-- detalle por código y guarda los ítems), el match usa los ítems cuando existen:
--   - código ONU/UNSPSC exacto (CodigoProducto == cliente_inventario.codigo_producto) => score 100
--   - si no, similitud de nombre del ítem vs inventario
-- y cae al título solo cuando la licitación aún no tiene ítems cargados.
-- Se separan en dos funciones (ítem / título) por rendimiento: la de título usa
-- el patrón por tandas ya probado; la de ítem corre sobre pocos ítems y es directa.

create index if not exists idx_lic_bi_items_licitacion on public.licitaciones_bi_items(licitacion_id);

-- Lista de licitaciones activas pendientes de ítems (la consume el enricher).
create or replace function public.licitaciones_pendientes_items(p_limit int default 40)
returns table(id uuid, codigo text)
language sql security definer set search_path = public
as $function$
  select l.id, l.codigo
  from public.licitaciones_bi l
  where (l.estado is null or l.estado ilike 'publicada' or l.estado ilike 'activa')
    and l.fecha_cierre > now()
    and l.codigo is not null
    and not exists (select 1 from public.licitaciones_bi_items i where i.licitacion_id = l.id)
  order by l.fecha_cierre asc
  limit greatest(1, least(p_limit, 100));
$function$;

-- Match por ÍTEM (código exacto o similitud de nombre). Sobrescribe el de título.
create or replace function public.generar_matches_lic_items(p_umbral real default 0.35)
returns integer
language plpgsql security definer set search_path = public
as $function$
declare n integer;
begin
  perform set_config('pg_trgm.word_similarity_threshold', p_umbral::text, true);
  with por_item as (
    select l.codigo, max(greatest(
      case when exists (
        select 1 from public.cliente_inventario ci
        where ci.codigo_producto is not null and it.codigo_producto is not null
          and ci.codigo_producto = it.codigo_producto) then 1.0::real else 0::real end,
      coalesce((
        select word_similarity(ci.nombre_producto, it.nombre_producto)
        from public.cliente_inventario ci
        where it.nombre_producto is not null and ci.nombre_producto %> it.nombre_producto
        order by ci.nombre_producto <->> it.nombre_producto limit 1), 0::real)
    )) as sim
    from public.licitaciones_bi l
    join public.licitaciones_bi_items it on it.licitacion_id = l.id
    where (l.estado is null or l.estado ilike 'publicada' or l.estado ilike 'activa')
      and l.fecha_cierre > now()
    group by l.codigo
  )
  update public.licitaciones_bi l
  set match_score = case when p.sim > 0 then round((p.sim*100)::numeric,1) else null end,
      match_encontrado = (p.sim > 0),
      updated_at = now()
  from por_item p
  where l.codigo = p.codigo;
  get diagnostics n = row_count;
  return n;
end $function$;

-- Match por TÍTULO (fallback) solo para activas SIN ítems. Por tandas (buckets).
create or replace function public.generar_matches_lic(
  p_umbral real default 0.35, p_buckets int default 1, p_bucket int default 0)
returns integer
language plpgsql security definer set search_path = public
as $function$
declare n integer;
begin
  perform set_config('pg_trgm.word_similarity_threshold', p_umbral::text, true);
  with activas as (
    select l.codigo,
      nullif(trim(regexp_replace(regexp_replace(
        upper(l.nombre), '\([^)]*\)', ' ', 'g'),
        '[[:space:]]+', ' ', 'g')), '') as texto
    from public.licitaciones_bi l
    where (l.estado is null or l.estado ilike 'publicada' or l.estado ilike 'activa')
      and l.fecha_cierre > now()
      and l.nombre is not null
      and (p_buckets <= 1 or mod(abs(hashtext(l.codigo)), p_buckets) = p_bucket)
      and not exists (select 1 from public.licitaciones_bi_items i where i.licitacion_id = l.id)
  ),
  best as (
    select a.codigo, m.sim
    from activas a
    left join lateral (
      select word_similarity(ci.nombre_producto, a.texto) as sim
      from public.cliente_inventario ci
      where a.texto is not null and ci.nombre_producto %> a.texto
      order by ci.nombre_producto <->> a.texto limit 1
    ) m on true
  )
  update public.licitaciones_bi l
  set match_score = case when b.sim is not null then round((b.sim*100)::numeric,1) else null end,
      match_encontrado = (b.sim is not null),
      updated_at = now()
  from best b
  where l.codigo = b.codigo;
  get diagnostics n = row_count;
  return n;
end $function$;

-- Wrapper para el cron: título en 8 tandas + ítems.
create or replace function public.generar_matches_lic_todo()
returns integer
language plpgsql security definer set search_path = public
as $function$
declare total integer := 0; i int;
begin
  for i in 0..7 loop
    total := total + public.generar_matches_lic(0.35, 8, i);
  end loop;
  total := total + public.generar_matches_lic_items(0.35);
  return total;
end $function$;

do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'match-lic-horario') then
    perform cron.unschedule('match-lic-horario');
  end if;
  perform cron.schedule('match-lic-horario', '17 * * * *',
    $$ select public.generar_matches_lic_todo(); $$);
end $cron$;
