-- Fase 2 de permisos por módulo (RLS) — módulos "enredados" (el cubo).
-- Inventario, Oportunidades y Postulaciones comparten datos entre sí (el inventario
-- se usa para cotizar dentro de Oportunidades y del Libro; los matches y veredictos
-- se leen desde varias pantallas; el post-mortem lee el pipeline). Gatearlos uno a uno
-- por módulo rompería esas funciones cruzadas, así que se usa un candado OPERATIVO:
--
--   tiene_modulo_operativo(): true si el usuario tiene CUALQUIER módulo de trabajo
--   (inicio, oportunidades, postulaciones, inventario, convenio_marco, market,
--   reportes, experto_libro). Como siempre, super_admin / admin (dueño) y miembros
--   con permisos = null pasan. Solo se bloquea a un miembro restringido a módulos
--   periféricos (p. ej. solo cobranza, o solo academia / equipo / instituciones),
--   que no tiene por qué leer el inventario, el pipeline ni los matches del equipo.
--
-- NO se gatea `criterios_evaluacion_extraidos` (dato público/compartido) ni
-- `inventory` (subsistema por organización con otro modelo de auth). Las tablas
-- acotadas solo al dueño (cliente_filtros_oportunidades, cliente_exclusiones) no se
-- tocan porque el candado sería un no-op (el miembro ya no las ve). Ya aplicado en
-- prod vía MCP; se usa ALTER POLICY para conservar la acotación por empresa.

create or replace function public.tiene_modulo_operativo()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_super_admin() or public.is_current_user_admin()
    or coalesce(
         (select v.permisos is null
            or (v.permisos ?| array['inicio','oportunidades','postulaciones','inventario','convenio_marco','market','reportes','experto_libro'])
          from public.vendedores v where v.user_id = auth.uid()
          order by v.updated_at desc nulls last limit 1),
         true);
$$;

-- Inventario de licitaciones
alter policy inv_select_owner on public.cliente_inventario using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo_operativo());
alter policy inv_insert_owner on public.cliente_inventario with check (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo_operativo());
alter policy inv_update_owner on public.cliente_inventario using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo_operativo()) with check (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo_operativo());
alter policy inv_delete_owner on public.cliente_inventario using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo_operativo());

-- Pipeline de postulaciones
alter policy "Users can view own pipeline" on public.pipeline using ((auth.uid() = user_id) and public.tiene_modulo_operativo());
alter policy "Users can insert own pipeline" on public.pipeline with check ((auth.uid() = user_id) and public.tiene_modulo_operativo());
alter policy "Users can update own pipeline" on public.pipeline using ((auth.uid() = user_id) and public.tiene_modulo_operativo());
alter policy "Users can delete own pipeline" on public.pipeline using ((auth.uid() = user_id) and public.tiene_modulo_operativo());

-- Veredictos de oportunidades
alter policy veredictos_select_propio on public.oportunidad_veredictos using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo_operativo());
alter policy veredictos_insert_propio on public.oportunidad_veredictos with check (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo_operativo());
alter policy veredictos_update_propio on public.oportunidad_veredictos using (((cliente_id = cliente_owner_id()) or (cliente_id = auth.uid())) and public.tiene_modulo_operativo());

-- Matches (compra ágil y licitación) — solo lectura para el usuario
alter policy ca_matches_select_owner on public.ca_matches using ((cliente_id = cliente_owner_id()) and public.tiene_modulo_operativo());
alter policy ca_item_matches_select_owner on public.ca_item_matches using ((cliente_id = cliente_owner_id()) and public.tiene_modulo_operativo());
alter policy lic_item_matches_select_owner on public.lic_item_matches using ((cliente_id = cliente_owner_id()) and public.tiene_modulo_operativo());

-- Overrides de match (nota: este modelo compara cliente_id con auth.uid())
alter policy match_overrides_own on public.match_overrides using ((cliente_id = auth.uid()) and public.tiene_modulo_operativo()) with check ((cliente_id = auth.uid()) and public.tiene_modulo_operativo());

-- Auto-bid
alter policy "Users can view own opportunities" on public.auto_bid_opportunities using ((auth.uid() = user_id) and public.tiene_modulo_operativo());
alter policy "Users can insert own opportunities" on public.auto_bid_opportunities with check ((auth.uid() = user_id) and public.tiene_modulo_operativo());
alter policy "Users can update own opportunities" on public.auto_bid_opportunities using ((auth.uid() = user_id) and public.tiene_modulo_operativo());

-- Análisis de postulación (post-mortem)
alter policy pa_select on public.postulacion_analisis using ((cliente_id = cliente_owner_id()) and public.tiene_modulo_operativo());
alter policy pa_insert on public.postulacion_analisis with check ((cliente_id = cliente_owner_id()) and public.tiene_modulo_operativo());
alter policy pa_update on public.postulacion_analisis using ((cliente_id = cliente_owner_id()) and public.tiene_modulo_operativo());
