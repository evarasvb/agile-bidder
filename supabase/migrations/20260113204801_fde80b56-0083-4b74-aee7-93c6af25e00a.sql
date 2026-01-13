-- Crear tabla de configuración de permisos por rol
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role public.app_role NOT NULL,
    section_key TEXT NOT NULL,
    section_name TEXT NOT NULL,
    can_view BOOLEAN DEFAULT false,
    can_edit BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(role, section_key)
);

-- Habilitar RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Solo super_admin puede modificar permisos
CREATE POLICY "Super admin can manage permissions"
ON public.role_permissions
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'super_admin'
    )
);

-- Todos los usuarios autenticados pueden leer permisos
CREATE POLICY "Authenticated users can read permissions"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (true);

-- Insertar permisos por defecto para cada rol
-- SUPER_ADMIN: Todo
INSERT INTO public.role_permissions (role, section_key, section_name, can_view, can_edit) VALUES
('super_admin', 'dashboard', 'Dashboard', true, true),
('super_admin', 'licitaciones', 'Licitaciones', true, true),
('super_admin', 'vendedores', 'Gestión Vendedores', true, true),
('super_admin', 'mercadopublico', 'MercadoPúblico', true, true),
('super_admin', 'bi_dashboard', 'BI Dashboard', true, true),
('super_admin', 'bi_advanced', 'BI Avanzado', true, true),
('super_admin', 'calendar', 'Calendario', true, true),
('super_admin', 'inventory', 'Inventario', true, true),
('super_admin', 'odoo', 'Odoo CRM', true, true),
('super_admin', 'extension', 'Extensión Chrome', true, true),
('super_admin', 'history', 'Historial', true, true),
('super_admin', 'settings', 'Configuración', true, true),
('super_admin', 'users', 'Usuarios', true, true),
('super_admin', 'logs', 'Logs', true, true),
('super_admin', 'role_config', 'Configuración de Roles', true, true);

-- ADMIN: Todo excepto logs y configuración de roles
INSERT INTO public.role_permissions (role, section_key, section_name, can_view, can_edit) VALUES
('admin', 'dashboard', 'Dashboard', true, true),
('admin', 'licitaciones', 'Licitaciones', true, true),
('admin', 'vendedores', 'Gestión Vendedores', true, true),
('admin', 'mercadopublico', 'MercadoPúblico', true, true),
('admin', 'bi_dashboard', 'BI Dashboard', true, true),
('admin', 'bi_advanced', 'BI Avanzado', true, true),
('admin', 'calendar', 'Calendario', true, true),
('admin', 'inventory', 'Inventario', true, true),
('admin', 'odoo', 'Odoo CRM', true, true),
('admin', 'extension', 'Extensión Chrome', true, true),
('admin', 'history', 'Historial', true, true),
('admin', 'settings', 'Configuración', true, true),
('admin', 'users', 'Usuarios', true, true),
('admin', 'logs', 'Logs', false, false),
('admin', 'role_config', 'Configuración de Roles', false, false);

-- USER: Vista de trabajo
INSERT INTO public.role_permissions (role, section_key, section_name, can_view, can_edit) VALUES
('user', 'dashboard', 'Dashboard', true, false),
('user', 'licitaciones', 'Licitaciones', true, true),
('user', 'vendedores', 'Gestión Vendedores', true, false),
('user', 'mercadopublico', 'MercadoPúblico', true, false),
('user', 'bi_dashboard', 'BI Dashboard', false, false),
('user', 'bi_advanced', 'BI Avanzado', false, false),
('user', 'calendar', 'Calendario', true, true),
('user', 'inventory', 'Inventario', true, false),
('user', 'odoo', 'Odoo CRM', false, false),
('user', 'extension', 'Extensión Chrome', true, false),
('user', 'history', 'Historial', true, false),
('user', 'settings', 'Configuración', false, false),
('user', 'users', 'Usuarios', false, false),
('user', 'logs', 'Logs', false, false),
('user', 'role_config', 'Configuración de Roles', false, false);

-- VENDEDOR
INSERT INTO public.role_permissions (role, section_key, section_name, can_view, can_edit) VALUES
('vendedor', 'dashboard', 'Dashboard', true, false),
('vendedor', 'licitaciones', 'Licitaciones', true, true),
('vendedor', 'vendedores', 'Gestión Vendedores', false, false),
('vendedor', 'mercadopublico', 'MercadoPúblico', true, false),
('vendedor', 'bi_dashboard', 'BI Dashboard', false, false),
('vendedor', 'bi_advanced', 'BI Avanzado', false, false),
('vendedor', 'calendar', 'Calendario', true, true),
('vendedor', 'inventory', 'Inventario', true, false),
('vendedor', 'odoo', 'Odoo CRM', false, false),
('vendedor', 'extension', 'Extensión Chrome', true, false),
('vendedor', 'history', 'Historial', true, false),
('vendedor', 'settings', 'Configuración', false, false),
('vendedor', 'users', 'Usuarios', false, false),
('vendedor', 'logs', 'Logs', false, false),
('vendedor', 'role_config', 'Configuración de Roles', false, false);

-- VISOR: Solo lectura de BI
INSERT INTO public.role_permissions (role, section_key, section_name, can_view, can_edit) VALUES
('visor', 'dashboard', 'Dashboard', true, false),
('visor', 'licitaciones', 'Licitaciones', false, false),
('visor', 'vendedores', 'Gestión Vendedores', false, false),
('visor', 'mercadopublico', 'MercadoPúblico', false, false),
('visor', 'bi_dashboard', 'BI Dashboard', true, false),
('visor', 'bi_advanced', 'BI Avanzado', true, false),
('visor', 'calendar', 'Calendario', false, false),
('visor', 'inventory', 'Inventario', false, false),
('visor', 'odoo', 'Odoo CRM', false, false),
('visor', 'extension', 'Extensión Chrome', false, false),
('visor', 'history', 'Historial', true, false),
('visor', 'settings', 'Configuración', false, false),
('visor', 'users', 'Usuarios', false, false),
('visor', 'logs', 'Logs', false, false),
('visor', 'role_config', 'Configuración de Roles', false, false);

-- Función para verificar si un usuario tiene permiso para una sección
CREATE OR REPLACE FUNCTION public.user_can_access_section(
    _user_id UUID,
    _section_key TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.role_permissions rp
        INNER JOIN public.user_roles ur ON ur.role = rp.role
        WHERE ur.user_id = _user_id
        AND rp.section_key = _section_key
        AND rp.can_view = true
    )
$$;

-- Función para obtener el rol principal de un usuario
CREATE OR REPLACE FUNCTION public.get_user_primary_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_roles 
    WHERE user_id = _user_id 
    ORDER BY 
        CASE role 
            WHEN 'super_admin' THEN 1 
            WHEN 'admin' THEN 2 
            WHEN 'user' THEN 3
            WHEN 'vendedor' THEN 4
            WHEN 'visor' THEN 5
        END
    LIMIT 1
$$;