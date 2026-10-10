-- Vínculo privado: el proveedor no recibe el código de la oportunidad del solicitante.
create table if not exists public.mk_solicitud_vinculos (
  solicitud_id uuid primary key references public.mk_solicitudes(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  oportunidad_codigo text not null check (oportunidad_codigo ~ '^[0-9]{1,7}-[0-9]{1,6}-COT[0-9]{2,3}$'),
  item_ref text not null check (length(trim(item_ref)) between 1 and 160),
  item_origen text not null default 'requisito' check (item_origen in ('requisito', 'manual')),
  updated_at timestamptz not null default now()
);
create index if not exists idx_mk_vinculos_cliente_oportunidad on public.mk_solicitud_vinculos(cliente_id, oportunidad_codigo);
alter table public.mk_solicitud_vinculos enable row level security;
revoke all on public.mk_solicitud_vinculos from public, anon, authenticated;
grant select, insert, update on public.mk_solicitud_vinculos to authenticated;
grant all on public.mk_solicitud_vinculos to service_role;
drop policy if exists mk_vinculos_solicitante on public.mk_solicitud_vinculos;
create policy mk_vinculos_solicitante on public.mk_solicitud_vinculos
  for all to authenticated
  using (cliente_id = public.cliente_owner_id() and exists (
    select 1 from public.mk_solicitudes s where s.id = solicitud_id and s.solicitante_id = public.cliente_owner_id()
  ))
  with check (cliente_id = public.cliente_owner_id() and exists (
    select 1 from public.mk_solicitudes s where s.id = solicitud_id and s.solicitante_id = public.cliente_owner_id()
  ));

-- Se valida también la escritura directa: un ítem real debe pertenecer a esta compra.
create or replace function public.mk_validar_vinculo_requisito()
returns trigger language plpgsql security invoker set search_path = public, pg_catalog
as $$
begin
  new.oportunidad_codigo := upper(trim(new.oportunidad_codigo));
  new.item_ref := trim(new.item_ref);
  if not exists (select 1 from public.compras_agiles c where c.codigo = new.oportunidad_codigo) then
    raise exception 'Compra no disponible';
  end if;
  if new.item_ref like 'manual-%' then
    -- Producto adicional declarado por el cliente; no se presenta como requisito oficial.
    new.item_origen := 'manual';
  else
    if not exists (
      select 1 from public.compras_agiles_items i
      join public.compras_agiles c on c.id = i.compra_agil_id
      where c.codigo = new.oportunidad_codigo and i.id::text = new.item_ref
    ) then raise exception 'El ítem no pertenece a esta compra'; end if;
    new.item_origen := 'requisito';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.mk_validar_vinculo_requisito() from public, anon;
grant execute on function public.mk_validar_vinculo_requisito() to authenticated;
drop trigger if exists mk_vinculo_requisito on public.mk_solicitud_vinculos;
create trigger mk_vinculo_requisito before insert or update on public.mk_solicitud_vinculos
  for each row execute function public.mk_validar_vinculo_requisito();

create or replace function public.mk_vincular_solicitud(p_solicitud uuid, p_codigo text, p_item_ref text)
returns uuid language plpgsql security invoker set search_path = public, pg_catalog
as $$
declare
  cid uuid := public.cliente_owner_id();
  v_codigo text := upper(trim(p_codigo));
begin
  if auth.uid() is null or cid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if v_codigo is null or v_codigo !~ '^[0-9]{1,7}-[0-9]{1,6}-COT[0-9]{2,3}$'
    or p_item_ref is null or length(trim(p_item_ref)) not between 1 and 160 then
    raise exception 'Referencia de compra o ítem inválida';
  end if;
  if not exists (select 1 from public.mk_solicitudes s where s.id = p_solicitud and s.solicitante_id = cid)
    or not exists (select 1 from public.compras_agiles c where c.codigo = v_codigo) then
    raise exception 'No autorizado o referencia no disponible' using errcode = '42501';
  end if;
  insert into public.mk_solicitud_vinculos(solicitud_id, cliente_id, oportunidad_codigo, item_ref)
    values (p_solicitud, cid, v_codigo, trim(p_item_ref))
    on conflict (solicitud_id) do update set oportunidad_codigo = excluded.oportunidad_codigo,
      item_ref = excluded.item_ref, updated_at = now();
  return p_solicitud;
end;
$$;
revoke all on function public.mk_vincular_solicitud(uuid, text, text) from public, anon;
grant execute on function public.mk_vincular_solicitud(uuid, text, text) to authenticated;

-- Retira una eventual firma preliminar; llamadas sin argumento usan el default de la nueva firma.
drop function if exists public.evaristo_negocio_contexto();

-- Complemento operativo: respeta RLS, empresa del marketplace y usuario de Postulaciones.
create or replace function public.evaristo_negocio_contexto(p_codigo text default null)
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
          s.cantidad, s.unidad, s.fecha_requerida,
          coalesce(v.oportunidad_codigo, s.oportunidad_codigo) as oportunidad_codigo, v.item_ref, v.item_origen, s.created_at
        from public.mk_solicitudes s
        left join public.mk_solicitud_vinculos v on v.solicitud_id = s.id and v.cliente_id = cid and s.solicitante_id = cid
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
        order by (s.oportunidad_codigo = p_codigo) desc nulls last, s.created_at desc, s.id desc limit 5
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
          'oportunidad_codigo', oportunidad_codigo, 'item_ref', item_ref, 'item_origen', item_origen, 'registrada_en', created_at,
          'cotizacion', case when cotizacion_en is null then null else jsonb_build_object(
            'precio_unitario', precio_unitario, 'plazo_entrega_dias', plazo_entrega_dias,
            'validez_registrada_dias', validez_dias, 'registrada_en', cotizacion_en
          ) end
        ) order by (oportunidad_codigo = p_codigo) desc nulls last, created_at desc, id desc) from recientes), '[]'::jsonb)
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
revoke all on function public.evaristo_negocio_contexto(text) from public, anon;
grant execute on function public.evaristo_negocio_contexto(text) to authenticated;
