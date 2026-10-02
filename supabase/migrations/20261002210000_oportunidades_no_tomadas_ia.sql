-- Pedido de Evaristo: el filtro "No postulaste" del histórico no traía nada.
-- Causa real (confirmada viendo la consulta corriendo en vivo más de un
-- minuto sin terminar): mis_oportunidades_no_tomadas() barre TODA
-- licitaciones_bi/compras_agiles con ILIKE por cada una de las ~20 palabras
-- clave del cliente — sin índice de texto, es un escaneo completo repetido
-- que nunca alcanza a responder a tiempo (el filtro se "cae" silencioso en
-- el frontend). Mientras tanto ya existe un motor de matching semántico por
-- embeddings (lic_item_matches / ca_item_matches, con score por cliente,
-- recalculado por cron) usado en "Oportunidades" — nunca se conectó acá.
-- Se deja v1 intacta (otros lugares podrían usarla) y se agrega v2, que:
--   1. Usa las tablas de match ya calculadas (indexadas por cliente_id, sin
--      escaneo de texto) en vez de ILIKE.
--   2. Devuelve también el "tamaño del mercado": cuántas oportunidades de su
--      rubro hay en total, cuántas ya están en su pipeline y cuántas no.
-- Si el cliente no tiene inventario cargado (sin matches posibles todavía),
-- v2 devuelve vacío + tiene_inventario=false — el frontend debe explicar eso
-- en vez de mostrar un "no hay nada" sin más, que es justo el síntoma que
-- Evaristo reportó.

create or replace function public.mis_oportunidades_no_tomadas_v2(p_limite integer default 40, p_umbral real default 0.3)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with cli as (
    select c.id as cliente_id, public.rut_limpio(c.rut) as rut_limpio
    from public.clientes c
    where c.user_id = auth.uid()
    limit 1
  ),
  lic_match as (
    select m.licitacion_codigo as codigo, max(m.score) as score
    from public.lic_item_matches m, cli
    where m.cliente_id = cli.cliente_id and m.score >= p_umbral
    group by m.licitacion_codigo
  ),
  ca_match as (
    select m.compra_agil_codigo as codigo, max(m.score) as score
    from public.ca_item_matches m, cli
    where m.cliente_id = cli.cliente_id and m.score >= p_umbral
    group by m.compra_agil_codigo
  ),
  lic as (
    select
      l.codigo, l.nombre, l.institucion_nombre as institucion, l.institucion_rut as rut_institucion,
      l.fecha_publicacion, l.fecha_cierre, l.presupuesto_estimado as monto_estimado,
      'licitacion'::text as tipo, lm.score
    from public.licitaciones_bi l
    join lic_match lm on lm.codigo = l.codigo, cli
    where not exists (
        select 1 from public.ocds_procesos o
        where o.codigo = l.codigo
          and o.oferentes @> jsonb_build_array(jsonb_build_object('rut', cli.rut_limpio))
      )
      and not exists (select 1 from public.pipeline pl where pl.oportunidad_id = l.codigo and pl.oportunidad_tipo = 'licitacion')
  ),
  ca as (
    select
      cagil.codigo, cagil.nombre, cagil.nombre_organismo as institucion, cagil.organismo_rut as rut_institucion,
      cagil.fecha_publicacion, cagil.fecha_cierre, cagil.monto_estimado,
      'compra_agil'::text as tipo, cm.score
    from public.compras_agiles cagil
    join ca_match cm on cm.codigo = cagil.codigo
    where not exists (select 1 from public.pipeline pl where pl.oportunidad_id = cagil.codigo and pl.oportunidad_tipo = 'compra_agil')
  ),
  todas as (
    select * from lic
    union all
    select * from ca
  ),
  con_datos as (
    select
      t.*,
      i.conducta_pago, i.pago_promedio_dias,
      (
        select string_agg(distinct a->>'nombre', ', ')
        from jsonb_array_elements(coalesce(o.adjudicatarios, '[]'::jsonb)) a
      ) as ganador_nombre,
      o.estado_award
    from todas t
    left join public.ocds_procesos o on o.codigo = t.codigo and t.tipo = 'licitacion'
    left join public.instituciones i on i.rut = t.rut_institucion
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'codigo', c.codigo, 'nombre', c.nombre, 'institucion', c.institucion, 'rut_institucion', c.rut_institucion,
      'fecha_publicacion', c.fecha_publicacion, 'fecha_cierre', c.fecha_cierre, 'monto_estimado', c.monto_estimado,
      'tipo', c.tipo, 'conducta_pago', c.conducta_pago, 'pago_promedio_dias', c.pago_promedio_dias,
      'ganador_nombre', c.ganador_nombre, 'estado_award', c.estado_award, 'score', c.score
    ) order by c.score desc nulls last, c.fecha_cierre desc nulls last
  ), '[]'::jsonb)
  from (select * from con_datos order by score desc nulls last, fecha_cierre desc nulls last limit greatest(p_limite, 1)) c;
$function$;

-- "Tamaño del mercado": cuántas oportunidades de su rubro matchean (por el
-- mismo motor de embeddings), cuántas ya están en su pipeline (postuladas o
-- descartadas a propósito) y cuántas no se han tomado. tiene_inventario en
-- false explica por qué puede salir todo en 0 (no es que no haya mercado, es
-- que falta cargar el inventario para que el motor pueda calcular matches).
create or replace function public.mis_oportunidades_resumen_mercado(p_umbral real default 0.3)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with cli as (
    select c.id as cliente_id
    from public.clientes c
    where c.user_id = auth.uid()
    limit 1
  ),
  matches as (
    select m.licitacion_codigo as codigo, 'licitacion'::text as tipo
    from public.lic_item_matches m, cli
    where m.cliente_id = cli.cliente_id and m.score >= p_umbral
    union
    select m.compra_agil_codigo as codigo, 'compra_agil'::text as tipo
    from public.ca_item_matches m, cli
    where m.cliente_id = cli.cliente_id and m.score >= p_umbral
  ),
  distintas as (
    select distinct codigo, tipo from matches
  )
  select jsonb_build_object(
    'tamano_mercado', (select count(*) from distintas),
    'en_pipeline', (
      select count(*) from distintas d
      where exists (select 1 from public.pipeline pl where pl.oportunidad_id = d.codigo and pl.oportunidad_tipo = d.tipo)
    ),
    'no_tomadas', (
      select count(*) from distintas d
      where not exists (select 1 from public.pipeline pl where pl.oportunidad_id = d.codigo and pl.oportunidad_tipo = d.tipo)
    ),
    'tiene_inventario', (select exists(select 1 from public.cliente_inventario ci, cli where ci.cliente_id = cli.cliente_id))
  );
$function$;

grant execute on function public.mis_oportunidades_no_tomadas_v2(integer, real) to authenticated, service_role;
grant execute on function public.mis_oportunidades_resumen_mercado(real) to authenticated, service_role;
