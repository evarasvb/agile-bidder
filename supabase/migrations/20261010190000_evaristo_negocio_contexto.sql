-- Complemento operativo: respeta RLS, empresa del marketplace y usuario de Postulaciones.
create or replace function public.evaristo_negocio_contexto()
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  cid uuid := public.cliente_owner_id();
  uid uuid := auth.uid();
  market jsonb;
  seguimiento jsonb;
begin
  if uid is null then
    return jsonb_build_object('ahora', now(), 'estado', 'sin_sesion');
  end if;
  begin
    if cid is null then
      market := jsonb_build_object('estado', 'sin_empresa');
    else
      with solicitudes as materialized (
        select s.id, s.solicitante_id, s.proveedor_id, s.estado, s.producto,
          s.cantidad, s.unidad, s.fecha_requerida, s.oportunidad_codigo, s.created_at
        from public.mk_solicitudes s
        where s.solicitante_id = cid or s.proveedor_id = cid
      ), recientes as (
        select s.*, q.precio_unitario, q.plazo_entrega_dias, q.validez_dias,
          q.created_at as cotizacion_en
        from solicitudes s
        left join lateral (
          select c.precio_unitario, c.plazo_entrega_dias, c.validez_dias, c.created_at
          from public.mk_cotizaciones c where c.solicitud_id = s.id
          order by c.created_at desc, c.id desc limit 1
        ) q on true
        order by s.created_at desc, s.id desc limit 5
      )
      select jsonb_build_object(
        'estado', 'ok', 'alcance', 'empresa_autorizada',
        'solicitudes_enviadas', (select count(*) from solicitudes where solicitante_id = cid),
        'solicitudes_recibidas', (select count(*) from solicitudes where proveedor_id = cid),
        'pendientes', (select count(*) from solicitudes where estado in ('enviada', 'vista', 'invitacion_pendiente')),
        'cotizaciones_recibidas', (select count(*) from solicitudes s where s.solicitante_id = cid and exists (
          select 1 from public.mk_cotizaciones c where c.solicitud_id = s.id and c.autor_id <> cid
        )),
        'recientes', coalesce((select jsonb_agg(jsonb_build_object(
          'solicitud_id', id, 'rol', case when solicitante_id = cid then 'solicitante' else 'proveedor' end,
          'producto', left(producto, 180), 'cantidad', cantidad, 'unidad', unidad,
          'estado', estado, 'fecha_requerida', fecha_requerida,
          'oportunidad_codigo', oportunidad_codigo, 'registrada_en', created_at,
          'cotizacion', case when cotizacion_en is null then null else jsonb_build_object(
            'precio_unitario', precio_unitario, 'plazo_entrega_dias', plazo_entrega_dias,
            'validez_registrada_dias', validez_dias, 'registrada_en', cotizacion_en
          ) end
        ) order by created_at desc, id desc) from recientes), '[]'::jsonb)
      ) into market;
    end if;
  exception when others then
    market := jsonb_build_object('estado', 'error');
  end;
  begin
    select jsonb_build_object(
      'estado', 'ok', 'alcance', 'usuario_actual',
      'por_etapa', coalesce((select jsonb_object_agg(etapa, cantidad) from (
        select p.etapa, count(*) cantidad from public.pipeline p where p.user_id = uid group by p.etapa
      ) etapas), '{}'::jsonb),
      'proximas', coalesce((select jsonb_agg(to_jsonb(p) order by p.fecha_cierre asc nulls last) from (
        select oportunidad_id, oportunidad_tipo, etapa, left(titulo, 180) titulo,
          monto_estimado, fecha_cierre, updated_at as actualizado_en
        from public.pipeline where user_id = uid
          and fecha_cierre >= now()
          and etapa in ('descubierta', 'seguimiento', 'preparacion', 'postulada', 'evaluacion')
        order by fecha_cierre asc nulls last, id limit 5
      ) p), '[]'::jsonb)
    ) into seguimiento;
  exception when others then
    seguimiento := jsonb_build_object('estado', 'error', 'alcance', 'usuario_actual');
  end;
  return jsonb_build_object('ahora', now(), 'marketplace', market, 'pipeline', seguimiento);
end;
$$;
revoke all on function public.evaristo_negocio_contexto() from public, anon;
grant execute on function public.evaristo_negocio_contexto() to authenticated;
