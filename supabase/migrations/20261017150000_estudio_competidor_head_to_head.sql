-- Ampliación del "modo estudio de la competencia" (pedido de Evaristo):
-- contra quién perdemos y por qué, trato directo del competidor, y negocios
-- que dejamos pasar y que ese competidor sí tomó. De los 6 puntos pedidos,
-- estos 3 son construibles ahora mismo reusando lo que ya existe (mismo
-- cruce por RUT normalizado + GIN de ocds_procesos.oferentes que ya usa
-- proveedor_zoom, y el mismo patrón de matching que mis_oportunidades_no_tomadas_v2).
-- Multas/sanciones (no hay fuente de datos en el repo), fragmentación y
-- lobby (hoy solo existen por licitación/institución puntual, atados al
-- flujo "Bajo el Agua") quedan pendientes — no se inventa nada sin dato real.

-- oc_lineas tiene 4M+ filas y no tenía índice por RUT normalizado (el único
-- índice de RUT era sobre la columna cruda, sin rut_norm()) — sin esto,
-- proveedor_zoom escanea toda la tabla en cada clic. Mismo patrón que el
-- índice que ya existe en ordenes_compra (idx_oc_rut_prov_norm).
create index if not exists idx_oc_lineas_rut_prov_norm on public.oc_lineas using btree (rut_norm(rut_proveedor));

-- Trato directo del competidor: suma el bloque "trato_directo" a proveedor_zoom
-- usando oc_lineas (tiene el código de tipo de OC: D1/C1/F3/G1/FG = trato
-- directo, mismo criterio que src/utils/tipoOrdenCompra.ts).
create or replace function public.proveedor_zoom(p_nombre text, p_rut text default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with rn as (
    select coalesce(
      rut_norm(p_rut),
      (select rut_norm(rut_proveedor) from public.ordenes_compra
       where coalesce(proveedor, proveedor_nombre) = p_nombre and rut_proveedor is not null
       group by rut_norm(rut_proveedor) order by count(*) desc limit 1)
    ) as r
  ),
  oc as (
    select * from public.ordenes_compra
    where last_scraped_at is not null
      and (
        ((select r from rn) is not null and rut_norm(rut_proveedor) = (select r from rn))
        or ((select r from rn) is null and coalesce(proveedor, proveedor_nombre) = p_nombre)
      )
  ),
  identidad as (
    select
      max(coalesce(proveedor, proveedor_nombre)) as nombre,
      (select r from rn) as rut_norm,
      public.rut_formatear((select r from rn)) as rut,
      count(*)::int as ordenes,
      coalesce(sum(total), 0) as monto_total,
      count(distinct coalesce(demandante, organismo_comprador))::int as compradores,
      min(fecha_emision) as primera_orden,
      max(fecha_emision) as ultima_orden
    from oc
  ),
  tendencia as (
    select to_char(fecha_emision, 'YYYY-MM') as mes, count(*)::int as ordenes, coalesce(sum(total), 0) as monto
    from oc
    where fecha_emision >= (current_date - interval '12 months')
    group by 1 order by 1
  ),
  productos as (
    select i.producto, count(*)::int as lineas, coalesce(sum(i.valor_total), 0) as monto,
           round(avg(i.precio_unitario)) as precio_prom
    from oc join public.ordenes_compra_items i on i.numero_oc = oc.codigo
    where i.producto is not null
    group by i.producto order by monto desc nulls last limit 10
  ),
  clientes as (
    select coalesce(oc.demandante, oc.organismo_comprador) as comprador, count(*)::int as ordenes, coalesce(sum(oc.total), 0) as monto
    from oc where coalesce(oc.demandante, oc.organismo_comprador) is not null
    group by 1 order by monto desc nulls last limit 10
  ),
  lineas as (
    select * from public.oc_lineas
    where (select r from rn) is not null and rut_norm(rut_proveedor) = (select r from rn)
      and (moneda is null or upper(btrim(moneda)) = 'CLP')
  ),
  trato_directo as (
    select
      count(distinct codigo)::int as ordenes_total,
      coalesce(sum(monto_linea), 0) as monto_total,
      count(distinct codigo) filter (where upper(btrim(tipo)) = any(array['D1','C1','F3','G1','FG']))::int as ordenes_td,
      coalesce(sum(monto_linea) filter (where upper(btrim(tipo)) = any(array['D1','C1','F3','G1','FG'])), 0) as monto_td
    from lineas
  ),
  lic as (
    select o.codigo, o.titulo, o.comprador_nombre, o.fecha_adjudicacion, o.fecha_publicacion,
           o.monto_estimado, o.estado_award, o.num_oferentes,
           (select (a->>'monto')::numeric from jsonb_array_elements(coalesce(o.adjudicatarios, '[]'::jsonb)) a
            where rut_norm(a->>'rut') = (select r from rn) limit 1) as monto_ganado
    from public.ocds_procesos o
    where (select r from rn) is not null
      and o.oferentes @> jsonb_build_array(jsonb_build_object('rut', (select r from rn)))
  ),
  lic_resumen as (
    select count(*)::int as participo, count(*) filter (where monto_ganado is not null)::int as gano,
           coalesce(sum(monto_ganado), 0) as monto_adjudicado_total
    from lic
  )
  select jsonb_build_object(
    'identidad', (select to_jsonb(identidad) from identidad),
    'tendencia_mensual', coalesce((select jsonb_agg(to_jsonb(tendencia)) from tendencia), '[]'::jsonb),
    'productos', coalesce((select jsonb_agg(to_jsonb(productos)) from productos), '[]'::jsonb),
    'clientes', coalesce((select jsonb_agg(to_jsonb(clientes)) from clientes), '[]'::jsonb),
    'trato_directo', (select to_jsonb(trato_directo) from trato_directo),
    'licitaciones_resumen', (select to_jsonb(lic_resumen) from lic_resumen),
    'licitaciones_recientes', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select * from lic order by coalesce(fecha_adjudicacion, fecha_publicacion) desc nulls last limit 15
      ) x
    ), '[]'::jsonb)
  )
