-- Agregar secciones faltantes a role_permissions
-- Compras Ágiles y Órdenes de Compra

-- Insertar permisos para COMPRAS_AGILES
INSERT INTO public.role_permissions (role, section_key, section_name, can_view, can_edit, can_delete) VALUES
-- SUPER_ADMIN: Todo
('super_admin', 'compras_agiles', 'Compras Ágiles', true, true, true),
-- ADMIN: Todo
('admin', 'compras_agiles', 'Compras Ágiles', true, true, true),
-- USER: Ver y editar
('user', 'compras_agiles', 'Compras Ágiles', true, true, false),
-- VENDEDOR: Ver y editar
('vendedor', 'compras_agiles', 'Compras Ágiles', true, true, false),
-- VISOR: Solo ver
('visor', 'compras_agiles', 'Compras Ágiles', true, false, false)
ON CONFLICT (role, section_key) DO UPDATE SET
  section_name = EXCLUDED.section_name,
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  updated_at = now();

-- Insertar permisos para ORDENES_COMPRA
INSERT INTO public.role_permissions (role, section_key, section_name, can_view, can_edit, can_delete) VALUES
-- SUPER_ADMIN: Todo
('super_admin', 'ordenes_compra', 'Órdenes de Compra', true, true, true),
-- ADMIN: Todo
('admin', 'ordenes_compra', 'Órdenes de Compra', true, true, true),
-- USER: Ver y editar
('user', 'ordenes_compra', 'Órdenes de Compra', true, true, false),
-- VENDEDOR: Ver y editar
('vendedor', 'ordenes_compra', 'Órdenes de Compra', true, true, false),
-- VISOR: Solo ver
('visor', 'ordenes_compra', 'Órdenes de Compra', true, false, false)
ON CONFLICT (role, section_key) DO UPDATE SET
  section_name = EXCLUDED.section_name,
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  updated_at = now();

-- Agregar columna can_delete si no existe (por compatibilidad)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'role_permissions' 
    AND column_name = 'can_delete'
  ) THEN
    ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS can_delete BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Actualizar permisos existentes para agregar can_delete
UPDATE public.role_permissions 
SET can_delete = can_edit 
WHERE can_delete IS NULL OR can_delete = false;
