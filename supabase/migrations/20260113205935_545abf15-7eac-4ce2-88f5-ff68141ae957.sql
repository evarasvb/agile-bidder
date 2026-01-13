-- Agregar columna can_delete a role_permissions si no existe
ALTER TABLE public.role_permissions 
ADD COLUMN IF NOT EXISTS can_delete BOOLEAN DEFAULT false;

-- Actualizar permisos por defecto para super_admin con can_delete
UPDATE public.role_permissions 
SET can_delete = true 
WHERE role = 'super_admin';

-- Actualizar permisos para admin con can_delete en ciertas secciones
UPDATE public.role_permissions 
SET can_delete = true 
WHERE role = 'admin' AND section_key IN ('inventory', 'vendedores', 'licitaciones');