-- El catálogo comunitario sigue compartido; la identidad de una negociación
-- y su historial no se pueden transferir editando la solicitud directamente.
begin;
set local lock_timeout = '5s';

create or replace function public.mk_proteger_participantes()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if current_user in ('anon', 'authenticated') and (
    new.solicitante_id is distinct from old.solicitante_id or
    new.proveedor_id is distinct from old.proveedor_id or
    new.proveedor_rut_norm is distinct from old.proveedor_rut_norm or
    new.creado_por is distinct from old.creado_por
  ) then
    raise exception 'No puedes cambiar las empresas participantes de una conversación.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.mk_proteger_participantes() from public, anon, authenticated;
drop trigger if exists trg_mk_proteger_participantes on public.mk_solicitudes;
create trigger trg_mk_proteger_participantes before update on public.mk_solicitudes
for each row execute function public.mk_proteger_participantes();

-- Se valida también al escribir por RPC; los controles del formulario no
-- protegen de peticiones directas. No se alteran cotizaciones históricas.
create or replace function public.mk_validar_cotizacion()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.precio_unitario is null or new.precio_unitario <= 0
     or new.precio_unitario::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Ingresa un precio por unidad válido.' using errcode = '22023';
  end if;
  if new.plazo_entrega_dias < 0 then
    raise exception 'El plazo de entrega no puede ser negativo.' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function public.mk_validar_cotizacion() from public, anon, authenticated;
drop trigger if exists trg_mk_validar_cotizacion on public.mk_cotizaciones;
create trigger trg_mk_validar_cotizacion before insert or update on public.mk_cotizaciones
for each row execute function public.mk_validar_cotizacion();

-- Estos trabajos procesan colas globales; no son acciones de un cliente.
revoke execute on function public.mk_mensajes_por_avisar() from public, anon, authenticated;
revoke execute on function public.mk_mensajes_marcar_avisados(uuid[]) from public, anon, authenticated;
grant execute on function public.mk_mensajes_por_avisar() to service_role;
grant execute on function public.mk_mensajes_marcar_avisados(uuid[]) to service_role;

-- Pruebas transaccionales sin clientes ni conversaciones reales. Una falla
-- aborta la migración completa antes de hacer efectivos los controles.
create temporary table mk_participantes_probe (
  solicitante_id uuid, proveedor_id uuid, proveedor_rut_norm text,
  creado_por uuid, estado text
) on commit drop;
insert into mk_participantes_probe values (null, null, null, null, 'enviada');
create trigger mk_participantes_probe_guard before update on mk_participantes_probe
for each row execute function public.mk_proteger_participantes();
grant select, update on mk_participantes_probe to authenticated;
set local role authenticated;
do $$
begin
  begin
    update mk_participantes_probe set proveedor_id = '00000000-0000-0000-0000-000000000001';
    raise exception 'La prueba permitió reasignar una conversación';
  exception when insufficient_privilege then null;
  end;
  update mk_participantes_probe set estado = 'vista';
end;
$$;
reset role;
create temporary table mk_cotizacion_probe (precio_unitario numeric, plazo_entrega_dias integer) on commit drop;
create trigger mk_cotizacion_probe_guard before insert on mk_cotizacion_probe
for each row execute function public.mk_validar_cotizacion();
do $$
declare valor numeric;
begin
  foreach valor in array array[null, 0, -1, 'NaN'::numeric, 'Infinity'::numeric] loop
    begin
      insert into mk_cotizacion_probe values (valor, 1);
      raise exception 'La prueba permitió un precio inválido';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  begin
    insert into mk_cotizacion_probe values (1000, -1);
    raise exception 'La prueba permitió un plazo negativo';
  exception when invalid_parameter_value then null;
  end;
  insert into mk_cotizacion_probe values (1000, 0), (1000, null);
end;
$$;

commit;