$function$;

-- Cara a cara: licitaciones donde el cliente Y este competidor ofertaron
-- ambos (requiere que el cliente tenga RUT cargado en su ficha). Explica
-- "contra quién perdemos" con casos reales, no un promedio abstracto.
create or replace function public.proveedor_head_to_head(p_rut_competidor text, p_limite integer default 10)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with cli as (
    select public.rut_limpio(c.rut) as rut_cliente
    from public.clientes c where c.user_id = auth.uid() limit 1
  ),
  comp as (select rut_norm(p_rut_competidor) as rut_competidor),
  ambos as (
    select o.codigo, o.titulo, o.comprador_nombre, o.fecha_adjudicacion, o.fecha_publicacion, o.estado_award,
      exists(select 1 from jsonb_array_elements(coalesce(o.adjudicatarios, '[]'::jsonb)) a where rut_norm(a->>'rut') = (select rut_cliente from cli)) as gano_cliente,
      exists(select 1 from jsonb_array_elements(coalesce(o.adjudicatarios, '[]'::jsonb)) a where rut_norm(a->>'rut') = (select rut_competidor from comp)) as gano_competidor
    from public.ocds_procesos o, cli, comp
    where cli.rut_cliente is not null
      and o.oferentes @> jsonb_build_array(jsonb_build_object('rut', cli.rut_cliente))
      and o.oferentes @> jsonb_build_array(jsonb_build_object('rut', comp.rut_competidor))
  ),
  resumen as (
    select count(*)::int as total,
           count(*) filter (where gano_cliente)::int as gano_cliente,
           count(*) filter (where gano_competidor)::int as gano_competidor,
           count(*) filter (where not gano_cliente and not gano_competidor)::int as nadie
    from ambos
  )
  select jsonb_build_object(
    'resumen', (select to_jsonb(resumen) from resumen),
    'casos', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select * from ambos order by coalesce(fecha_adjudicacion, fecha_publicacion) desc nulls last limit greatest(p_limite, 1)
      ) x
    ), '[]'::jsonb)
  )
$function$;

grant execute on function public.proveedor_head_to_head(text, integer) to authenticated;

-- Negocios que dejamos pasar y que este competidor sí tomó: licitaciones con
-- buen calce de inventario (mismo umbral que mis_oportunidades_no_tomadas_v2)
-- que el cliente no postuló Y que este competidor se adjudicó. Solo
-- licitaciones: compra ágil no publica adjudicatario vía OCDS (mismo límite
-- que ya documenta 20261002000000_historico_postulaciones.sql).
create or replace function public.oportunidades_perdidas_ante(p_rut_competidor text, p_limite integer default 15, p_umbral real default 0.3)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with cli as (
    select c.id as cliente_id, public.rut_limpio(c.rut) as rut_limpio
    from public.clientes c where c.user_id = auth.uid() limit 1
  ),
  comp as (select rut_norm(p_rut_competidor) as rut_competidor),
  lic_match as (
    select m.licitacion_codigo as codigo, max(m.score) as score
    from public.lic_item_matches m, cli
    where m.cliente_id = cli.cliente_id and m.score >= p_umbral
    group by m.licitacion_codigo
  ),
  candidatas as (
    select
      l.codigo, l.nombre, l.institucion_nombre as institucion, l.institucion_rut as rut_institucion,
      l.fecha_publicacion, l.fecha_cierre, l.presupuesto_estimado as monto_estimado, lm.score,
      (select (a->>'monto')::numeric from jsonb_array_elements(coalesce(o.adjudicatarios, '[]'::jsonb)) a
       where rut_norm(a->>'rut') = comp.rut_competidor limit 1) as monto_competidor
    from cli, comp, public.licitaciones_bi l
    join lic_match lm on lm.codigo = l.codigo
    join public.ocds_procesos o on o.codigo = l.codigo
    where o.adjudicatarios @> jsonb_build_array(jsonb_build_object('rut', comp.rut_competidor))
      and not exists (
        select 1 from public.ocds_procesos o2
        where o2.codigo = l.codigo and o2.oferentes @> jsonb_build_array(jsonb_build_object('rut', cli.rut_limpio))
      )
      and not exists (select 1 from public.pipeline pl where pl.oportunidad_id = l.codigo and pl.oportunidad_tipo = 'licitacion')
  )
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  from (
    select * from candidatas order by score desc nulls last, fecha_cierre desc nulls last limit greatest(p_limite, 1)
  ) x
$function$;

grant execute on function public.oportunidades_perdidas_ante(text, integer, real) to authenticated;
