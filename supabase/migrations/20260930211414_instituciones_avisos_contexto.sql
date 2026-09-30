-- Identidad compartida: un código reutilizado nunca une organismos distintos.
create or replace function public.institucion_rut_seguro(p_identificador text)
returns text language sql stable security invoker set search_path=public as $$
  select case when count(distinct rut)=1 then min(rut)
    when count(distinct rut)=0 and p_identificador ~ '^[0-9.]+-[0-9kK]$' then p_identificador end
  from (
    select i.rut from public.instituciones i where i.rut=p_identificador or i.codigo_entidad=p_identificador
    union select l.institucion_rut from public.licitaciones_bi l
      where l.institucion_rut=p_identificador or l.institucion_codigo=p_identificador
  ) ids where rut is not null;
$$;
revoke all on function public.institucion_rut_seguro(text) from public,anon,authenticated;
grant execute on function public.institucion_rut_seguro(text) to service_role;

create or replace function public.institucion_nombre_seguro(p_nombre text,p_rut text)
returns boolean language sql stable security invoker set search_path=public,extensions as $$
  select p_rut is not null and coalesce(trim(public.medios_norm(p_nombre)),'')<>''
    and not exists (
      select 1 from (
        select i.rut,i.nombre from public.instituciones i
        union select l.institucion_rut,l.institucion_nombre from public.licitaciones_bi l
      ) ids where public.medios_norm(ids.nombre)=public.medios_norm(p_nombre)
        and (ids.rut is null or ids.rut<>p_rut)
    );
$$;
revoke all on function public.institucion_nombre_seguro(text,text) from public,anon,authenticated;
grant execute on function public.institucion_nombre_seguro(text,text) to service_role;

