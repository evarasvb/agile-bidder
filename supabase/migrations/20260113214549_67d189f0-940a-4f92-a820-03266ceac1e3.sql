-- Add ofertas section to role_permissions for all roles
INSERT INTO public.role_permissions (role, section_key, section_name, can_view, can_edit, can_delete) VALUES
  ('super_admin', 'ofertas', 'Mis Ofertas', true, true, true),
  ('admin', 'ofertas', 'Mis Ofertas', true, true, true),
  ('user', 'ofertas', 'Mis Ofertas', true, true, false),
  ('vendedor', 'ofertas', 'Mis Ofertas', true, true, false),
  ('visor', 'ofertas', 'Mis Ofertas', true, false, false)
ON CONFLICT (role, section_key) DO UPDATE 
SET section_name = EXCLUDED.section_name,
    can_view = EXCLUDED.can_view,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete;