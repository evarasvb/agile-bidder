-- =====================================================================
-- Match de COMPRAS ÁGILES por ÍTEM (paridad con licitaciones)
-- =====================================================================
-- Antes: compras_agiles_items estaba casi vacía => el match de CA caía siempre al
-- título. Ahora enrich-ca-items baja el detalle por código desde la API v2 de
-- ChileCompra (api2.mercadopublico.cl/v2/compra-agil/{codigo} -> productos_solicitados)
-- y puebla compras_agiles_items. Este match usa esos ítems: código ONU/UNSPSC
-- exacto (=100) o similitud de nombre; cae al título solo si no hay ítems.

-- Compras ágiles activas sin ítems (la consume enrich-ca-items).
create or replace function public.compras_agiles_pendientes_items(p_limit int default 60)
returns table(id bigint, codigo text)
language sql security definer set search_path = public
as $function$
  select c.id, c.codigo
  from public.compras_agiles c
  where (c.estado ilike 'publicada' or c.estado ilike 'activa')
    and c.fecha_cierre > now() and c.codigo is not null
    and not exists (select 1 from public.compras_agiles_items i where i.compra_agil_id = c.id)
  order by c.fecha_cierre asc
  limit greatest(1, least(p_limit, 100));
$function$;

-- Match por ítem (código exacto o nombre) o título (fallback). Mejor producto por
-- compra, escrito en ca_matches (lo consume el Panel).
create or replace function public.generar_matches_ca(p_cliente uuid, p_umbral real default 0.45)
returns integer
language plpgsql
as $function$
declare n integer;
begin
  perform set_config('pg_trgm.word_similarity_threshold', '0.35', true);

  insert into public.ca_matches (compra_agil_codigo, cliente_id, inventario_id, score, listo,
                                 nombre_pedido, nombre_producto, precio_unitario, fecha_cierre)
  select b.codigo, p_cliente, b.inv_id, round((b.sim*100)::numeric,1), (b.sim>=p_umbral),
         b.nombre, b.nombre_producto, b.precio_unitario, b.fecha_cierre
  from (
    select distinct on (t.codigo)
           t.codigo, t.nombre, t.fecha_cierre, m.id as inv_id, m.nombre_producto, m.precio_unitario, m.sim
    from (
      select ca.codigo, ca.nombre, ca.fecha_cierre, i.nombre_producto as texto, i.codigo_producto as cod
      from public.compras_agiles ca
      join public.compras_agiles_items i on i.compra_agil_id = ca.id
      where ca.fecha_cierre >= now() and ca.estado ilike 'publicada' and i.nombre_producto is not null
      union all
      select ca.codigo, ca.nombre, ca.fecha_cierre,
             nullif(trim(regexp_replace(regexp_replace(regexp_replace(
               upper(ca.nombre), '\([^)]*\)', ' ', 'g'),
               '[0-9]{2,}[-–][0-9–-]{3,}', ' ', 'g'),
               '[[:space:]]+', ' ', 'g')), '') as texto,
             null as cod
      from public.compras_agiles ca
      where ca.fecha_cierre >= now() and ca.estado ilike 'publicada' and ca.nombre is not null
        and not exists (select 1 from public.compras_agiles_items i where i.compra_agil_id = ca.id)
    ) t
    cross join lateral (
      select id, nombre_producto, precio_unitario, greatest(
        case when t.cod is not null and codigo_producto is not null and codigo_producto = t.cod then 1.0::real else 0::real end,
        coalesce(word_similarity(nombre_producto, t.texto), 0::real)
      ) as sim
      from public.cliente_inventario
      where cliente_id = p_cliente and t.texto is not null
        and (nombre_producto %> t.texto or (t.cod is not null and codigo_producto = t.cod))
      order by sim desc
      limit 1
    ) m
    order by t.codigo, m.sim desc
  ) b
  on conflict (compra_agil_codigo, cliente_id) do update
    set inventario_id=excluded.inventario_id, score=excluded.score, listo=excluded.listo,
        nombre_producto=excluded.nombre_producto, precio_unitario=excluded.precio_unitario,
        fecha_cierre=excluded.fecha_cierre;
  get diagnostics n = row_count;
  return n;
end $function$;

-- Cron del enricher de ítems de CA (cada 30 min).
do $cron$
begin
  if exists (select 1 from cron.job where jobname='enrich-ca-items-cron') then
    perform cron.unschedule('enrich-ca-items-cron');
  end if;
  perform cron.schedule('enrich-ca-items-cron', '*/30 * * * *',
    $$ select net.http_post(
         url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/enrich-ca-items',
         headers := jsonb_build_object('Content-Type','application/json',
           'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_jwt_legacy')),
         body := '{"limit":80}'::jsonb,
         timeout_milliseconds := 120000); $$);
end $cron$;