create or replace function public.instituciones_seguidas_avisar(p_desde timestamptz default now() - interval '2 days')
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer; total integer := 0;
begin
  -- 1) Prensa: menciones nuevas (por fecha de descubrimiento) del organismo seguido. Máximo 3 por institución y corrida.
  insert into public.notificaciones_log (cliente_id, tipo, licitacion_id, email_enviado, datos)
  select x.cliente_id, 'medio_institucion', null, false,
         jsonb_build_object('clave', x.clave, 'titulo', x.titulo, 'organismo', x.institucion,
                            'detalle', x.detalle, 'url', x.url, 'fecha', x.fecha,
                            'rut_institucion', x.rut, 'evento_id', x.evento_id, 'evento_tipo', 'noticias')
  from (
    -- El resumen de Google Noticias viene con HTML y repite el título: el detalle lleva solo medio y fecha.
    -- Solo prensa reciente (60 días): al empezar a seguir una institución se descubre todo su historial de golpe.
    select s.cliente_id, s.rut_institucion as rut, m.id::text as evento_id, s.nombre_institucion as institucion, 'medio:' || m.id as clave, m.titulo, m.url, m.fecha,
           concat_ws(' · ', nullif(m.medio, ''), to_char(m.fecha, 'DD-MM-YYYY')) as detalle,
           row_number() over (partition by s.cliente_id, s.rut_institucion order by m.fecha desc nulls last, m.id desc) as rn
    from public.cliente_instituciones_seguidas s
    join public.medios_menciones m on m.organismo_norm = public.medios_norm(s.nombre_institucion)
    where m.creado_en >= p_desde and m.titulo is not null
      and public.institucion_nombre_seguro(s.nombre_institucion,public.institucion_rut_seguro(s.rut_institucion))
      and (m.fecha is null or m.fecha >= now() - interval '60 days')
  ) x
  where x.rn <= 3
    and not exists (select 1 from public.notificaciones_log l
                    where l.cliente_id = x.cliente_id and l.datos->>'clave' = x.clave);
  get diagnostics n = row_count; total := total + n;

  -- 2) Reclamos nuevos en Mercado Público (tipo 1 = pago, 2 = proceso), resumidos por institución y día.
  insert into public.notificaciones_log (cliente_id, tipo, licitacion_id, email_enviado, datos)
  select x.cliente_id, 'reclamo_institucion', null, false,
         jsonb_build_object('clave', x.clave, 'organismo', x.institucion, 'rut', x.rut,
           'titulo', x.n || case when x.n = 1 then ' reclamo nuevo' else ' reclamos nuevos' end || ' contra ' || x.institucion,
           'detalle', concat_ws(' · ',
              case when x.pago > 0 then x.pago || ' por no pago' end,
              case when x.proceso > 0 then x.proceso || ' por el proceso' end,
              case when x.reclamantes <> '' then 'Reclaman: ' || x.reclamantes end),
           'pago', x.pago, 'proceso', x.proceso,
           'rut_institucion', x.rut, 'evento_tipo', 'reclamos', 'evento_clave', x.clave, 'evento_id', x.evento_id)
  from (
    select s.cliente_id, s.rut_institucion as rut, s.nombre_institucion as institucion,
           -- Clave por día de ingesta del reclamo: cada tanda se avisa una sola vez, aunque la corrida sea dos veces al día.
           'reclamos:' || s.rut_institucion || ':' || r.created_at::date as clave,
           count(*) as n, min(r.id_reclamo) as evento_id,
           count(*) filter (where r.tipo = 1) as pago,
           count(*) filter (where r.tipo = 2) as proceso,
           string_agg(distinct left(r.reclamante, 40), ', ') as reclamantes
    from public.cliente_instituciones_seguidas s
    join public.reclamos_mp r on r.organismo_rut = public.institucion_rut_seguro(s.rut_institucion)
    where r.created_at >= p_desde
    group by s.cliente_id, s.rut_institucion, s.nombre_institucion, r.created_at::date
  ) x
  where not exists (select 1 from public.notificaciones_log l
                    where l.cliente_id = x.cliente_id and l.datos->>'clave' = x.clave);
  get diagnostics n = row_count; total := total + n;

  -- 3) Licitaciones de la institución que pasaron a adjudicadas (codigo_estado 8) desde p_desde.
  insert into public.notificaciones_log (cliente_id, tipo, licitacion_id, email_enviado, datos)
  select x.cliente_id, 'adjudicacion_institucion', x.codigo, false,
         jsonb_build_object('clave', x.clave, 'organismo', x.institucion, 'licitacion_id', x.codigo,
           'licitacion_codigo', x.codigo, 'tipo_oportunidad', 'licitacion',
           'rut_institucion', x.rut, 'evento_id', x.codigo, 'evento_tipo', 'licitaciones',
           'titulo', 'Adjudicada: ' || x.nombre,
           'detalle', coalesce('Ganó ' || x.proveedor || case when x.monto is not null then ' por $' || to_char(x.monto, 'FM999G999G999G999') else '' end,
                               'Revisa quién ganó y a qué precio en el acta de adjudicación'))
  from (
    select s.cliente_id, s.rut_institucion as rut, s.nombre_institucion as institucion, l.codigo, l.nombre, 'adj:' || l.codigo as clave,
           (select a.proveedor_nombre from public.licitaciones_adjudicaciones a where a.licitacion_id = l.id order by a.monto_adjudicado desc nulls last limit 1) as proveedor,
           (select a.monto_adjudicado from public.licitaciones_adjudicaciones a where a.licitacion_id = l.id order by a.monto_adjudicado desc nulls last limit 1) as monto
    from public.cliente_instituciones_seguidas s
    join public.licitaciones_bi l on l.institucion_rut = public.institucion_rut_seguro(s.rut_institucion)
    where l.codigo_estado = 8 and l.updated_at >= p_desde
  ) x
  where not exists (select 1 from public.notificaciones_log l
                    where l.cliente_id = x.cliente_id and l.datos->>'clave' = x.clave);
  get diagnostics n = row_count; total := total + n;

  -- 4) Órdenes de compra emitidas por la institución (por su código de organismo en licitaciones_bi), resumen por día.
  with seguidas as materialized (
    select s.*,public.institucion_rut_seguro(s.rut_institucion) rut_real
    from public.cliente_instituciones_seguidas s
  ), codigos as materialized (
    select s.*,array(
      select distinct x.codigo from (
        select s.rut_institucion codigo union select s.rut_real
        union select i.codigo_entidad from public.instituciones i where i.rut=s.rut_real
        union select l.institucion_codigo from public.licitaciones_bi l where l.institucion_rut=s.rut_real
      ) x where public.institucion_rut_seguro(x.codigo)=s.rut_real
    ) identificadores from seguidas s
  )
  insert into public.notificaciones_log (cliente_id, tipo, licitacion_id, email_enviado, datos)
  select x.cliente_id, 'compras_institucion', null, false,
         jsonb_build_object('clave', x.clave, 'organismo', x.institucion, 'rut', x.rut,
           'titulo', x.institucion || ' emitió ' || x.n || case when x.n = 1 then ' orden de compra' else ' órdenes de compra' end
                     || ' por $' || to_char(x.total, 'FM999G999G999G999'),
           'detalle', 'La mayor: ' || coalesce(x.mayor_proveedor, 'proveedor sin nombre') || ' por $' || to_char(x.mayor_total, 'FM999G999G999G999')
                      || coalesce(' · ' || left(x.mayor_nombre, 120), ''),
           'ocs', x.n, 'total', x.total,
           'rut_institucion', x.rut, 'evento_tipo', 'ordenes_compra', 'evento_clave', x.clave, 'evento_id', x.evento_id)
  from (
    select s.cliente_id, s.rut_institucion as rut, s.nombre_institucion as institucion,
           -- Clave por fecha de emisión: cada día de compras se avisa una sola vez.
           'oc:' || s.rut_institucion || ':' || o.fecha_emision::date as clave,
           count(*) as n, (array_agg(o.codigo order by o.total desc nulls last,o.codigo))[1] as evento_id, coalesce(sum(o.total), 0)::bigint as total,
           (array_agg(o.proveedor order by o.total desc nulls last,o.codigo))[1] as mayor_proveedor,
           (array_agg(o.total order by o.total desc nulls last,o.codigo))[1]::bigint as mayor_total,
           (array_agg(o.nombre order by o.total desc nulls last,o.codigo))[1] as mayor_nombre
    from codigos s
    -- El identificador seguido puede venir del panel (copiado de ordenes_compra.rut_demandante,
    -- que ahí es el código de organismo) o de licitaciones_bi (RUT real): se aceptan los dos.
    join public.ordenes_compra o
      on o.fecha_emision >= p_desde
     and o.rut_demandante=any(s.identificadores)
    group by s.cliente_id, s.rut_institucion, s.nombre_institucion, o.fecha_emision::date
  ) x
  where not exists (select 1 from public.notificaciones_log l
                    where l.cliente_id = x.cliente_id and l.datos->>'clave' = x.clave);
  get diagnostics n = row_count; total := total + n;

  return total;
