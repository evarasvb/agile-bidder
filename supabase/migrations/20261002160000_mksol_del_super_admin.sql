-- Hallazgo de Codex en PR #457: la política mksol_del (20261002050000) solo
-- dejaba borrar solicitudes a un admin exacto (user_roles.role = 'admin').
-- useProfile() en el frontend trata a super_admin como admin (isAdmin =
-- 'admin' o 'super_admin'), así que el fundador veía el botón de eliminar
-- pero el DELETE le fallaba por RLS. is_super_admin() ya existe desde
-- 20261002130000, posterior a la política original — por eso se amplía acá
-- en vez de en esa migración.
ALTER POLICY mksol_del ON public.mk_solicitudes USING (
  ((solicitante_id = (select public.cliente_owner_id())) or (proveedor_id = (select public.cliente_owner_id())))
  and (public.has_role(auth.uid(), 'admin'::app_role) or public.is_super_admin())
);
