-- Corrección (hallazgo de revisión sobre 20260926150000_vigia_cambios_licitaciones.sql):
-- registrar_cambio_adjunto() disparaba un "anexo_nuevo" en CADA insert de
-- licitaciones_adjuntos, incluida la primera vez que licitacion-adjuntos visita un
-- proceso y descarga de una sola vez todas sus bases/anexos ya existentes en Mercado
-- Público. Eso mandaba avisos falsos ("hay un anexo nuevo") a clientes que ya tenían
-- match con procesos recién inventariados, sin que nada hubiera cambiado de verdad.
--
-- licitacion-adjuntos (index.ts) upsertea licitaciones_adjuntos_estado con
-- revisado_en/pendientes ANTES de bajar los archivos, y recién al terminar actualiza
-- 'archivos' con el conteo final — así que si esta licitación ya tenía un inventario
-- completo previo (archivos > 0 de una corrida anterior), un insert nuevo es un anexo
-- que de verdad apareció después. Si archivos es 0/nulo, es la primera carga: no avisar.
create or replace function public.registrar_cambio_adjunto()
returns trigger
language plpgsql
as $$
declare
  v_ya_inventariado boolean;
begin
  select coalesce(e.archivos, 0) > 0 into v_ya_inventariado
  from public.licitaciones_adjuntos_estado e
  where e.codigo = new.codigo;

  if coalesce(v_ya_inventariado, false) then
    insert into public.licitaciones_cambios (tipo_proceso, codigo, campo, valor_anterior, valor_nuevo)
    values ('licitacion', new.codigo, 'anexo_nuevo', null, new.nombre);
  end if;
  return new;
end;
$$;
