-- Don Evaristo, etapa 2: memoria COMPARTIDA entre los 3 modos (chat, Abogado,
-- Experto) y un panel de administración real (deja de ser un simulador).
--
-- evaristo_contexto(): ahora también devuelve 'conversaciones_recientes', los
-- últimos mensajes del usuario en CUALQUIER canal (app/abogado/experto) de las
-- últimas 48h. Así, si el cliente habló con el Abogado hace 10 minutos, el
-- chat de Don Evaristo lo sabe y puede seguir la conversación sin que el
-- cliente tenga que repetir el contexto.
--
-- evaristo_admin_resumen(): reemplaza el panel simulado de AdminEvaristo
-- (que solo hacía un setTimeout y devolvía un mensaje inventado). Es un
-- snapshot real y agregado del sistema (tickets, acciones de la extensión,
-- actividad de los 3 Evaristos, clientes), solo para admins.

create or replace function public.evaristo_contexto(p_codigo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, experto, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_cid uuid;
  v_cli jsonb;
  v_inv jsonb;
  v_ext jsonb;
  v_ca jsonb;
  v_lic jsonb;
  v_ofertas jsonb;
  v_senales jsonb;
  v_libros jsonb;
  v_tickets jsonb;
  v_ficha jsonb;
  v_conversaciones jsonb;
  v_codigo text := nullif(upper(trim(coalesce(p_codigo, ''))), '');
begin
  if v_uid is null then
    return jsonb_build_object('anonimo', true);
  end if;

  v_cid := public.cliente_owner_id();

  select jsonb_build_object(
    'empresa', c.empresa_nombre, 'plan', coalesce(c.plan, 'free'), 'region', c.region,
    'categoria', c.categoria_negocio, 'industrias', c.industrias, 'palabras_clave', c.palabras_clave_busqueda,
    'onboarding_completado', c.onboarding_completado, 'dias_en_firmavb', extract(day from now() - c.created_at)::int,
    'nombre_responsable', c.nombre_responsable
  ) into v_cli
  from public.clientes c where c.id = v_cid;

  select jsonb_build_object(
    'total', count(*),
    'incompletos', count(*) filter (where coalesce(descripcion, '') = '' or coalesce(imagen_url, '') = ''),
    'sin_precio', count(*) filter (where coalesce(precio_unitario, 0) <= 0),
    'ultima_carga', max(created_at)
  ) into v_inv
  from public.cliente_inventario where cliente_id = v_cid;

  select jsonb_build_object(
    'ultima_actividad', (select max(created_at) from public.extension_activity_log where cliente_id = v_cid),
    'claves_activas', (select count(*) from public.extension_api_keys k where k.cliente_id = v_cid and coalesce(k.activa, true))
  ) into v_ext;

  -- Compras ágiles abiertas con match: las que cierran antes primero.
  select coalesce(jsonb_agg(x order by x->>'fecha_cierre'), '[]'::jsonb) into v_ca
  from (
    select jsonb_build_object('codigo', m.compra_agil_codigo, 'nombre', max(ca.nombre), 'organismo', max(ca.nombre_organismo),
      'fecha_cierre', min(coalesce(ca.fecha_cierre, m.fecha_cierre)), 'items_con_match', count(*), 'score_max', max(m.score), 'monto', max(ca.monto_estimado)) as x
    from public.ca_matches m join public.compras_agiles ca on ca.codigo = m.compra_agil_codigo
    where m.cliente_id = v_cid and coalesce(ca.fecha_cierre, m.fecha_cierre) > now()
    group by m.compra_agil_codigo order by min(coalesce(ca.fecha_cierre, m.fecha_cierre)) limit 5
  ) s;

  select coalesce(jsonb_agg(x order by x->>'fecha_cierre'), '[]'::jsonb) into v_lic
  from (
    select jsonb_build_object('codigo', m.licitacion_codigo, 'nombre', max(l.nombre), 'organismo', max(l.nombre_organismo),
      'fecha_cierre', min(coalesce(l.fecha_cierre, m.fecha_cierre)), 'items_con_match', count(*), 'score_max', max(m.score), 'monto', max(l.monto_estimado)) as x
    from public.lic_item_matches m join public.licitaciones l on l.codigo = m.licitacion_codigo
    where m.cliente_id = v_cid and coalesce(l.fecha_cierre, m.fecha_cierre) > now()
    group by m.licitacion_codigo order by min(coalesce(l.fecha_cierre, m.fecha_cierre)) limit 5
  ) s;

  select jsonb_build_object(
    'total', coalesce(sum(n), 0), 'por_estado', coalesce(jsonb_object_agg(estado, n) filter (where estado is not null), '{}'::jsonb)
  ) into v_ofertas
  from (select estado, count(*) n from public.cliente_ofertas where cliente_id = v_cid group by estado) o;

  select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'codigo', codigo, 'titulo', left(titulo, 80), 'cuando', created_at) order by created_at desc), '[]'::jsonb) into v_senales
  from (select * from public.cliente_senales where cliente_id = v_cid order by created_at desc limit 8) s;

  select coalesce(jsonb_agg(jsonb_build_object('codigo', licitacion, 'ultima', ultima, 'consultas', n) order by ultima desc), '[]'::jsonb) into v_libros
  from (select licitacion, max(creado_en) ultima, count(*) n from experto.consultas where user_id = v_uid and licitacion is not null group by licitacion order by max(creado_en) desc limit 5) l;

  select coalesce(jsonb_agg(jsonb_build_object('numero', numero, 'asunto', coalesce(asunto, left(mensaje, 60)), 'estado', estado, 'cuando', created_at) order by created_at desc), '[]'::jsonb) into v_tickets
  from (select * from public.soporte_tickets where user_id = v_uid and estado <> 'resuelto' order by created_at desc limit 3) t;

  -- Memoria compartida entre modos: lo último que este usuario conversó con
  -- CUALQUIERA de los 3 Evaristos (chat/abogado/experto) en las últimas 48h.
  select coalesce(jsonb_agg(jsonb_build_object('canal', x.canal, 'rol', x.rol, 'texto', left(x.contenido, 160), 'cuando', x.creado_en) order by x.creado_en desc), '[]'::jsonb) into v_conversaciones
  from (
    select conv.canal, m.rol, m.contenido, m.creado_en
    from public.evaristo_mensajes m
    join public.evaristo_conversaciones conv on conv.id = m.conversacion_id
    where m.user_id = v_uid and m.creado_en > now() - interval '48 hours'
    order by m.creado_en desc
    limit 6
  ) x;

  -- Lo que está mirando ahora: licitación o compra ágil por código.
  if v_codigo is not null then
    select jsonb_build_object('tipo', 'licitacion', 'codigo', l.codigo, 'nombre', l.nombre, 'organismo', l.nombre_organismo,
      'fecha_cierre', l.fecha_cierre, 'monto', l.monto_estimado, 'region', l.region, 'estado', l.estado,
      'bases_leidas', (select count(*) from public.bases_licitacion b where b.codigo = l.codigo and b.tipo = 'bases'),
      'anexos_leidos', (select count(*) from public.bases_licitacion b where b.codigo = l.codigo and b.tipo = 'anexo'),
      'adjuntos_solo_captcha', (select adjuntos_mp_solo_captcha from public.licitaciones_adjuntos_estado e where e.codigo = l.codigo),
      'items_con_match', (select count(*) from public.lic_item_matches m where m.licitacion_codigo = l.codigo and m.cliente_id = v_cid),
      'match_items', (select coalesce(jsonb_agg(jsonb_build_object('pedido', left(m.nombre_solicitado, 70), 'tu_producto', left(m.nombre_producto, 70), 'score', round(m.score), 'precio', m.precio_unitario)), '[]'::jsonb)
                      from (select * from public.lic_item_matches m where m.licitacion_codigo = l.codigo and m.cliente_id = v_cid order by m.score desc limit 6) m),
      'oferta', (select jsonb_build_object('estado', o.estado, 'valor_total', o.valor_total) from public.cliente_ofertas o where o.cliente_id = v_cid and o.licitacion_id = l.codigo order by o.updated_at desc limit 1),
      'libro_experto', exists (select 1 from experto.consultas q where q.user_id = v_uid and q.licitacion = l.codigo)
    ) into v_ficha
    from public.licitaciones l where l.codigo = v_codigo limit 1;

    if v_ficha is null then
      select jsonb_build_object('tipo', 'compra_agil', 'codigo', ca.codigo, 'nombre', ca.nombre, 'organismo', ca.nombre_organismo,
        'fecha_cierre', ca.fecha_cierre, 'monto', ca.monto_estimado, 'region', ca.region, 'estado', ca.estado,
        'plazo_entrega', ca.plazo_entrega, 'buen_pagador', ca.buen_pagador, 'pago_promedio_dias', ca.pago_promedio_dias,
        'items_con_match', (select count(*) from public.ca_matches m where m.compra_agil_codigo = ca.codigo and m.cliente_id = v_cid),
        'match_items', (select coalesce(jsonb_agg(jsonb_build_object('pedido', left(m.nombre_pedido, 70), 'tu_producto', left(m.nombre_producto, 70), 'score', round(m.score), 'precio', m.precio_unitario)), '[]'::jsonb)
                        from (select * from public.ca_matches m where m.compra_agil_codigo = ca.codigo and m.cliente_id = v_cid order by m.score desc limit 6) m),
        'oferta', (select jsonb_build_object('estado', o.estado, 'valor_total', o.valor_total) from public.cliente_ofertas o where o.cliente_id = v_cid and o.licitacion_id = ca.codigo order by o.updated_at desc limit 1)
      ) into v_ficha
      from public.compras_agiles ca where ca.codigo = v_codigo limit 1;
    end if;
  end if;

  return jsonb_build_object(
    'ahora', now(),
    'cliente', v_cli,
    'inventario', v_inv,
    'extension', v_ext,
    'compras_agiles_con_match', v_ca,
    'licitaciones_con_match', v_lic,
    'ofertas', v_ofertas,
    'senales_recientes', v_senales,
    'libros_experto', v_libros,
    'tickets_abiertos', v_tickets,
    'conversaciones_recientes', v_conversaciones,
    'en_pantalla', v_ficha
  );
