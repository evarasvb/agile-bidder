-- Campanita: novedades de las instituciones que el cliente sigue (pedido de
-- Evaristo: "hay que avisar lo relacionado con las municipalidades que está
-- siguiendo: noticias, copuchas"). Hasta ahora solo se avisaban licitaciones
-- nuevas (alertas-instituciones-seguidas). Se agregan cuatro avisos más, todos
-- en notificaciones_log (la campanita ya escucha esa tabla en vivo):
--   medio_institucion        prensa nueva sobre la institución (medios_menciones)
--   reclamo_institucion      reclamos nuevos en Mercado Público (pago / proceso), resumidos por día
--   adjudicacion_institucion licitaciones de la institución que pasaron a adjudicadas
--   compras_institucion      resumen de órdenes de compra emitidas (a quién le compró y cuánto)
-- Dedup por (cliente, datos->>'clave'). Sin email: son avisos de campanita.

create index if not exists notificaciones_log_clave_idx
  on public.notificaciones_log (cliente_id, (datos->>'clave'))
  where datos ? 'clave';

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
                            'detalle', x.detalle, 'url', x.url, 'fecha', x.fecha)
  from (
    -- El resumen de Google Noticias viene con HTML y repite el título: el detalle lleva solo medio y fecha.
    -- Solo prensa reciente (60 días): al empezar a seguir una institución se descubre todo su historial de golpe.
    select s.cliente_id, s.nombre_institucion as institucion, 'medio:' || m.id as clave, m.titulo, m.url, m.fecha,
           concat_ws(' · ', nullif(m.medio, ''), to_char(m.fecha, 'DD-MM-YYYY')) as detalle,
           row_number() over (partition by s.cliente_id, s.rut_institucion order by m.fecha desc nulls last, m.id desc) as rn
    from public.cliente_instituciones_seguidas s
    join public.medios_menciones m on m.organismo_norm = public.medios_norm(s.nombre_institucion)
    where m.creado_en >= p_desde and m.titulo is not null
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
           'pago', x.pago, 'proceso', x.proceso)
  from (
    select s.cliente_id, s.rut_institucion as rut, s.nombre_institucion as institucion,
           'reclamos:' || s.rut_institucion || ':' || current_date as clave,
           count(*) as n,
           count(*) filter (where r.tipo = 1) as pago,
           count(*) filter (where r.tipo = 2) as proceso,
           string_agg(distinct left(r.reclamante, 40), ', ') as reclamantes
    from public.cliente_instituciones_seguidas s
    join public.reclamos_mp r on r.organismo_rut = s.rut_institucion
    where r.created_at >= p_desde
    group by s.cliente_id, s.rut_institucion, s.nombre_institucion
  ) x
  where not exists (select 1 from public.notificaciones_log l
                    where l.cliente_id = x.cliente_id and l.datos->>'clave' = x.clave);
  get diagnostics n = row_count; total := total + n;

  -- 3) Licitaciones de la institución que pasaron a adjudicadas (codigo_estado 8) desde p_desde.
  insert into public.notificaciones_log (cliente_id, tipo, licitacion_id, email_enviado, datos)
  select x.cliente_id, 'adjudicacion_institucion', x.codigo, false,
         jsonb_build_object('clave', x.clave, 'organismo', x.institucion, 'licitacion_id', x.codigo,
           'licitacion_codigo', x.codigo, 'tipo_oportunidad', 'licitacion',
           'titulo', 'Adjudicada: ' || x.nombre,
           'detalle', coalesce('Ganó ' || x.proveedor || case when x.monto is not null then ' por $' || to_char(x.monto, 'FM999G999G999G999') else '' end,
                               'Revisa quién ganó y a qué precio en el acta de adjudicación'))
  from (
    select s.cliente_id, s.nombre_institucion as institucion, l.codigo, l.nombre, 'adj:' || l.codigo as clave,
           (select a.proveedor_nombre from public.licitaciones_adjudicaciones a where a.licitacion_id = l.id order by a.monto_adjudicado desc nulls last limit 1) as proveedor,
           (select a.monto_adjudicado from public.licitaciones_adjudicaciones a where a.licitacion_id = l.id order by a.monto_adjudicado desc nulls last limit 1) as monto
    from public.cliente_instituciones_seguidas s
    join public.licitaciones_bi l on l.institucion_rut = s.rut_institucion
    where l.codigo_estado = 8 and l.updated_at >= p_desde
  ) x
  where not exists (select 1 from public.notificaciones_log l
                    where l.cliente_id = x.cliente_id and l.datos->>'clave' = x.clave);
  get diagnostics n = row_count; total := total + n;

  -- 4) Órdenes de compra emitidas por la institución (por su código de organismo en licitaciones_bi), resumen por día.
  insert into public.notificaciones_log (cliente_id, tipo, licitacion_id, email_enviado, datos)
  select x.cliente_id, 'compras_institucion', null, false,
         jsonb_build_object('clave', x.clave, 'organismo', x.institucion, 'rut', x.rut,
           'titulo', x.institucion || ' emitió ' || x.n || case when x.n = 1 then ' orden de compra' else ' órdenes de compra' end
                     || ' por $' || to_char(x.total, 'FM999G999G999G999'),
           'detalle', 'La mayor: ' || coalesce(x.mayor_proveedor, 'proveedor sin nombre') || ' por $' || to_char(x.mayor_total, 'FM999G999G999G999')
                      || coalesce(' · ' || left(x.mayor_nombre, 120), ''),
           'ocs', x.n, 'total', x.total)
  from (
    select s.cliente_id, s.rut_institucion as rut, s.nombre_institucion as institucion,
           'oc:' || s.rut_institucion || ':' || current_date as clave,
           count(*) as n, coalesce(sum(o.total), 0)::bigint as total,
           (array_agg(o.proveedor order by o.total desc nulls last))[1] as mayor_proveedor,
           (array_agg(o.total order by o.total desc nulls last))[1]::bigint as mayor_total,
           (array_agg(o.nombre order by o.total desc nulls last))[1] as mayor_nombre
    from public.cliente_instituciones_seguidas s
    join public.ordenes_compra o
      on o.rut_demandante in (select distinct b.institucion_codigo from public.licitaciones_bi b
                              where b.institucion_rut = s.rut_institucion and b.institucion_codigo is not null)
    where o.fecha_emision >= p_desde
    group by s.cliente_id, s.rut_institucion, s.nombre_institucion
  ) x
  where not exists (select 1 from public.notificaciones_log l
                    where l.cliente_id = x.cliente_id and l.datos->>'clave' = x.clave);
  get diagnostics n = row_count; total := total + n;

  return total;
