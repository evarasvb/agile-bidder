-- =====================================================================
-- Normalización de acentos en el match (fix sistémico) + performance
-- =====================================================================
-- Problema detectado: los acentos rompían el trigram. "Tóner" (como lo escribe
-- el Estado) vs "TONER" (como está en el inventario) daba ~12% de similitud y el
-- match no aparecía. Afectaba a todo lo acentuado (tóner, útiles, artículos,
-- energía, química, etc.).
--
-- Solución: comparar sobre texto normalizado (minúsculas + sin acento),
-- precalculado en columnas generadas + índices trigram planos.

create extension if not exists unaccent;

-- Wrapper IMMUTABLE de unaccent (para poder usarlo en columnas generadas/índices).
create or replace function public.f_unaccent(text)
returns text language sql immutable parallel safe
as $function$ select public.unaccent('public.unaccent', $1) $function$;

-- Columnas normalizadas (se calculan al escribir).
alter table public.cliente_inventario
  add column if not exists nombre_norm text generated always as (public.f_unaccent(lower(nombre_producto))) stored;
alter table public.licitaciones_bi_items
  add column if not exists nombre_norm text generated always as (public.f_unaccent(lower(nombre_producto))) stored;
alter table public.compras_agiles_items
  add column if not exists nombre_norm text generated always as (public.f_unaccent(lower(nombre_producto))) stored;

-- Índices trigram sobre el nombre normalizado del inventario (GIN para %>, GiST para KNN).
create index if not exists idx_inv_nombrenorm_gin on public.cliente_inventario using gin (nombre_norm gin_trgm_ops);
create index if not exists idx_inv_nombrenorm_gist on public.cliente_inventario using gist (nombre_norm gist_trgm_ops);

-- Nota de rendimiento: el umbral de word_similarity se fija a nivel de sesión
-- (los cron ejecutan: SET pg_trgm.word_similarity_threshold='0.45'; SELECT ...).
-- Las funciones NO fijan el GUC internamente (evita planes plpgsql cacheados
-- lentos) y confían en el umbral de la sesión que las llama.

-- LICITACIONES por ítem (usa nombre_norm; código ONU exacto = 100).
create or replace function public.generar_matches_lic_items(
  p_umbral real default 0.45, p_buckets int default 1, p_bucket int default 0)
returns integer language plpgsql security definer set search_path = public
as $function$
declare n integer;
begin
  with por_item as (
    select l.codigo, max(greatest(
      case when exists (select 1 from public.cliente_inventario ci
        where ci.codigo_producto is not null and it.codigo_producto is not null
          and ci.codigo_producto = it.codigo_producto) then 1.0::real else 0::real end,
      coalesce((select word_similarity(ci.nombre_norm, it.nombre_norm)
        from public.cliente_inventario ci
        where it.nombre_norm is not null and ci.nombre_norm %> it.nombre_norm
        order by ci.nombre_norm <->> it.nombre_norm limit 1), 0::real)
    )) as sim
    from public.licitaciones_bi l
    join public.licitaciones_bi_items it on it.licitacion_id = l.id
    where (l.estado is null or l.estado ilike 'publicada' or l.estado ilike 'activa')
      and l.fecha_cierre > now()
      and (p_buckets <= 1 or mod(abs(hashtext(l.codigo)), p_buckets) = p_bucket)
    group by l.codigo
  )
  update public.licitaciones_bi l
  set match_score = case when p.sim > 0 then round((p.sim*100)::numeric,1) else null end,
      match_encontrado = (p.sim >= p_umbral), updated_at = now()
  from por_item p where l.codigo = p.codigo;
  get diagnostics n = row_count; return n;
end $function$;

-- LICITACIONES por título (fallback; solo activas SIN ítems).
create or replace function public.generar_matches_lic(
  p_umbral real default 0.45, p_buckets int default 1, p_bucket int default 0)
