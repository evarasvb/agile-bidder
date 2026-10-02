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