end;
$$;

revoke execute on function public.evaristo_contexto(text) from public, anon;
grant execute on function public.evaristo_contexto(text) to authenticated, service_role;

-- Snapshot real del sistema para el panel de administración (solo admins:
-- reemplaza las respuestas 100% simuladas que tenía useEvaristoRevisar /
-- useEvaristoMision en el frontend).
create or replace function public.evaristo_admin_resumen()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_tickets jsonb;
  v_acciones jsonb;
  v_actividad jsonb;
  v_clientes jsonb;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  select jsonb_build_object(
    'abiertos', count(*) filter (where estado = 'abierto'),
    'en_proceso', count(*) filter (where estado = 'en_proceso'),
    'ultimos', coalesce((
      select jsonb_agg(jsonb_build_object('numero', t.numero, 'asunto', coalesce(t.asunto, left(t.mensaje, 60)), 'canal', t.canal, 'cuando', t.created_at) order by t.created_at desc)
      from (select * from public.soporte_tickets where estado <> 'resuelto' order by created_at desc limit 5) t
    ), '[]'::jsonb)
  ) into v_tickets
  from public.soporte_tickets;

  select jsonb_build_object(
    'pendientes', count(*) filter (where estado in ('pendiente', 'confirmar', 'en_curso')),
    'fallidas_24h', count(*) filter (where estado = 'fallida' and terminada_en > now() - interval '24 hours'),
    'hechas_24h', count(*) filter (where estado = 'hecha' and terminada_en > now() - interval '24 hours'),
    'ultimas_fallidas', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', a.tipo, 'codigo', a.codigo, 'error', left(coalesce(a.error, ''), 140), 'cuando', a.terminada_en) order by a.terminada_en desc)
      from (select * from public.evaristo_acciones where estado = 'fallida' order by terminada_en desc nulls last limit 5) a
    ), '[]'::jsonb)
  ) into v_acciones
  from public.evaristo_acciones;

  select jsonb_build_object(
    'conversaciones_24h', (select count(*) from public.evaristo_conversaciones where actualizado_en > now() - interval '24 hours'),
    'mensajes_24h', (select count(*) from public.evaristo_mensajes where creado_en > now() - interval '24 hours'),
    'mensajes_por_canal_24h', coalesce((
      select jsonb_object_agg(x.canal, x.n)
      from (
        select conv.canal, count(*) n
        from public.evaristo_mensajes m
        join public.evaristo_conversaciones conv on conv.id = m.conversacion_id
        where m.creado_en > now() - interval '24 hours'
        group by conv.canal
      ) x
    ), '{}'::jsonb)
  ) into v_actividad;

  select jsonb_build_object(
    'total', count(*),
    'nuevos_7d', count(*) filter (where created_at > now() - interval '7 days')
  ) into v_clientes
  from public.clientes;

  return jsonb_build_object(
    'ahora', now(),
    'tickets', v_tickets,
    'acciones', v_acciones,
    'actividad_evaristo', v_actividad,
    'clientes', v_clientes
  );
end;
$$;

revoke execute on function public.evaristo_admin_resumen() from public, anon;
grant execute on function public.evaristo_admin_resumen() to authenticated;
