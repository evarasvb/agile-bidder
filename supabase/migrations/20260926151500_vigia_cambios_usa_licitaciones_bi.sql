-- Corrección: la migración anterior (vigia_cambios_licitaciones) puso el trigger
-- de detección de cambios en public.licitaciones, pero esa tabla es legacy y ya
-- no se usa para nada vivo: lic_item_matches.licitacion_codigo hace match 100%
-- con public.licitaciones_bi.codigo y 0% con public.licitaciones.codigo (93.769
-- filas legacy vs 140.300 en licitaciones_bi, la tabla que de verdad alimentan
-- sync-licitaciones-bi/enrich-licitaciones-bi). Con el trigger en la tabla
-- equivocada, la vigía nunca iba a detectar un cambio real. Se reemplaza por un
-- trigger propio en licitaciones_bi, con sus columnas reales (presupuesto_estimado,
-- no monto_estimado; sin fecha_cierre_segundo_llamado, que no existe ahí).

drop trigger if exists licitaciones_registrar_cambio on public.licitaciones;
drop trigger if exists compras_agiles_registrar_cambio on public.compras_agiles;
drop function if exists public.registrar_cambio_proceso();

create or replace function public.registrar_cambio_licitacion_bi()
returns trigger
language plpgsql
as $$
begin
  if old.fecha_cierre is not null and new.fecha_cierre is distinct from old.fecha_cierre then
    insert into public.licitaciones_cambios (tipo_proceso, codigo, campo, valor_anterior, valor_nuevo)
    values ('licitacion', new.codigo, 'fecha_cierre', old.fecha_cierre::text, new.fecha_cierre::text);
  end if;
  if old.presupuesto_estimado is not null and new.presupuesto_estimado is distinct from old.presupuesto_estimado then
    insert into public.licitaciones_cambios (tipo_proceso, codigo, campo, valor_anterior, valor_nuevo)
    values ('licitacion', new.codigo, 'monto_estimado', old.presupuesto_estimado::text, new.presupuesto_estimado::text);
  end if;
  if old.estado is not null and new.estado is distinct from old.estado then
    insert into public.licitaciones_cambios (tipo_proceso, codigo, campo, valor_anterior, valor_nuevo)
    values ('licitacion', new.codigo, 'estado', old.estado, new.estado);
  end if;
  return new;
end;
$$;

create trigger licitaciones_bi_registrar_cambio
  after update on public.licitaciones_bi
  for each row execute function public.registrar_cambio_licitacion_bi();

-- La compra ágil sí sigue siendo public.compras_agiles (única tabla para ese
-- dominio, sin equivalente "_bi"): separa su lógica en su propia función, ahora
-- que la de licitación quedó específica de licitaciones_bi.
drop trigger if exists compras_agiles_registrar_cambio on public.compras_agiles;

create or replace function public.registrar_cambio_compra_agil()
returns trigger
language plpgsql
as $$
begin
  if old.fecha_cierre is not null and new.fecha_cierre is distinct from old.fecha_cierre then
    insert into public.licitaciones_cambios (tipo_proceso, codigo, campo, valor_anterior, valor_nuevo)
    values ('compra_agil', new.codigo, 'fecha_cierre', old.fecha_cierre::text, new.fecha_cierre::text);
  end if;
  if old.fecha_cierre_segundo_llamado is not null and new.fecha_cierre_segundo_llamado is distinct from old.fecha_cierre_segundo_llamado then
    insert into public.licitaciones_cambios (tipo_proceso, codigo, campo, valor_anterior, valor_nuevo)
    values ('compra_agil', new.codigo, 'fecha_cierre_segundo_llamado', old.fecha_cierre_segundo_llamado::text, new.fecha_cierre_segundo_llamado::text);
  end if;
  if old.monto_estimado is not null and new.monto_estimado is distinct from old.monto_estimado then
    insert into public.licitaciones_cambios (tipo_proceso, codigo, campo, valor_anterior, valor_nuevo)
    values ('compra_agil', new.codigo, 'monto_estimado', old.monto_estimado::text, new.monto_estimado::text);
  end if;
  if old.estado is not null and new.estado is distinct from old.estado then
    insert into public.licitaciones_cambios (tipo_proceso, codigo, campo, valor_anterior, valor_nuevo)
    values ('compra_agil', new.codigo, 'estado', old.estado, new.estado);
  end if;
  return new;
end;
$$;

create trigger compras_agiles_registrar_cambio
  after update on public.compras_agiles
  for each row execute function public.registrar_cambio_compra_agil();