returns integer language plpgsql security definer set search_path = public
as $function$
declare n integer;
begin
  with activas as (
    select l.codigo,
      public.f_unaccent(lower(nullif(trim(regexp_replace(regexp_replace(
        l.nombre,'\([^)]*\)',' ','g'),'[[:space:]]+',' ','g')),''))) as texto
    from public.licitaciones_bi l
    where (l.estado is null or l.estado ilike 'publicada' or l.estado ilike 'activa')
      and l.fecha_cierre > now() and l.nombre is not null
      and (p_buckets <= 1 or mod(abs(hashtext(l.codigo)), p_buckets) = p_bucket)
      and not exists (select 1 from public.licitaciones_bi_items i where i.licitacion_id = l.id)
  ),
  best as (
    select a.codigo, m.sim from activas a
    left join lateral (
      select word_similarity(ci.nombre_norm, a.texto) as sim
      from public.cliente_inventario ci
      where a.texto is not null and ci.nombre_norm %> a.texto
      order by ci.nombre_norm <->> a.texto limit 1
    ) m on true
  )
  update public.licitaciones_bi l
  set match_score = case when b.sim is not null and b.sim>0 then round((b.sim*100)::numeric,1) else null end,
      match_encontrado = (b.sim is not null and b.sim >= p_umbral), updated_at = now()
  from best b where l.codigo = b.codigo;
  get diagnostics n = row_count; return n;
end $function$;

-- COMPRAS ÁGILES (usa nombre_norm; código ONU exacto = 100).
create or replace function public.generar_matches_ca(p_cliente uuid, p_umbral real default 0.45)
returns integer language plpgsql
as $function$
declare n integer;
begin
  insert into public.ca_matches (compra_agil_codigo, cliente_id, inventario_id, score, listo,
                                 nombre_pedido, nombre_producto, precio_unitario, fecha_cierre)
  select b.codigo, p_cliente, b.inv_id, round((b.sim*100)::numeric,1), (b.sim>=p_umbral),
         b.nombre, b.nombre_producto, b.precio_unitario, b.fecha_cierre
  from (
    select distinct on (t.codigo)
           t.codigo, t.nombre, t.fecha_cierre, m.id as inv_id, m.nombre_producto, m.precio_unitario, m.sim
    from (
      select ca.codigo, ca.nombre, ca.fecha_cierre, i.nombre_norm as texto, i.codigo_producto as cod
      from public.compras_agiles ca
      join public.compras_agiles_items i on i.compra_agil_id = ca.id
      where ca.fecha_cierre >= now() and ca.estado ilike 'publicada' and i.nombre_norm is not null
      union all
      select ca.codigo, ca.nombre, ca.fecha_cierre,
             public.f_unaccent(lower(nullif(trim(regexp_replace(regexp_replace(regexp_replace(
               ca.nombre,'\([^)]*\)',' ','g'),'[0-9]{2,}[-–][0-9–-]{3,}',' ','g'),'[[:space:]]+',' ','g')),''))) as texto,
             null as cod
      from public.compras_agiles ca
      where ca.fecha_cierre >= now() and ca.estado ilike 'publicada' and ca.nombre is not null
        and not exists (select 1 from public.compras_agiles_items i where i.compra_agil_id = ca.id)
    ) t
    cross join lateral (
      select id, nombre_producto, precio_unitario, greatest(
        case when t.cod is not null and codigo_producto is not null and codigo_producto = t.cod then 1.0::real else 0::real end,
        coalesce(word_similarity(nombre_norm, t.texto), 0::real)
      ) as sim
      from public.cliente_inventario
      where cliente_id = p_cliente and t.texto is not null
        and (nombre_norm %> t.texto or (t.cod is not null and codigo_producto = t.cod))
      order by sim desc limit 1
    ) m
    order by t.codigo, m.sim desc
  ) b
  on conflict (compra_agil_codigo, cliente_id) do update
    set inventario_id=excluded.inventario_id, score=excluded.score, listo=excluded.listo,
        nombre_producto=excluded.nombre_producto, precio_unitario=excluded.precio_unitario,
        fecha_cierre=excluded.fecha_cierre;
  get diagnostics n = row_count; return n;
end $function$;

-- Cron con el umbral fijado en la sesión (0.45).
do $cron$
begin
  if exists (select 1 from cron.job where jobname='match-lic-horario') then perform cron.unschedule('match-lic-horario'); end if;
  perform cron.schedule('match-lic-horario','17 * * * *',
    $$ set pg_trgm.word_similarity_threshold='0.45'; select public.generar_matches_lic_todo(); $$);
  if exists (select 1 from cron.job where jobname='match-ca-horario') then perform cron.unschedule('match-ca-horario'); end if;
  perform cron.schedule('match-ca-horario','7 * * * *',
    $$ set pg_trgm.word_similarity_threshold='0.45'; select public.generar_matches_ca_todos(); $$);
end $cron$;
