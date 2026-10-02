-- Fase 2 de permisos por módulo: enforcement a nivel de base de datos (RLS).
-- Piloto en el módulo más sensible (Cobranza): un miembro sin el permiso
-- 'cobranza' no puede leer ni escribir las facturas por cobrar ni su
-- seguimiento, aunque pegue directo a la API saltándose la pantalla.
--
-- tiene_modulo(_modulo): true si el usuario actual puede ver ese módulo.
--   - super_admin / admin (dueño): siempre.
--   - miembro: según vendedores.permisos (null = todo; o la clave presente).
--   - sin fila en vendedores: default-allow (no bloquear a nadie existente).
-- SECURITY DEFINER para leer vendedores sin recursión de RLS.

create or replace function public.tiene_modulo(_modulo text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    public.is_super_admin()
    or public.is_current_user_admin()
    or coalesce(
         (select (v.permisos is null or v.permisos ? _modulo)
          from public.vendedores v
          where v.user_id = auth.uid()
          order by v.updated_at desc nulls last
          limit 1),
         true
       );
$$;

-- Se añade el chequeo de módulo a las políticas ya existentes (que acotan por
-- empresa). Se usa ALTER POLICY para conservar su acotación por cliente.

-- facturas_por_cobrar
alter policy fpc_select_owner on public.facturas_por_cobrar
  using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('cobranza'));
alter policy fpc_insert_owner on public.facturas_por_cobrar
  with check (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('cobranza'));
alter policy fpc_update_owner on public.facturas_por_cobrar
  using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('cobranza'))
  with check (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('cobranza'));
alter policy fpc_delete_owner on public.facturas_por_cobrar
  using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('cobranza'));

-- cobranza_seguimiento
alter policy cs_select_owner on public.cobranza_seguimiento
  using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('cobranza'));
alter policy cs_insert_owner on public.cobranza_seguimiento
  with check (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('cobranza'));
alter policy cs_update_owner on public.cobranza_seguimiento
  using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('cobranza'))
  with check (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('cobranza'));
alter policy cs_delete_owner on public.cobranza_seguimiento
  using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('cobranza'));

-- Endurecimientos tras revisión Codex (2 P1 de seguridad):
--
-- (1) La FUENTE de permisos no puede ser editable por el propio miembro: sin
-- esto, un miembro podía UPDATE su fila de vendedores y ponerse permisos=null o
-- agregar 'cobranza' (la política vendedores_update_owner permite user_id =
-- auth.uid()). Se extiende el trigger para que SOLO el dueño del equipo
-- (invitado_por = auth.uid()) o service_role puedan cambiar `permisos` y `rol`.
create or replace function public.vendedores_bloquear_invitado_por_cliente()
returns trigger
language plpgsql
as $function$
begin
  if auth.role() is distinct from 'service_role' then
    if tg_op = 'INSERT' then
      if new.invitado_por is distinct from auth.uid() then
        new.invitado_por := null;
      end if;
      if new.user_id is distinct from auth.uid() then
        new.user_id := null;
      end if;
      if new.invitado_por is distinct from auth.uid() then
        new.permisos := null;
        new.rol := 'vendedor';
      end if;
    else
      if new.invitado_por is distinct from old.invitado_por then
        new.invitado_por := old.invitado_por;
      end if;
      if new.user_id is distinct from old.user_id then
        new.user_id := old.user_id;
      end if;
      if auth.uid() is distinct from old.invitado_por then
        new.permisos := old.permisos;
        new.rol := old.rol;
      end if;
    end if;
  end if;
  return new;
end;
$function$;

-- (2) Las funciones SECURITY DEFINER que leen facturas_por_cobrar
-- (evaristo_contexto, institucion_zoom, conciliar_cartola, panel_cumplimiento,
-- mis_ordenes_compra) corrían como dueño y saltaban la RLS. Con FORCE ROW LEVEL
-- SECURITY, la RLS (y el chequeo de módulo) aplica también dentro de ellas con
-- el auth.uid() del que llama; service_role (crons/sync) la sigue saltando.
alter table public.facturas_por_cobrar force row level security;
alter table public.cobranza_seguimiento force row level security;
