-- Modo Cobranza real conectado al chat: hoy Don Evaristo Abogado ya redacta
-- cartas de cobro reales (carta_cobranza/requerimiento_pago vía abogado-consultar,
-- con cálculo determinístico de interés por mora) y el cliente ya carga sus
-- facturas por cobrar en /experto/cobranza (facturas_por_cobrar) — pero el chat
-- de Don Evaristo no sabía nada de eso. Se agrega 'facturas_vencidas' al
-- contexto en vivo para que el chat pueda avisar solo, sin que el cliente tenga
-- que acordarse de ir a Cobranza: "tienes N facturas vencidas por $X, ¿redacto
-- la carta de cobro?".
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
  v_facturas jsonb;
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

  -- Modo Cobranza: facturas por cobrar vencidas (pendientes/recordadas/requeridas
  -- con fecha de vencimiento ya pasada), para que el chat las mencione solo.
  select jsonb_build_object(
    'total_vencidas', count(*),
    'monto_total', coalesce(sum(monto), 0),
    'detalle', coalesce((
      select jsonb_agg(jsonb_build_object(
        'deudor', f2.deudor_nombre, 'monto', f2.monto, 'fecha_vencimiento', f2.fecha_vencimiento,
        'dias_atraso', (current_date - f2.fecha_vencimiento), 'estado', f2.estado
      ) order by f2.fecha_vencimiento) from (
        select * from public.facturas_por_cobrar
        where cliente_id = v_cid and estado not in ('pagada', 'incobrable') and fecha_vencimiento < current_date
        order by fecha_vencimiento limit 5
      ) f2
    ), '[]'::jsonb)
  ) into v_facturas
  from public.facturas_por_cobrar
  where cliente_id = v_cid and estado not in ('pagada', 'incobrable') and fecha_vencimiento < current_date;

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
    'facturas_vencidas', v_facturas,
    'en_pantalla', v_ficha
  );
end;
$$;

revoke execute on function public.evaristo_contexto(text) from public, anon;
grant execute on function public.evaristo_contexto(text) to authenticated, service_role;