end;
$$;
revoke execute on function public.instituciones_seguidas_avisar(timestamptz) from public, anon, authenticated;
grant execute on function public.instituciones_seguidas_avisar(timestamptz) to service_role;


-- Backfill conservador: mismo cliente y RUT exacto o nombre exacto único.
-- Una alerta ambigua conserva el destino de recuperación; nunca se adivina identidad.
do $backfill$
begin
  -- El trigger existente deja datos inmutables para el cliente. Deshabilitarlo
  -- solo durante este bloque atómico permite la reparación administrativa;
  -- cualquier error revierte también el cambio de estado del trigger.
  alter table public.notificaciones_log disable trigger trg_notificaciones_log_bloquear_columnas;
with candidatos as (
  select n.id,min(s.rut_institucion) rut
  from public.notificaciones_log n
  join public.cliente_instituciones_seguidas s on s.cliente_id=n.cliente_id
    and (case when coalesce(n.datos->>'rut_institucion',n.datos->>'rut','')<>''
      then s.rut_institucion=coalesce(n.datos->>'rut_institucion',n.datos->>'rut')
      else s.nombre_institucion=n.datos->>'organismo' and nullif(s.nombre_institucion,'') is not null end)
  where n.datos->>'rut_institucion' is null
    and n.tipo in ('medio_institucion','reclamo_institucion','adjudicacion_institucion','compras_institucion')
  group by n.id having count(distinct s.rut_institucion)=1
), reparacion as (
  select n.id,c.rut,
    case n.tipo when 'medio_institucion' then 'noticias' when 'reclamo_institucion' then 'reclamos'
      when 'adjudicacion_institucion' then 'licitaciones' else 'ordenes_compra' end categoria,
    case n.tipo
      when 'medio_institucion' then (
        select m.id::text from public.medios_menciones m
        join public.cliente_instituciones_seguidas s on s.cliente_id=n.cliente_id and s.rut_institucion=c.rut
        where n.datos->>'clave'='medio:'||m.id and m.organismo_norm=public.medios_norm(s.nombre_institucion)
          and public.institucion_nombre_seguro(s.nombre_institucion,public.institucion_rut_seguro(c.rut)) limit 1)
      when 'adjudicacion_institucion' then (
        select l.codigo from public.licitaciones_bi l
        where l.codigo=coalesce(n.datos->>'licitacion_codigo',n.datos->>'licitacion_id',n.licitacion_id)
          and l.institucion_rut=public.institucion_rut_seguro(c.rut) limit 1)
      when 'reclamo_institucion' then (
        select min(r.id_reclamo) from public.reclamos_mp r
        where r.organismo_rut=public.institucion_rut_seguro(c.rut)
          and n.datos->>'clave'='reclamos:'||c.rut||':'||r.created_at::date)
      when 'compras_institucion' then (
        select o.codigo from public.ordenes_compra o
        where public.institucion_rut_seguro(o.rut_demandante)=public.institucion_rut_seguro(c.rut)
          and n.datos->>'clave'='oc:'||c.rut||':'||o.fecha_emision::date
        order by o.total desc nulls last,o.codigo limit 1)
    end evento
  from public.notificaciones_log n join candidatos c on c.id=n.id
)
update public.notificaciones_log n set datos=coalesce(n.datos,'{}'::jsonb)||
  jsonb_build_object('rut_institucion',r.rut,'evento_tipo',r.categoria)||
  case when r.evento is not null then jsonb_build_object('evento_id',r.evento) else '{}'::jsonb end
from reparacion r where r.id=n.id and n.datos->>'rut_institucion' is null;

  alter table public.notificaciones_log enable trigger trg_notificaciones_log_bloquear_columnas;
end;
$backfill$;
