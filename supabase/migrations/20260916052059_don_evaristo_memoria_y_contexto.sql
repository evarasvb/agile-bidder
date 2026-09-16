-- Aplicada directo a la base por otra sesión (sin dejar el archivo en el repo).
-- La dejamos versionada para que supabase/migrations refleje el estado real
-- de la base: memoria de conversaciones de Don Evaristo (una tabla por
-- conversación y otra por mensaje, RLS "cada quien ve la suya") y una RPC
-- de contexto (evaristo_contexto) que arma de un tiro el resumen del cliente
-- que necesita el chat (empresa, inventario, matches abiertos, ofertas,
-- señales recientes, libros del experto consultados, tickets sin resolver,
-- y la ficha de la licitación/compra ágil que esté mirando en pantalla).
create table if not exists public.evaristo_conversaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid,
  canal text not null default 'app',
  titulo text,
  contexto jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists evaristo_conversaciones_user_idx on public.evaristo_conversaciones (user_id, actualizado_en desc);

create table if not exists public.evaristo_mensajes (
  id bigserial primary key,
  conversacion_id uuid not null references public.evaristo_conversaciones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rol text not null check (rol in ('user', 'assistant')),
  contenido text not null,
  adjuntos jsonb,
  meta jsonb,
  creado_en timestamptz not null default now()
);
create index if not exists evaristo_mensajes_conv_idx on public.evaristo_mensajes (conversacion_id, id);
create index if not exists evaristo_mensajes_user_dia_idx on public.evaristo_mensajes (user_id, creado_en desc);

alter table public.evaristo_conversaciones enable row level security;
alter table public.evaristo_mensajes enable row level security;

drop policy if exists "evaristo_conversaciones_propias" on public.evaristo_conversaciones;
create policy "evaristo_conversaciones_propias" on public.evaristo_conversaciones
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "evaristo_mensajes_propios" on public.evaristo_mensajes;
create policy "evaristo_mensajes_propios" on public.evaristo_mensajes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

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
    'total', count(*), 'por_estado', coalesce(jsonb_object_agg(estado, n) filter (where estado is not null), '{}'::jsonb)
  ) into v_ofertas
  from (select estado, count(*) n from public.cliente_ofertas where cliente_id = v_cid group by estado) o;

  select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'codigo', codigo, 'titulo', left(titulo, 80), 'cuando', created_at) order by created_at desc), '[]'::jsonb) into v_senales
  from (select * from public.cliente_senales where cliente_id = v_cid order by created_at desc limit 8) s;

  select coalesce(jsonb_agg(jsonb_build_object('codigo', licitacion, 'ultima', ultima, 'consultas', n) order by ultima desc), '[]'::jsonb) into v_libros
  from (select licitacion, max(creado_en) ultima, count(*) n from experto.consultas where user_id = v_uid and licitacion is not null group by licitacion order by max(creado_en) desc limit 5) l;

  select coalesce(jsonb_agg(jsonb_build_object('numero', numero, 'asunto', coalesce(asunto, left(mensaje, 60)), 'estado', estado, 'cuando', created_at) order by created_at desc), '[]'::jsonb) into v_tickets
  from (select * from public.soporte_tickets where user_id = v_uid and estado <> 'resuelto' order by created_at desc limit 3) t;

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
    'en_pantalla', v_ficha
  );
end;
$$;

revoke execute on function public.evaristo_contexto(text) from public, anon;
grant execute on function public.evaristo_contexto(text) to authenticated, service_role;