end;
$$;
revoke execute on function public.instituciones_seguidas_avisar(timestamptz) from public, anon, authenticated;
grant execute on function public.instituciones_seguidas_avisar(timestamptz) to service_role;

-- La prensa de las instituciones seguidas se refresca a diario (las demás, cada 7 días) y va primero en la cola.
create or replace function public.medios_organismos_pendientes(p_limite integer default 8)
returns table(organismo text)
language sql
stable
security definer
set search_path to 'public'
as $$
  with cand as (
    select s.nombre_institucion as organismo, 0 as prio, true as seguida, true as match
    from public.cliente_instituciones_seguidas s
    where s.nombre_institucion is not null
    union all
    select l.institucion_nombre, 1, false, coalesce(l.match_encontrado, false)
    from public.licitaciones_bi l
    where l.codigo_estado = 5 and l.fecha_cierre > now() and l.institucion_nombre is not null
  ),
  agg as (
    select organismo, min(prio) as prio, bool_or(seguida) as seguida, bool_or(match) as match, count(*) as n
    from cand group by organismo
  )
  select a.organismo
  from agg a
  left join public.medios_organismos_estado e on e.organismo_norm = public.medios_norm(a.organismo)
  where e.organismo_norm is null
     or e.revisado_en < now() - (case when a.seguida then interval '1 day' else interval '7 days' end)
     or (e.error is not null and e.revisado_en < now() - interval '1 hour')
  order by a.prio, a.match desc, a.n desc, e.revisado_en asc nulls first
  limit greatest(1, least(coalesce(p_limite, 8), 20));
$$;

-- Dos veces al día (00:10 y 12:10 UTC), después de las cargas de OC, reclamos y prensa.
select cron.unschedule(jobid) from cron.job where jobname = 'avisos-instituciones-seguidas';
select cron.schedule('avisos-instituciones-seguidas', '10 0,12 * * *', $$
  select public.instituciones_seguidas_avisar(now() - interval '2 days');
$$);
