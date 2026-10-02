-- Fase 2 de permisos por módulo (RLS) — segunda tanda.
-- Extiende el patrón piloto de Cobranza (`tiene_modulo`) a tres módulos más,
-- los más limpios (tablas que pertenecen 1:1 a su módulo, sin lecturas cruzadas):
--   - Convenio Marco  -> cm_distribuidores, cm_marcas, cm_solicitudes
--   - Market del Estado -> mk_perfiles
--   - Instituciones que sigo -> cliente_instituciones_seguidas
--
-- Recordatorio de seguridad (igual que en Cobranza): `tiene_modulo` devuelve true
-- para super_admin / admin (dueño) y para miembros con permisos = null (sin
-- restricción), así que esto NO bloquea a ningún usuario actual. Solo frena a un
-- miembro al que explícitamente no se le dio ese módulo. Se usa ALTER POLICY para
-- conservar la acotación por empresa existente. Ya aplicado en prod vía MCP.

-- Convenio Marco
alter policy cm_distribuidores_select_owner on public.cm_distribuidores using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('convenio_marco'));
alter policy cm_distribuidores_insert_owner on public.cm_distribuidores with check (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('convenio_marco'));
alter policy cm_distribuidores_update_owner on public.cm_distribuidores using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('convenio_marco')) with check (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('convenio_marco'));
alter policy cm_distribuidores_delete_owner on public.cm_distribuidores using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('convenio_marco'));

alter policy cm_marcas_select_owner on public.cm_marcas using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('convenio_marco'));
alter policy cm_marcas_insert_owner on public.cm_marcas with check (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('convenio_marco'));
alter policy cm_marcas_update_owner on public.cm_marcas using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('convenio_marco')) with check (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('convenio_marco'));
alter policy cm_marcas_delete_owner on public.cm_marcas using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('convenio_marco'));

alter policy cm_solicitudes_select_owner on public.cm_solicitudes using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('convenio_marco'));
alter policy cm_solicitudes_insert_owner on public.cm_solicitudes with check (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('convenio_marco'));
alter policy cm_solicitudes_update_owner on public.cm_solicitudes using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('convenio_marco')) with check (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('convenio_marco'));
alter policy cm_solicitudes_delete_owner on public.cm_solicitudes using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('convenio_marco'));

-- Market del Estado (mkperf_select conserva el OR `visible` del marketplace)
alter policy mkperf_select on public.mk_perfiles using ((visible or (cliente_id = cliente_owner_id())) and public.tiene_modulo('market'));
alter policy mkperf_ins on public.mk_perfiles with check ((cliente_id = cliente_owner_id()) and public.tiene_modulo('market'));
alter policy mkperf_upd on public.mk_perfiles using ((cliente_id = cliente_owner_id()) and public.tiene_modulo('market')) with check ((cliente_id = cliente_owner_id()) and public.tiene_modulo('market'));
alter policy mkperf_del on public.mk_perfiles using ((cliente_id = cliente_owner_id()) and public.tiene_modulo('market'));

-- Instituciones que sigo
alter policy cis_select_owner on public.cliente_instituciones_seguidas using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('instituciones'));
alter policy cis_insert_owner on public.cliente_instituciones_seguidas with check (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('instituciones'));
alter policy cis_update_owner on public.cliente_instituciones_seguidas using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('instituciones'));
alter policy cis_delete_owner on public.cliente_instituciones_seguidas using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo('instituciones'));
