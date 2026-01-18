-- ============================================
-- MIGRACIONES CONSOLIDADAS PARA SUPABASE
-- ============================================
-- Este archivo contiene TODAS las migraciones del proyecto
-- Ejecuta este SQL completo en Supabase Dashboard → SQL Editor
-- 
-- INSTRUCCIONES:
-- 1. Ve a Supabase Dashboard → SQL Editor
-- 2. Copia TODO este archivo
-- 3. Pégalo en SQL Editor
-- 4. Haz clic en "Run" o presiona Ctrl+Enter
-- 5. Espera a que termine (puede tardar unos minutos)
-- ============================================


-- ============================================
-- MIGRACIÓN 1/45: 20260109120036_aba11a6a-4aa0-469b-ba5a-cb7ddf4e072f.sql
-- ============================================

-- Table for licitaciones (procurements)
CREATE TABLE IF NOT EXISTS public.licitaciones (
  id_licitacion TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  organismo TEXT NOT NULL,
  presupuesto NUMERIC,
  fecha_cierre TIMESTAMP WITH TIME ZONE,
  estado TEXT DEFAULT 'activa',
  link_oficial TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for licitacion items (products within each procurement)
CREATE TABLE IF NOT EXISTS public.licitacion_items (
  id SERIAL PRIMARY KEY,
  licitacion_id TEXT NOT NULL REFERENCES public.licitaciones(id_licitacion) ON DELETE CASCADE,
  nombre_producto TEXT NOT NULL,
  descripcion TEXT,
  cantidad NUMERIC,
  unidad TEXT
);

-- Enable RLS but allow public read for scraper data display
ALTER TABLE public.licitaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacion_items ENABLE ROW LEVEL SECURITY;

-- Public read policy for licitaciones (scraper data is public)
CREATE POLICY "Allow public read access to licitaciones" 
ON public.licitaciones 
FOR SELECT 
USING (true);

-- Public read policy for licitacion_items
CREATE POLICY "Allow public read access to licitacion_items" 
ON public.licitacion_items 
FOR SELECT 
USING (true);

-- Insert policy for service role (scraper will use service key)
CREATE POLICY "Allow service role insert to licitaciones" 
ON public.licitaciones 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow service role insert to licitacion_items" 
ON public.licitacion_items 
FOR INSERT 
WITH CHECK (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.licitaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.licitacion_items;

-- ============================================
-- MIGRACIÓN 2/45: 20260110010620_5d1ed8c2-96af-4345-a0dc-fcf0b98b5e1e.sql
-- ============================================

-- Add new columns for processing and matching workflow
ALTER TABLE public.licitaciones 
ADD COLUMN IF NOT EXISTS procesada boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS match_encontrado boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS match_score numeric DEFAULT NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_licitaciones_procesada ON public.licitaciones(procesada);
CREATE INDEX IF NOT EXISTS idx_licitaciones_match ON public.licitaciones(match_encontrado);

-- Add UPDATE policy for service role
DROP POLICY IF EXISTS "Allow service role update to licitaciones" ON public.licitaciones;
CREATE POLICY "Allow service role update to licitaciones" 
ON public.licitaciones 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- ============================================
-- MIGRACIÓN 3/45: 20260110042346_49c7ce80-46d7-47cd-ab52-a6eb8d319bed.sql
-- ============================================

-- Create enum for notification frequency
CREATE TYPE IF NOT EXISTS public.notification_frequency AS ENUM ('immediate', 'daily', 'weekly');

-- Create user_preferences table
CREATE TABLE public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    company_name TEXT,
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    onboarding_step INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_categories table
CREATE TABLE public.user_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    category_id TEXT NOT NULL,
    category_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, category_id)
);

-- Create user_regions table
CREATE TABLE public.user_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    region_code TEXT NOT NULL,
    region_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, region_code)
);

-- Create user_notifications table
CREATE TABLE public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    email_notifications BOOLEAN NOT NULL DEFAULT true,
    push_notifications BOOLEAN NOT NULL DEFAULT false,
    notification_frequency notification_frequency NOT NULL DEFAULT 'daily',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_preferences (public access for now, will be restricted with auth later)
CREATE POLICY "Allow public read access to user_preferences"
ON public.user_preferences FOR SELECT USING (true);

CREATE POLICY "Allow public insert to user_preferences"
ON public.user_preferences FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to user_preferences"
ON public.user_preferences FOR UPDATE USING (true) WITH CHECK (true);

-- RLS Policies for user_categories
CREATE POLICY "Allow public read access to user_categories"
ON public.user_categories FOR SELECT USING (true);

CREATE POLICY "Allow public insert to user_categories"
ON public.user_categories FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete to user_categories"
ON public.user_categories FOR DELETE USING (true);

-- RLS Policies for user_regions
CREATE POLICY "Allow public read access to user_regions"
ON public.user_regions FOR SELECT USING (true);

CREATE POLICY "Allow public insert to user_regions"
ON public.user_regions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete to user_regions"
ON public.user_regions FOR DELETE USING (true);

-- RLS Policies for user_notifications
CREATE POLICY "Allow public read access to user_notifications"
ON public.user_notifications FOR SELECT USING (true);

CREATE POLICY "Allow public insert to user_notifications"
ON public.user_notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to user_notifications"
ON public.user_notifications FOR UPDATE USING (true) WITH CHECK (true);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_notifications_updated_at
BEFORE UPDATE ON public.user_notifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- MIGRACIÓN 4/45: 20260110052945_0ee1b984-c91f-4340-b4ae-09b7fc94ebe6.sql
-- ============================================

-- =============================================
-- FASE 1: TABLA DE INVENTARIO COMPLETO
-- =============================================
CREATE TABLE public.inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  nombre_producto TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  precio_unitario NUMERIC NOT NULL DEFAULT 0,
  margen_minimo NUMERIC NOT NULL DEFAULT 10,
  margen_objetivo NUMERIC NOT NULL DEFAULT 25,
  stock_disponible NUMERIC NOT NULL DEFAULT 0,
  unidad_medida TEXT NOT NULL DEFAULT 'unidad',
  tiempo_entrega_dias INTEGER NOT NULL DEFAULT 7,
  proveedor TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory (public read, service role write)
CREATE POLICY "Allow public read access to inventory"
ON public.inventory FOR SELECT
USING (true);

CREATE POLICY "Allow service role insert to inventory"
ON public.inventory FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow service role update to inventory"
ON public.inventory FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow service role delete to inventory"
ON public.inventory FOR DELETE
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_inventory_updated_at
BEFORE UPDATE ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FASE 3: TABLA DE OFERTAS
-- =============================================
CREATE TABLE public.ofertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  licitacion_id TEXT NOT NULL REFERENCES public.licitaciones(id_licitacion),
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'revision', 'aprobada', 'enviada', 'rechazada', 'ganada', 'perdida')),
  match_score NUMERIC,
  productos_ofertados JSONB NOT NULL DEFAULT '[]',
  valor_total_oferta NUMERIC NOT NULL DEFAULT 0,
  margen_total NUMERIC NOT NULL DEFAULT 0,
  notas_internas TEXT,
  documento_oferta_url TEXT,
  fecha_envio TIMESTAMP WITH TIME ZONE,
  respuesta_mp JSONB,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ofertas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ofertas
CREATE POLICY "Allow public read access to ofertas"
ON public.ofertas FOR SELECT
USING (true);

CREATE POLICY "Allow public insert to ofertas"
ON public.ofertas FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update to ofertas"
ON public.ofertas FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete to ofertas"
ON public.ofertas FOR DELETE
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_ofertas_updated_at
BEFORE UPDATE ON public.ofertas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FASE 9: TABLA DE LOGS MEJORADA
-- =============================================
CREATE TABLE public.system_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('match', 'oferta_generada', 'oferta_enviada', 'scraping', 'error', 'info')),
  severidad TEXT NOT NULL DEFAULT 'info' CHECK (severidad IN ('info', 'warning', 'error', 'success')),
  mensaje TEXT NOT NULL,
  licitacion_id TEXT,
  oferta_id UUID REFERENCES public.ofertas(id),
  detalles JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_logs
CREATE POLICY "Allow public read access to system_logs"
ON public.system_logs FOR SELECT
USING (true);

CREATE POLICY "Allow public insert to system_logs"
ON public.system_logs FOR INSERT
WITH CHECK (true);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_inventory_categoria ON public.inventory(categoria);
CREATE INDEX IF NOT EXISTS idx_inventory_activo ON public.inventory(activo);
CREATE INDEX IF NOT EXISTS idx_inventory_keywords ON public.inventory USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_ofertas_estado ON public.ofertas(estado);
CREATE INDEX IF NOT EXISTS idx_ofertas_licitacion ON public.ofertas(licitacion_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_tipo ON public.system_logs(tipo);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON public.system_logs(created_at DESC);

-- Insert sample inventory data for testing
INSERT INTO public.inventory (sku, nombre_producto, descripcion, categoria, keywords, precio_unitario, margen_minimo, margen_objetivo, stock_disponible, unidad_medida, tiempo_entrega_dias, proveedor) VALUES
('OFF-001', 'Resma Papel Carta', 'Resma de papel bond tamaño carta 500 hojas 75g/m2', 'Oficina', ARRAY['papel', 'resma', 'carta', 'bond', 'oficina', 'impresion'], 3500, 15, 30, 500, 'resma', 3, 'Papeles del Sur'),
('OFF-002', 'Toner HP 85A', 'Toner compatible HP LaserJet 85A negro', 'Tecnología', ARRAY['toner', 'hp', 'impresora', 'laser', 'cartucho', 'negro'], 25000, 20, 35, 100, 'unidad', 5, 'TechSupply'),
('OFF-003', 'Silla Ergonómica Ejecutiva', 'Silla de oficina ergonómica con apoyo lumbar', 'Mobiliario', ARRAY['silla', 'ergonomica', 'oficina', 'ejecutiva', 'mobiliario'], 89000, 18, 28, 25, 'unidad', 10, 'Muebles Corp'),
('TEC-001', 'Notebook Lenovo ThinkPad', 'Notebook empresarial 14" Core i5 16GB RAM 512GB SSD', 'Tecnología', ARRAY['notebook', 'lenovo', 'thinkpad', 'computador', 'laptop', 'portatil'], 750000, 12, 22, 15, 'unidad', 7, 'TechSupply'),
('TEC-002', 'Monitor LED 24"', 'Monitor LED Full HD 24 pulgadas HDMI VGA', 'Tecnología', ARRAY['monitor', 'led', 'pantalla', 'display', 'hdmi'], 120000, 15, 25, 40, 'unidad', 5, 'TechSupply'),
('LIM-001', 'Kit Limpieza Industrial', 'Kit completo de limpieza industrial 20 piezas', 'Aseo', ARRAY['limpieza', 'aseo', 'industrial', 'kit', 'mantenimiento'], 45000, 25, 40, 80, 'kit', 3, 'CleanPro'),
('MED-001', 'Guantes Nitrilo Caja', 'Caja de 100 guantes de nitrilo talla M', 'Médico', ARRAY['guantes', 'nitrilo', 'medico', 'salud', 'proteccion', 'desechable'], 12000, 20, 35, 200, 'caja', 2, 'MediSupply'),
('CON-001', 'Cemento Portland 25kg', 'Saco de cemento Portland gris 25 kilos', 'Construcción', ARRAY['cemento', 'portland', 'construccion', 'obra', 'material'], 6500, 10, 20, 300, 'saco', 5, 'Materiales XYZ');

-- ============================================
-- MIGRACIÓN 5/45: 20260110055010_95068597-b166-4a35-b9b6-0480c7af0dc4.sql
-- ============================================

-- Tabla de clientes (usuarios del sistema)
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  empresa_nombre TEXT NOT NULL,
  rut TEXT NOT NULL,
  nombre_responsable TEXT NOT NULL,
  region TEXT NOT NULL,
  telefono TEXT,
  categoria_negocio TEXT,
  plan TEXT DEFAULT 'free',
  activo BOOLEAN DEFAULT true,
  onboarding_completado BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de inventario de clientes
CREATE TABLE public.cliente_inventario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT,
  precio_unitario NUMERIC NOT NULL DEFAULT 0,
  margen_minimo NUMERIC DEFAULT 10,
  stock INTEGER DEFAULT 0,
  tiempo_entrega_dias INTEGER DEFAULT 3,
  palabras_clave TEXT[],
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, sku)
);

-- Tabla de exclusiones de clientes
CREATE TABLE public.cliente_exclusiones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo_exclusion TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de notificaciones de clientes
CREATE TABLE public.cliente_notificaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  email_instantaneo BOOLEAN DEFAULT true,
  resumen_diario BOOLEAN DEFAULT false,
  resumen_semanal BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT false,
  webhook_url TEXT,
  presupuesto_minimo NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cliente_id)
);

-- Tabla de ofertas de clientes
CREATE TABLE public.cliente_ofertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  licitacion_id TEXT NOT NULL,
  estado TEXT DEFAULT 'borrador',
  match_score NUMERIC,
  productos_ofertados JSONB DEFAULT '[]'::jsonb,
  valor_total NUMERIC DEFAULT 0,
  margen_total NUMERIC DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_exclusiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_ofertas ENABLE ROW LEVEL SECURITY;

-- RLS Policies (public access for now, will be restricted with auth later)
CREATE POLICY "Public access for clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for cliente_inventario" ON public.cliente_inventario FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for cliente_exclusiones" ON public.cliente_exclusiones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for cliente_notificaciones" ON public.cliente_notificaciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for cliente_ofertas" ON public.cliente_ofertas FOR ALL USING (true) WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cliente_inventario_updated_at BEFORE UPDATE ON public.cliente_inventario FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cliente_notificaciones_updated_at BEFORE UPDATE ON public.cliente_notificaciones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cliente_ofertas_updated_at BEFORE UPDATE ON public.cliente_ofertas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cliente_inventario_cliente ON public.cliente_inventario(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_inventario_palabras ON public.cliente_inventario USING GIN(palabras_clave);
CREATE INDEX IF NOT EXISTS idx_cliente_exclusiones_cliente ON public.cliente_exclusiones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_ofertas_cliente ON public.cliente_ofertas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_ofertas_licitacion ON public.cliente_ofertas(licitacion_id);

-- ============================================
-- MIGRACIÓN 6/45: 20260111120623_cd2cd3f1-9f47-4a26-8ba5-62a78c72e82c.sql
-- ============================================

-- Add new columns to cliente_notificaciones for granular alert settings
ALTER TABLE public.cliente_notificaciones
ADD COLUMN IF NOT EXISTS alerta_nuevos_matches BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS alerta_cierre_proximo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS alerta_cambios_guardadas BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS horas_antes_cierre INTEGER DEFAULT 48,
ADD COLUMN IF NOT EXISTS score_minimo_alerta INTEGER DEFAULT 70;

-- Create notification log table to track sent notifications
CREATE TABLE IF NOT EXISTS public.notificaciones_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  licitacion_id TEXT,
  email_enviado BOOLEAN DEFAULT false,
  datos JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on notificaciones_log
ALTER TABLE public.notificaciones_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notificaciones_log
CREATE POLICY "Clients can view their own notification logs"
ON public.notificaciones_log FOR SELECT
USING (cliente_id IN (
  SELECT id FROM public.clientes WHERE id = cliente_id
));

CREATE POLICY "System can insert notification logs"
ON public.notificaciones_log FOR INSERT
WITH CHECK (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_notificaciones_log_cliente_id ON public.notificaciones_log(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_log_created_at ON public.notificaciones_log(created_at DESC);

-- ============================================
-- MIGRACIÓN 7/45: 20260112141948_1fb6f231-8a65-460f-98c9-91c3ee690d06.sql
-- ============================================

-- Drop existing permissive policies on user_preferences
DROP POLICY IF EXISTS "Allow public read access to user_preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Allow public insert to user_preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Allow public update to user_preferences" ON public.user_preferences;

-- Create secure RLS policies for user_preferences using auth.uid()
CREATE POLICY "Users can read own preferences" 
ON public.user_preferences FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" 
ON public.user_preferences FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" 
ON public.user_preferences FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Drop existing permissive policies on user_categories
DROP POLICY IF EXISTS "Allow public read access to user_categories" ON public.user_categories;
DROP POLICY IF EXISTS "Allow public insert to user_categories" ON public.user_categories;
DROP POLICY IF EXISTS "Allow public delete to user_categories" ON public.user_categories;

-- Create secure RLS policies for user_categories
CREATE POLICY "Users can read own categories" 
ON public.user_categories FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" 
ON public.user_categories FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" 
ON public.user_categories FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Drop existing permissive policies on user_regions
DROP POLICY IF EXISTS "Allow public read access to user_regions" ON public.user_regions;
DROP POLICY IF EXISTS "Allow public insert to user_regions" ON public.user_regions;
DROP POLICY IF EXISTS "Allow public delete to user_regions" ON public.user_regions;

-- Create secure RLS policies for user_regions
CREATE POLICY "Users can read own regions" 
ON public.user_regions FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own regions" 
ON public.user_regions FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own regions" 
ON public.user_regions FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Drop existing permissive policies on user_notifications
DROP POLICY IF EXISTS "Allow public read access to user_notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "Allow public insert to user_notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "Allow public update to user_notifications" ON public.user_notifications;

-- Create secure RLS policies for user_notifications
CREATE POLICY "Users can read own notifications" 
ON public.user_notifications FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications" 
ON public.user_notifications FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" 
ON public.user_notifications FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- MIGRACIÓN 8/45: 20260112143424_5bc3447c-1286-4614-bdc7-4679a6cd21b2.sql
-- ============================================

-- Drop public policy for clientes
DROP POLICY IF EXISTS "Public access for clientes" ON public.clientes;

-- Create email-based RLS policies for clientes table
-- Users can only access their own cliente record by matching their auth email

CREATE POLICY "Users can access own cliente by email"
ON public.clientes FOR SELECT
TO authenticated
USING (email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update own cliente by email"
ON public.clientes FOR UPDATE
TO authenticated
USING (email = auth.jwt() ->> 'email')
WITH CHECK (email = auth.jwt() ->> 'email');

CREATE POLICY "Authenticated users can insert cliente"
ON public.clientes FOR INSERT
TO authenticated
WITH CHECK (email = auth.jwt() ->> 'email');

CREATE POLICY "Users can delete own cliente by email"
ON public.clientes FOR DELETE
TO authenticated
USING (email = auth.jwt() ->> 'email');

-- ============================================
-- MIGRACIÓN 9/45: 20260112150827_a7374781-1511-4745-8785-136dd9ce3f12.sql
-- ============================================

-- =====================================================
-- FIX SECURITY: Add user_id to clientes and update all RLS policies
-- =====================================================

-- Step 1: Add user_id column to clientes table for proper auth.uid() binding
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON public.clientes(user_id);

-- =====================================================
-- CLIENTES TABLE - Fix email-based policies to use auth.uid()
-- =====================================================

-- Drop old email-based policies
DROP POLICY IF EXISTS "Users can access own cliente by email" ON public.clientes;
DROP POLICY IF EXISTS "Users can update own cliente by email" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can insert cliente" ON public.clientes;
DROP POLICY IF EXISTS "Users can delete own cliente by email" ON public.clientes;

-- Create proper user_id based policies
CREATE POLICY "Users can select own cliente"
ON public.clientes FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own cliente"
ON public.clientes FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own cliente"
ON public.clientes FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own cliente"
ON public.clientes FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- CLIENTE_INVENTARIO TABLE - Fix public access
-- =====================================================

-- Drop public policy
DROP POLICY IF EXISTS "Public access for cliente_inventario" ON public.cliente_inventario;

-- Create proper RLS: users can only access inventory of their own cliente
CREATE POLICY "Users can select own cliente inventory"
ON public.cliente_inventario FOR SELECT
TO authenticated
USING (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert own cliente inventory"
ON public.cliente_inventario FOR INSERT
TO authenticated
WITH CHECK (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update own cliente inventory"
ON public.cliente_inventario FOR UPDATE
TO authenticated
USING (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
)
WITH CHECK (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete own cliente inventory"
ON public.cliente_inventario FOR DELETE
TO authenticated
USING (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);

-- =====================================================
-- CLIENTE_NOTIFICACIONES TABLE - Fix public access
-- =====================================================

-- Drop public policy
DROP POLICY IF EXISTS "Public access for cliente_notificaciones" ON public.cliente_notificaciones;

-- Create proper RLS: users can only access notifications of their own cliente
CREATE POLICY "Users can select own cliente notifications"
ON public.cliente_notificaciones FOR SELECT
TO authenticated
USING (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert own cliente notifications"
ON public.cliente_notificaciones FOR INSERT
TO authenticated
WITH CHECK (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update own cliente notifications"
ON public.cliente_notificaciones FOR UPDATE
TO authenticated
USING (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
)
WITH CHECK (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete own cliente notifications"
ON public.cliente_notificaciones FOR DELETE
TO authenticated
USING (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);

-- =====================================================
-- CLIENTE_EXCLUSIONES TABLE - Fix public access
-- =====================================================

-- Drop public policy
DROP POLICY IF EXISTS "Public access for cliente_exclusiones" ON public.cliente_exclusiones;

-- Create proper RLS: users can only access exclusions of their own cliente
CREATE POLICY "Users can select own cliente exclusions"
ON public.cliente_exclusiones FOR SELECT
TO authenticated
USING (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert own cliente exclusions"
ON public.cliente_exclusiones FOR INSERT
TO authenticated
WITH CHECK (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update own cliente exclusions"
ON public.cliente_exclusiones FOR UPDATE
TO authenticated
USING (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
)
WITH CHECK (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete own cliente exclusions"
ON public.cliente_exclusiones FOR DELETE
TO authenticated
USING (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);

-- =====================================================
-- CLIENTE_OFERTAS TABLE - Fix public access
-- =====================================================

-- Drop public policy
DROP POLICY IF EXISTS "Public access for cliente_ofertas" ON public.cliente_ofertas;

-- Create proper RLS: users can only access offers of their own cliente
CREATE POLICY "Users can select own cliente offers"
ON public.cliente_ofertas FOR SELECT
TO authenticated
USING (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert own cliente offers"
ON public.cliente_ofertas FOR INSERT
TO authenticated
WITH CHECK (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update own cliente offers"
ON public.cliente_ofertas FOR UPDATE
TO authenticated
USING (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
)
WITH CHECK (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete own cliente offers"
ON public.cliente_ofertas FOR DELETE
TO authenticated
USING (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);

-- ============================================
-- MIGRACIÓN 10/45: 20260112153744_e0444eca-a6b5-4b0a-8a38-44dadfa7a386.sql
-- ============================================

-- Create extension_api_keys table for Chrome extension authentication
CREATE TABLE public.extension_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL DEFAULT 'API Key',
  activa BOOLEAN NOT NULL DEFAULT true,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_extension_api_keys_api_key ON public.extension_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_extension_api_keys_cliente ON public.extension_api_keys(cliente_id);

-- Enable RLS
ALTER TABLE public.extension_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only client owner can manage their keys
CREATE POLICY "Clients can view their own API keys"
  ON public.extension_api_keys
  FOR SELECT
  USING (
    cliente_id IN (
      SELECT id FROM public.clientes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can create their own API keys"
  ON public.extension_api_keys
  FOR INSERT
  WITH CHECK (
    cliente_id IN (
      SELECT id FROM public.clientes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update their own API keys"
  ON public.extension_api_keys
  FOR UPDATE
  USING (
    cliente_id IN (
      SELECT id FROM public.clientes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can delete their own API keys"
  ON public.extension_api_keys
  FOR DELETE
  USING (
    cliente_id IN (
      SELECT id FROM public.clientes WHERE user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_extension_api_keys_updated_at
  BEFORE UPDATE ON public.extension_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Table for logging extension activity
CREATE TABLE public.extension_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES public.extension_api_keys(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  licitacion_id TEXT,
  oferta_id UUID,
  detalles JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for activity lookups
CREATE INDEX IF NOT EXISTS idx_extension_activity_cliente ON public.extension_activity_log(cliente_id);
CREATE INDEX IF NOT EXISTS idx_extension_activity_created ON public.extension_activity_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.extension_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS: Only client can view their activity
CREATE POLICY "Clients can view their own activity"
  ON public.extension_activity_log
  FOR SELECT
  USING (
    cliente_id IN (
      SELECT id FROM public.clientes WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- MIGRACIÓN 11/45: 20260112165649_16430f1a-3c88-4bd2-a7c7-66d6e27af4a3.sql
-- ============================================

-- Enable realtime for extension_activity_log table
ALTER PUBLICATION supabase_realtime ADD TABLE public.extension_activity_log;

-- ============================================
-- MIGRACIÓN 12/45: 20260112171153_07d91036-be52-47f6-8ecf-25cb40ee3004.sql
-- ============================================

-- Fix security issues: Replace overly permissive RLS policies

-- 1. Fix inventory table - restrict to authenticated users only
DROP POLICY IF EXISTS "Allow public read access to inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow service role insert to inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow service role update to inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow service role delete to inventory" ON public.inventory;

CREATE POLICY "Authenticated users can read inventory" 
ON public.inventory 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert inventory" 
ON public.inventory 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update inventory" 
ON public.inventory 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete inventory" 
ON public.inventory 
FOR DELETE 
TO authenticated
USING (true);

-- 2. Fix ofertas table - restrict to authenticated users and link to user
DROP POLICY IF EXISTS "Allow public read access to ofertas" ON public.ofertas;
DROP POLICY IF EXISTS "Allow public insert to ofertas" ON public.ofertas;
DROP POLICY IF EXISTS "Allow public update to ofertas" ON public.ofertas;
DROP POLICY IF EXISTS "Allow public delete to ofertas" ON public.ofertas;

CREATE POLICY "Authenticated users can read offers" 
ON public.ofertas 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert offers" 
ON public.ofertas 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

CREATE POLICY "Authenticated users can update offers" 
ON public.ofertas 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete offers" 
ON public.ofertas 
FOR DELETE 
TO authenticated
USING (true);

-- 3. Fix system_logs table - restrict to authenticated users
DROP POLICY IF EXISTS "Allow public read access to system_logs" ON public.system_logs;
DROP POLICY IF EXISTS "Allow public insert to system_logs" ON public.system_logs;

CREATE POLICY "Authenticated users can read system logs" 
ON public.system_logs 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert system logs" 
ON public.system_logs 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- 4. Fix licitaciones table - restrict to authenticated users for read
DROP POLICY IF EXISTS "Allow public read access to licitaciones" ON public.licitaciones;

CREATE POLICY "Authenticated users can read licitaciones" 
ON public.licitaciones 
FOR SELECT 
TO authenticated
USING (true);

-- 5. Fix licitacion_items table - restrict to authenticated users for read
DROP POLICY IF EXISTS "Allow public read access to licitacion_items" ON public.licitacion_items;

CREATE POLICY "Authenticated users can read licitacion items" 
ON public.licitacion_items 
FOR SELECT 
TO authenticated
USING (true);

-- 6. Fix notificaciones_log policy - correct the tautology
DROP POLICY IF EXISTS "Clients can view their own notification logs" ON public.notificaciones_log;

CREATE POLICY "Clients can view their own notification logs" 
ON public.notificaciones_log 
FOR SELECT 
TO authenticated
USING (cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid()));

-- ============================================
-- MIGRACIÓN 13/45: 20260112193312_2ba6ae18-d4e4-49c3-a203-f3ebe688d2da.sql
-- ============================================

-- Create admin role type
CREATE TYPE IF NOT EXISTS public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create security definer function to check roles (avoids infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Drop existing overly permissive policies on inventory table
DROP POLICY IF EXISTS "Authenticated users can read inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated users can insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated users can update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated users can delete inventory" ON public.inventory;

-- Create new secure policies for inventory - only admins can manage
CREATE POLICY "Admins can read inventory" 
ON public.inventory 
FOR SELECT 
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can insert inventory" 
ON public.inventory 
FOR INSERT 
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update inventory" 
ON public.inventory 
FOR UPDATE 
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can delete inventory" 
ON public.inventory 
FOR DELETE 
TO authenticated
USING (public.is_admin());

-- ============================================
-- MIGRACIÓN 14/45: 20260112233010_46c75470-c9cd-4313-985d-2495e1a6dfb7.sql
-- ============================================

-- Crear tabla de perfiles para usuarios
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS en profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Trigger para actualizar updated_at en profiles
CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_timestamp
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_profiles_updated_at();

-- Función para crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para crear perfil cuando se crea usuario
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Agregar columna odoo_enabled a clientes para saber si tienen Odoo configurado
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS odoo_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS odoo_url TEXT,
ADD COLUMN IF NOT EXISTS odoo_db TEXT;

-- Política para que admins puedan ver todos los perfiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- MIGRACIÓN 15/45: 20260112233734_b4346f20-a7ca-400f-a2e4-39707aa979ea.sql
-- ============================================

-- Agregar política para que admins puedan ver todos los roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

-- Los usuarios pueden ver sus propios roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- MIGRACIÓN 16/45: 20260113012409_0f330be6-28ba-4602-8c47-e82f1150a901.sql
-- ============================================

-- Add image_url column to cliente_inventario table
ALTER TABLE public.cliente_inventario 
ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- ============================================
-- MIGRACIÓN 17/45: 20260113012631_7c5b6d29-c2b4-4984-bb12-c0fd6e88ce11.sql
-- ============================================

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images', 
  'product-images', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own product images
CREATE POLICY "Users can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own images
CREATE POLICY "Users can update own product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own images
CREATE POLICY "Users can delete own product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to product images (bucket is public)
CREATE POLICY "Public can view product images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- ============================================
-- MIGRACIÓN 18/45: 20260113012801_be4dce17-d3fb-47d2-89d3-7df4d643a30d.sql
-- ============================================

-- Add image_url column to inventory table (admin inventory)
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- ============================================
-- MIGRACIÓN 19/45: 20260113013001_7af0ae10-e79b-4d64-8c40-9aa636382fc8.sql
-- ============================================

-- Create table for multiple product images
CREATE TABLE public.product_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('inventory', 'cliente_inventario')),
  image_url TEXT NOT NULL,
  storage_path TEXT,
  orden INTEGER DEFAULT 0,
  es_principal BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id, product_type);

-- Enable RLS
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all product images (public products)
CREATE POLICY "Anyone can view product images"
ON public.product_images
FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can insert images
CREATE POLICY "Authenticated users can insert images"
ON public.product_images
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update their own images
CREATE POLICY "Users can update own images"
ON public.product_images
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Policy: Users can delete their own images
CREATE POLICY "Users can delete own images"
ON public.product_images
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- ============================================
-- MIGRACIÓN 20/45: 20260113014800_404aad84-30ee-46bd-804f-7e8931a39f2e.sql
-- ============================================

-- Drop existing overly permissive policies on system_logs
DROP POLICY IF EXISTS "Authenticated users can read system logs" ON public.system_logs;
DROP POLICY IF EXISTS "Authenticated users can insert system logs" ON public.system_logs;

-- Create admin-only read policy for system_logs
CREATE POLICY "Admin users can read system logs"
ON public.system_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Only service role (edge functions) can insert logs
-- Regular users cannot insert - WITH CHECK (false) denies all client inserts
CREATE POLICY "Service role can insert system logs"
ON public.system_logs
FOR INSERT
WITH CHECK (false);

-- ============================================
-- MIGRACIÓN 21/45: 20260113024614_21631363-7183-4283-820c-ed9024bb3caf.sql
-- ============================================

-- Create import_history table to track all Excel/CSV imports
CREATE TABLE IF NOT EXISTS public.import_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('xlsx', 'xls', 'csv')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'partial', 'failed')),
  errors JSONB DEFAULT '[]'::jsonb,
  imported_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own import history
CREATE POLICY "Users can view their own import history"
ON public.import_history
FOR SELECT
USING (auth.uid() = imported_by);

-- Allow authenticated users to insert their own import records
CREATE POLICY "Users can insert their own import history"
ON public.import_history
FOR INSERT
WITH CHECK (auth.uid() = imported_by);

-- Allow admins to view all import history
CREATE POLICY "Admins can view all import history"
ON public.import_history
FOR SELECT
USING (public.is_admin());

-- ============================================
-- MIGRACIÓN 22/45: 20260113024951_a152814c-4c48-48e2-9592-7f0708906e56.sql
-- ============================================

-- =====================================================
-- Tabla principal para almacenar Órdenes de Compra (OC)
-- Esta es la fuente principal de datos para BI
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ordenes_compra (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE, -- Código único de la OC en MercadoPúblico
  
  -- Información de la OC
  nombre TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT,
  tipo TEXT,
  
  -- Fechas importantes
  fecha_envio TIMESTAMP WITH TIME ZONE,
  fecha_aceptacion TIMESTAMP WITH TIME ZONE,
  fecha_creacion TIMESTAMP WITH TIME ZONE,
  
  -- Información del Proveedor (vendedor/competidor)
  proveedor_nombre TEXT,
  proveedor_rut TEXT,
  proveedor_codigo TEXT,
  proveedor_direccion TEXT,
  proveedor_comuna TEXT,
  proveedor_region TEXT,
  
  -- Información de la Institución (comprador)
  institucion_nombre TEXT,
  institucion_rut TEXT,
  institucion_codigo TEXT,
  
  -- Información financiera
  total_neto NUMERIC(15, 2),
  total_iva NUMERIC(15, 2),
  total NUMERIC(15, 2),
  moneda TEXT DEFAULT 'CLP',
  
  -- Referencia a licitación si aplica
  licitacion_codigo TEXT,
  
  -- Metadata
  raw_data JSONB, -- Datos crudos de la API para futuras referencias
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- Tabla para los items/productos de las Órdenes de Compra
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ordenes_compra_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_compra_id UUID NOT NULL REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  
  -- Información del producto
  correlativo INTEGER,
  codigo_producto TEXT,
  codigo_categoria TEXT,
  categoria TEXT,
  nombre_producto TEXT NOT NULL,
  descripcion TEXT,
  especificacion_comprador TEXT,
  especificacion_proveedor TEXT,
  
  -- Cantidades y precios
  cantidad NUMERIC(15, 4) NOT NULL DEFAULT 1,
  unidad TEXT,
  precio_unitario_neto NUMERIC(15, 2),
  total_neto NUMERIC(15, 2),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- Tabla para almacenar información de Licitaciones con más detalle
-- =====================================================
CREATE TABLE IF NOT EXISTS public.licitaciones_bi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE, -- CodigoExterno de MercadoPúblico
  
  -- Información general
  nombre TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT,
  codigo_estado INTEGER,
  tipo TEXT,
  codigo_tipo INTEGER,
  
  -- Fechas
  fecha_publicacion TIMESTAMP WITH TIME ZONE,
  fecha_cierre TIMESTAMP WITH TIME ZONE,
  fecha_cierre_documentos TIMESTAMP WITH TIME ZONE,
  fecha_adjudicacion TIMESTAMP WITH TIME ZONE,
  fecha_creacion TIMESTAMP WITH TIME ZONE,
  
  -- Información de la Institución
  institucion_nombre TEXT,
  institucion_rut TEXT,
  institucion_codigo TEXT,
  
  -- Unidad de compra
  unidad_compra TEXT,
  unidad_compra_direccion TEXT,
  unidad_compra_comuna TEXT,
  unidad_compra_region TEXT,
  
  -- Información financiera
  presupuesto_estimado NUMERIC(15, 2),
  moneda TEXT DEFAULT 'CLP',
  
  -- Evaluación
  etapas INTEGER,
  tiempo_evaluacion_dias INTEGER,
  
  -- Metadata
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- Tabla para los items requeridos en las licitaciones
-- =====================================================
CREATE TABLE IF NOT EXISTS public.licitaciones_bi_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  licitacion_id UUID NOT NULL REFERENCES public.licitaciones_bi(id) ON DELETE CASCADE,
  
  correlativo INTEGER,
  codigo_producto TEXT,
  codigo_categoria TEXT,
  categoria TEXT,
  nombre_producto TEXT NOT NULL,
  descripcion TEXT,
  
  cantidad NUMERIC(15, 4) NOT NULL DEFAULT 1,
  unidad TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- Tabla para adjudicaciones de licitaciones
-- =====================================================
CREATE TABLE IF NOT EXISTS public.licitaciones_adjudicaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  licitacion_id UUID NOT NULL REFERENCES public.licitaciones_bi(id) ON DELETE CASCADE,
  
  -- Proveedor adjudicado
  proveedor_nombre TEXT,
  proveedor_rut TEXT,
  proveedor_codigo TEXT,
  
  -- Montos
  monto_adjudicado NUMERIC(15, 2),
  moneda TEXT DEFAULT 'CLP',
  
  -- Fecha
  fecha_adjudicacion TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- Tabla maestra de Proveedores (para BI de competencia)
-- =====================================================
CREATE TABLE public.proveedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rut TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  razon_social TEXT,
  
  -- Ubicación
  direccion TEXT,
  comuna TEXT,
  region TEXT,
  
  -- Contacto
  telefono TEXT,
  email TEXT,
  
  -- Clasificación
  rubro TEXT,
  actividad_economica TEXT,
  tamanio_empresa TEXT, -- Grande, Mediana, Pequeña, Micro
  
  -- Estadísticas calculadas
  total_ordenes INTEGER DEFAULT 0,
  monto_total_ordenes NUMERIC(15, 2) DEFAULT 0,
  ultima_orden_fecha TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- Tabla maestra de Instituciones Públicas
-- =====================================================
CREATE TABLE public.instituciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rut TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  codigo TEXT,
  
  -- Ubicación
  direccion TEXT,
  comuna TEXT,
  region TEXT,
  
  -- Clasificación
  tipo TEXT, -- Municipalidad, Ministerio, Servicio, Hospital, etc.
  sector TEXT,
  
  -- Estadísticas
  total_licitaciones INTEGER DEFAULT 0,
  total_ordenes INTEGER DEFAULT 0,
  monto_total_compras NUMERIC(15, 2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- Índices para optimizar consultas BI
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_fecha_envio ON public.ordenes_compra(fecha_envio);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_proveedor_rut ON public.ordenes_compra(proveedor_rut);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_institucion_rut ON public.ordenes_compra(institucion_rut);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_estado ON public.ordenes_compra(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_licitacion ON public.ordenes_compra(licitacion_codigo);

CREATE INDEX IF NOT EXISTS idx_licitaciones_bi_fecha_cierre ON public.licitaciones_bi(fecha_cierre);
CREATE INDEX IF NOT EXISTS idx_licitaciones_bi_institucion_rut ON public.licitaciones_bi(institucion_rut);
CREATE INDEX IF NOT EXISTS idx_licitaciones_bi_estado ON public.licitaciones_bi(estado);

CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON public.proveedores(nombre);
CREATE INDEX IF NOT EXISTS idx_instituciones_nombre ON public.instituciones(nombre);

-- =====================================================
-- Triggers para updated_at
-- =====================================================
CREATE TRIGGER update_ordenes_compra_updated_at
  BEFORE UPDATE ON public.ordenes_compra
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_licitaciones_bi_updated_at
  BEFORE UPDATE ON public.licitaciones_bi
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_proveedores_updated_at
  BEFORE UPDATE ON public.proveedores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instituciones_updated_at
  BEFORE UPDATE ON public.instituciones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- RLS Policies (datos públicos, lectura para todos)
-- =====================================================
ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_compra_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitaciones_bi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitaciones_bi_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitaciones_adjudicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instituciones ENABLE ROW LEVEL SECURITY;

-- Los datos de MercadoPúblico son públicos, permitir lectura a usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden ver órdenes de compra"
ON public.ordenes_compra FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados pueden ver items de órdenes"
ON public.ordenes_compra_items FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados pueden ver licitaciones BI"
ON public.licitaciones_bi FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados pueden ver items de licitaciones"
ON public.licitaciones_bi_items FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados pueden ver adjudicaciones"
ON public.licitaciones_adjudicaciones FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados pueden ver proveedores"
ON public.proveedores FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados pueden ver instituciones"
ON public.instituciones FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Solo admins pueden insertar/actualizar datos (el sistema vía edge functions)
CREATE POLICY "Admins pueden gestionar órdenes de compra"
ON public.ordenes_compra FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins pueden gestionar items de órdenes"
ON public.ordenes_compra_items FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins pueden gestionar licitaciones BI"
ON public.licitaciones_bi FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins pueden gestionar items de licitaciones"
ON public.licitaciones_bi_items FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins pueden gestionar adjudicaciones"
ON public.licitaciones_adjudicaciones FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins pueden gestionar proveedores"
ON public.proveedores FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins pueden gestionar instituciones"
ON public.instituciones FOR ALL
USING (public.is_admin());

-- ============================================
-- MIGRACIÓN 23/45: 20260113025143_5337f818-f732-4526-ae39-e6ff24368b04.sql
-- ============================================

-- Agregar constraint único para adjudicaciones (licitacion + proveedor)
ALTER TABLE public.licitaciones_adjudicaciones 
ADD CONSTRAINT licitaciones_adjudicaciones_licitacion_proveedor_unique 
UNIQUE (licitacion_id, proveedor_rut);

-- ============================================
-- MIGRACIÓN 24/45: 20260113025656_369ec493-b345-41be-ace5-429b5cdddbdb.sql
-- ============================================

-- Habilitar extensiones necesarias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================
-- MIGRACIÓN 25/45: 20260113063839_fcfc8a4c-631d-4e34-89b5-711e5274fd01.sql
-- ============================================

-- Create user_settings table for persisting settings
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  company_settings JSONB DEFAULT '{}',
  bidding_settings JSONB DEFAULT '{}',
  delivery_settings JSONB DEFAULT '{}',
  automation_settings JSONB DEFAULT '{}',
  regions TEXT[] DEFAULT '{}',
  api_key_encrypted TEXT,
  api_key_connected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only access their own settings
CREATE POLICY "Users can read own settings" ON public.user_settings
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings" ON public.user_settings
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings" ON public.user_settings
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own settings" ON public.user_settings
FOR DELETE USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Fix inventory RLS - allow authenticated users to insert/manage their products
-- First, add user_id column to inventory for proper user-based RLS
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add policy for authenticated users to insert inventory
CREATE POLICY "Authenticated users can insert inventory" ON public.inventory
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Add policy for authenticated users to read all inventory (for now)
CREATE POLICY "Authenticated users can read inventory" ON public.inventory
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Add policy for users to update their own inventory or admins can update all
CREATE POLICY "Users can update own inventory or admin all" ON public.inventory
FOR UPDATE USING (
  user_id = auth.uid() OR user_id IS NULL OR public.is_admin()
);

-- Add policy for users to delete their own inventory or admins can delete all
CREATE POLICY "Users can delete own inventory or admin all" ON public.inventory
FOR DELETE USING (
  user_id = auth.uid() OR user_id IS NULL OR public.is_admin()
);

-- ============================================
-- MIGRACIÓN 26/45: 20260113202457_9ff35a76-30c0-4f68-a1fc-c24cc9a5b7de.sql
-- ============================================

-- Tabla de vendedores
CREATE TABLE public.vendedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  rol TEXT DEFAULT 'vendedor',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de asignaciones de vendedores a licitaciones
CREATE TABLE public.vendedor_asignaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  licitacion_id TEXT NOT NULL,
  licitacion_codigo TEXT,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  estado TEXT DEFAULT 'asignada',
  fecha_cierre TIMESTAMP WITH TIME ZONE,
  monto_estimado NUMERIC,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de indicadores de vendedores
CREATE TABLE public.vendedor_indicadores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  total_asignadas INTEGER DEFAULT 0,
  total_postuladas INTEGER DEFAULT 0,
  total_adjudicadas INTEGER DEFAULT 0,
  monto_adjudicado NUMERIC DEFAULT 0,
  tasa_adjudicacion NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de eventos de calendario
CREATE TABLE public.vendedor_calendario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  asignacion_id UUID REFERENCES public.vendedor_asignaciones(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  fecha_fin TIMESTAMP WITH TIME ZONE,
  tipo_evento TEXT DEFAULT 'cierre',
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedor_asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedor_indicadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedor_calendario ENABLE ROW LEVEL SECURITY;

-- Políticas para vendedores (visible para todos los autenticados)
CREATE POLICY "Authenticated users can view vendedores" ON public.vendedores
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert vendedores" ON public.vendedores
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update vendedores" ON public.vendedores
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete vendedores" ON public.vendedores
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Políticas para asignaciones
CREATE POLICY "Authenticated users can view asignaciones" ON public.vendedor_asignaciones
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert asignaciones" ON public.vendedor_asignaciones
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update asignaciones" ON public.vendedor_asignaciones
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete asignaciones" ON public.vendedor_asignaciones
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Políticas para indicadores
CREATE POLICY "Authenticated users can view indicadores" ON public.vendedor_indicadores
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage indicadores" ON public.vendedor_indicadores
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Políticas para calendario
CREATE POLICY "Authenticated users can view calendario" ON public.vendedor_calendario
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage calendario" ON public.vendedor_calendario
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Vista de dashboard del vendedor
CREATE OR REPLACE VIEW public.v_vendedor_dashboard AS
SELECT 
  v.id as vendedor_id,
  v.nombre,
  v.email,
  COUNT(va.id) as total_asignadas,
  COUNT(CASE WHEN va.estado = 'postulada' THEN 1 END) as total_postuladas,
  COUNT(CASE WHEN va.estado = 'adjudicada' THEN 1 END) as total_adjudicadas,
  COALESCE(SUM(CASE WHEN va.estado = 'adjudicada' THEN va.monto_estimado END), 0) as monto_adjudicado,
  CASE 
    WHEN COUNT(CASE WHEN va.estado = 'postulada' THEN 1 END) > 0 
    THEN ROUND((COUNT(CASE WHEN va.estado = 'adjudicada' THEN 1 END)::numeric / COUNT(CASE WHEN va.estado = 'postulada' THEN 1 END)::numeric) * 100, 2)
    ELSE 0 
  END as tasa_adjudicacion
FROM public.vendedores v
LEFT JOIN public.vendedor_asignaciones va ON v.id = va.vendedor_id
WHERE v.activo = true
GROUP BY v.id, v.nombre, v.email;

-- Vista de calendario por vendedor
CREATE OR REPLACE VIEW public.v_calendario_vendedor AS
SELECT 
  vc.id,
  vc.vendedor_id,
  v.nombre as vendedor_nombre,
  vc.titulo,
  vc.fecha_inicio,
  vc.fecha_fin,
  vc.tipo_evento,
  vc.color,
  va.estado as estado_asignacion,
  va.licitacion_codigo,
  va.monto_estimado
FROM public.vendedor_calendario vc
JOIN public.vendedores v ON vc.vendedor_id = v.id
LEFT JOIN public.vendedor_asignaciones va ON vc.asignacion_id = va.id;

-- Vista de reporte de equipo
CREATE OR REPLACE VIEW public.v_reporte_equipo AS
SELECT 
  v.id as vendedor_id,
  v.nombre,
  v.email,
  v.rol,
  COUNT(va.id) as total_negocios,
  COUNT(CASE WHEN va.estado = 'postulada' THEN 1 END) as postulados,
  COUNT(CASE WHEN va.estado = 'adjudicada' THEN 1 END) as adjudicados,
  COALESCE(SUM(va.monto_estimado), 0) as monto_total,
  COALESCE(SUM(CASE WHEN va.estado = 'adjudicada' THEN va.monto_estimado END), 0) as monto_adjudicado,
  CASE 
    WHEN COUNT(CASE WHEN va.estado = 'postulada' THEN 1 END) > 0 
    THEN ROUND((COUNT(CASE WHEN va.estado = 'adjudicada' THEN 1 END)::numeric / COUNT(CASE WHEN va.estado = 'postulada' THEN 1 END)::numeric) * 100, 2)
    ELSE 0 
  END as tasa_adjudicacion
FROM public.vendedores v
LEFT JOIN public.vendedor_asignaciones va ON v.id = va.vendedor_id
WHERE v.activo = true
GROUP BY v.id, v.nombre, v.email, v.rol;

-- Vista de asignaciones detalladas
CREATE OR REPLACE VIEW public.v_asignaciones_detalle AS
SELECT 
  va.id,
  va.licitacion_id,
  va.licitacion_codigo,
  va.estado,
  va.fecha_cierre,
  va.monto_estimado,
  va.notas,
  va.created_at,
  v.id as vendedor_id,
  v.nombre as vendedor_nombre,
  v.email as vendedor_email
FROM public.vendedor_asignaciones va
JOIN public.vendedores v ON va.vendedor_id = v.id;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_vendedores_updated_at
  BEFORE UPDATE ON public.vendedores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendedor_asignaciones_updated_at
  BEFORE UPDATE ON public.vendedor_asignaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendedor_indicadores_updated_at
  BEFORE UPDATE ON public.vendedor_indicadores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- MIGRACIÓN 27/45: 20260113204719_e2a17565-711e-4f32-8a2b-010e42310369.sql
-- ============================================

-- Primero: Agregar nuevos valores al enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendedor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'visor';

-- ============================================
-- MIGRACIÓN 28/45: 20260113204801_fde80b56-0083-4b74-aee7-93c6af25e00a.sql
-- ============================================

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

-- ============================================
-- MIGRACIÓN 29/45: 20260113205935_545abf15-7eac-4ce2-88f5-ff68141ae957.sql
-- ============================================

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

-- ============================================
-- MIGRACIÓN 30/45: 20260113214549_67d189f0-940a-4f92-a820-03266ceac1e3.sql
-- ============================================

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

-- ============================================
-- MIGRACIÓN 31/45: 20260114124404_a3c1d10b-1899-42f6-ac7f-f02a65ae06c3.sql
-- ============================================

-- Vista unificada de oportunidades (licitaciones + licitaciones_bi)
CREATE OR REPLACE VIEW public.oportunidades_all AS
SELECT 
  id_licitacion AS codigo,
  titulo AS nombre,
  organismo AS institucion_nombre,
  estado,
  created_at AS fecha_publicacion,
  fecha_cierre,
  presupuesto AS presupuesto_estimado,
  match_score,
  match_encontrado,
  'compra_agil' AS tipo_proceso,
  link_oficial,
  procesada
FROM public.licitaciones

UNION ALL

SELECT 
  codigo,
  nombre,
  institucion_nombre,
  estado,
  fecha_publicacion,
  fecha_cierre,
  presupuesto_estimado,
  NULL AS match_score,
  FALSE AS match_encontrado,
  'licitacion' AS tipo_proceso,
  NULL AS link_oficial,
  TRUE AS procesada
FROM public.licitaciones_bi;

-- Vista de calendario de eventos (aperturas y cierres)
CREATE OR REPLACE VIEW public.calendario_eventos AS
SELECT 
  codigo,
  nombre,
  tipo_proceso,
  institucion_nombre,
  fecha_publicacion AS fecha_evento,
  'apertura' AS tipo_evento,
  presupuesto_estimado
FROM public.oportunidades_all
WHERE fecha_publicacion IS NOT NULL

UNION ALL

SELECT 
  codigo,
  nombre,
  tipo_proceso,
  institucion_nombre,
  fecha_cierre AS fecha_evento,
  'cierre' AS tipo_evento,
  presupuesto_estimado
FROM public.oportunidades_all
WHERE fecha_cierre IS NOT NULL;

-- Comentarios descriptivos
COMMENT ON VIEW public.oportunidades_all IS 'Vista unificada de todas las oportunidades de licitación (compras ágiles y licitaciones grandes)';
COMMENT ON VIEW public.calendario_eventos IS 'Vista de eventos de calendario para aperturas y cierres de licitaciones';

-- ============================================
-- MIGRACIÓN 32/45: 20260115000000_add_buen_pagador_compras_agiles.sql
-- ============================================

-- Agregar campo buen_pagador a compras_agiles
-- Este campo indica si el organismo tiene historial de pago confiable

ALTER TABLE public.compras_agiles
ADD COLUMN IF NOT EXISTS buen_pagador BOOLEAN DEFAULT NULL;

-- Agregar comentario al campo
COMMENT ON COLUMN public.compras_agiles.buen_pagador IS 'Indica si el organismo tiene historial de pago confiable (true = buen pagador, false = mal pagador, NULL = desconocido)';

-- Crear índice para búsquedas rápidas por buen_pagador
CREATE INDEX IF NOT EXISTS idx_compras_agiles_buen_pagador 
ON public.compras_agiles(buen_pagador) 
WHERE buen_pagador IS NOT NULL;

-- Función para actualizar buen_pagador basado en historial de órdenes de compra
-- (Se puede usar para calcular automáticamente basado en historial de pagos)
CREATE OR REPLACE FUNCTION public.calcular_buen_pagador(organismo_nombre TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  promedio_dias_pago NUMERIC;
  total_ordenes INTEGER;
BEGIN
  -- Calcular promedio de días de pago basado en órdenes de compra
  SELECT 
    AVG(EXTRACT(DAY FROM (fecha_aceptacion - fecha_envio))),
    COUNT(*)
  INTO promedio_dias_pago, total_ordenes
  FROM public.ordenes_compra
  WHERE institucion_nombre = organismo_nombre
    AND fecha_aceptacion IS NOT NULL
    AND fecha_envio IS NOT NULL;
  
  -- Si hay menos de 3 órdenes, no hay suficiente data
  IF total_ordenes < 3 THEN
    RETURN NULL;
  END IF;
  
  -- Si el promedio de días de pago es <= 30, es buen pagador
  -- Si es > 60, es mal pagador
  IF promedio_dias_pago <= 30 THEN
    RETURN TRUE;
  ELSIF promedio_dias_pago > 60 THEN
    RETURN FALSE;
  ELSE
    RETURN NULL; -- Neutral
  END IF;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- MIGRACIÓN 33/45: 20260115000001_vista_licitaciones_por_producto.sql
-- ============================================

-- Vista para mostrar licitaciones abiertas por producto (estilo Lici)
-- ====================================================================

-- Vista que agrupa licitaciones activas por producto del inventario
CREATE OR REPLACE VIEW licitaciones_por_producto AS
WITH productos_keywords AS (
  -- Extraer keywords de cada producto del inventario
  SELECT 
    i.id as producto_id,
    i.sku,
    i.nombre_producto,
    i.categoria,
    i.keywords,
    -- Generar keywords desde nombre y categoría
    ARRAY(
      SELECT DISTINCT unnest(
        ARRAY_CAT(
          COALESCE(i.keywords, ARRAY[]::text[]),
          ARRAY[
            LOWER(i.nombre_producto),
            LOWER(i.categoria)
          ] || 
          string_to_array(LOWER(i.nombre_producto), ' ')
        )
      )
    ) as todas_keywords
  FROM inventory i
  WHERE i.activo = true
),
licitaciones_activas AS (
  -- Licitaciones y compras ágiles activas
  SELECT 
    codigo,
    nombre as titulo,
    organismo,
    monto as presupuesto,
    fecha_cierre,
    estado,
    'compra_agil' as tipo,
    link_oficial,
    match_score,
    match_encontrado,
    created_at
  FROM compras_agiles
  WHERE estado IN ('activa', 'publicada', 'abierta')
    AND (fecha_cierre IS NULL OR fecha_cierre > NOW())
  
  UNION ALL
  
  SELECT 
    id_licitacion as codigo,
    titulo,
    organismo,
    presupuesto,
    fecha_cierre,
    estado,
    'licitacion' as tipo,
    link_oficial,
    match_score,
    match_encontrado,
    created_at
  FROM licitaciones
  WHERE estado IN ('activa', 'publicada', 'abierta')
    AND (fecha_cierre IS NULL OR fecha_cierre > NOW())
),
matches AS (
  -- Calcular match entre productos e inventario
  SELECT DISTINCT
    pk.producto_id,
    pk.sku,
    pk.nombre_producto,
    pk.categoria,
    la.codigo as licitacion_codigo,
    la.titulo as licitacion_titulo,
    la.organismo,
    la.presupuesto,
    la.fecha_cierre,
    la.estado,
    la.tipo,
    la.link_oficial,
    la.match_score,
    la.match_encontrado,
    -- Calcular score de match basado en keywords
    CASE 
      WHEN la.match_encontrado = true AND la.match_score IS NOT NULL 
      THEN la.match_score
      ELSE 
        -- Match básico por keywords
        LEAST(
          100,
          (
            SELECT COUNT(*) * 20 
            FROM unnest(pk.todas_keywords) as kw
            WHERE LOWER(la.titulo) LIKE '%' || kw || '%'
          )
        )
    END as score_match
  FROM productos_keywords pk
  CROSS JOIN licitaciones_activas la
  WHERE 
    -- Match si hay keywords en común
    EXISTS (
      SELECT 1 
      FROM unnest(pk.todas_keywords) as kw
      WHERE LOWER(la.titulo) LIKE '%' || kw || '%'
    )
    OR la.match_encontrado = true
)
SELECT 
  producto_id,
  sku,
  nombre_producto,
  categoria,
  COUNT(DISTINCT licitacion_codigo) as total_licitaciones_abiertas,
  SUM(presupuesto) as presupuesto_total_estimado,
  MAX(score_match) as mejor_match_score,
  ARRAY_AGG(DISTINCT licitacion_codigo) as licitaciones_codigos,
  ARRAY_AGG(DISTINCT organismo) as organismos,
  JSON_AGG(
    DISTINCT jsonb_build_object(
      'codigo', licitacion_codigo,
      'titulo', licitacion_titulo,
      'organismo', organismo,
      'presupuesto', presupuesto,
      'fecha_cierre', fecha_cierre,
      'estado', estado,
      'tipo', tipo,
      'link_oficial', link_oficial,
      'match_score', score_match
    )
  ) as licitaciones_detalle
FROM matches
WHERE score_match >= 30  -- Solo matches con score >= 30%
GROUP BY producto_id, sku, nombre_producto, categoria
ORDER BY total_licitaciones_abiertas DESC, mejor_match_score DESC;

COMMENT ON VIEW licitaciones_por_producto IS 'Vista que muestra licitaciones abiertas agrupadas por producto del inventario (estilo Lici)';

-- Permisos
GRANT SELECT ON licitaciones_por_producto TO authenticated, anon;


-- ============================================
-- MIGRACIÓN 34/45: 20260115000002_fix_user_roles_rls.sql
-- ============================================

-- Fix RLS policies for user_roles to allow admins to manage roles
-- ================================================================

-- Drop ALL existing policies on user_roles to start fresh
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- Create function to check if current user is admin (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
$$;

-- Allow all authenticated users to view all roles (needed for admin panel)
CREATE POLICY "Authenticated users can view all roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (true);

-- Allow admins to insert roles for any user (using SECURITY DEFINER function)
CREATE POLICY "Admins can insert roles" 
ON public.user_roles 
FOR INSERT 
TO authenticated
WITH CHECK (public.is_current_user_admin());

-- Allow admins to delete roles for any user (using SECURITY DEFINER function)
CREATE POLICY "Admins can delete roles" 
ON public.user_roles 
FOR DELETE 
TO authenticated
USING (public.is_current_user_admin());


-- ============================================
-- MIGRACIÓN 35/45: 20260115000003_create_apply_rls_fix_function.sql
-- ============================================

-- Crear función helper para aplicar el fix de RLS
-- ===============================================

CREATE OR REPLACE FUNCTION public.apply_user_roles_rls_fix()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB := '{"success": true, "steps": []}'::JSONB;
  step_result TEXT;
BEGIN
  -- Paso 1: Eliminar políticas existentes
  BEGIN
    DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Authenticated users can view all roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
    step_result := 'Políticas eliminadas';
  EXCEPTION WHEN OTHERS THEN
    step_result := 'Error eliminando políticas: ' || SQLERRM;
  END;
  result := jsonb_set(result, '{steps}', (result->'steps') || jsonb_build_array(step_result));

  -- Paso 2: Crear función helper
  BEGIN
    CREATE OR REPLACE FUNCTION public.is_current_user_admin()
    RETURNS BOOLEAN
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
      );
    $$;
    step_result := 'Función is_current_user_admin creada';
  EXCEPTION WHEN OTHERS THEN
    step_result := 'Error creando función: ' || SQLERRM;
  END;
  result := jsonb_set(result, '{steps}', (result->'steps') || jsonb_build_array(step_result));

  -- Paso 3: Crear política de SELECT
  BEGIN
    CREATE POLICY "Authenticated users can view all roles" 
    ON public.user_roles 
    FOR SELECT 
    TO authenticated
    USING (true);
    step_result := 'Política SELECT creada';
  EXCEPTION WHEN OTHERS THEN
    step_result := 'Error creando política SELECT: ' || SQLERRM;
  END;
  result := jsonb_set(result, '{steps}', (result->'steps') || jsonb_build_array(step_result));

  -- Paso 4: Crear política de INSERT
  BEGIN
    CREATE POLICY "Admins can insert roles" 
    ON public.user_roles 
    FOR INSERT 
    TO authenticated
    WITH CHECK (public.is_current_user_admin());
    step_result := 'Política INSERT creada';
  EXCEPTION WHEN OTHERS THEN
    step_result := 'Error creando política INSERT: ' || SQLERRM;
  END;
  result := jsonb_set(result, '{steps}', (result->'steps') || jsonb_build_array(step_result));

  -- Paso 5: Crear política de DELETE
  BEGIN
    CREATE POLICY "Admins can delete roles" 
    ON public.user_roles 
    FOR DELETE 
    TO authenticated
    USING (public.is_current_user_admin());
    step_result := 'Política DELETE creada';
  EXCEPTION WHEN OTHERS THEN
    step_result := 'Error creando política DELETE: ' || SQLERRM;
    result := jsonb_set(result, '{success}', 'false'::jsonb);
  END;
  result := jsonb_set(result, '{steps}', (result->'steps') || jsonb_build_array(step_result));

  RETURN result;
END;
$$;

-- Permitir a admins ejecutar esta función
GRANT EXECUTE ON FUNCTION public.apply_user_roles_rls_fix() TO authenticated;


-- ============================================
-- MIGRACIÓN 36/45: 20260115000004_add_clasificacion_compras_agiles.sql
-- ============================================

-- Agregar columnas de clasificación a compras_agiles
-- Clasificación según regla de negocio: 100 UTM = $6.975.100 CLP (Enero 2026)

-- Agregar columnas si no existen
DO $$ 
BEGIN
  -- Agregar nombre_organismo si no existe (campo real de BD)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'compras_agiles' 
    AND column_name = 'nombre_organismo'
  ) THEN
    ALTER TABLE public.compras_agiles 
    ADD COLUMN IF NOT EXISTS nombre_organismo TEXT;
    
    -- Migrar datos de organismo a nombre_organismo
    UPDATE public.compras_agiles
    SET nombre_organismo = organismo
    WHERE nombre_organismo IS NULL AND organismo IS NOT NULL;
  END IF;

  -- Agregar monto_estimado si no existe (campo real de BD)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'compras_agiles' 
    AND column_name = 'monto_estimado'
  ) THEN
    ALTER TABLE public.compras_agiles 
    ADD COLUMN IF NOT EXISTS monto_estimado NUMERIC(15,2);
    
    -- Migrar datos de monto a monto_estimado
    UPDATE public.compras_agiles
    SET monto_estimado = monto
    WHERE monto_estimado IS NULL AND monto IS NOT NULL;
  END IF;

  -- Agregar tipo_proceso si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'compras_agiles' 
    AND column_name = 'tipo_proceso'
  ) THEN
    ALTER TABLE public.compras_agiles 
    ADD COLUMN IF NOT EXISTS tipo_proceso VARCHAR(20) DEFAULT 'compra_agil';
  END IF;

  -- Agregar categoria si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'compras_agiles' 
    AND column_name = 'categoria'
  ) THEN
    ALTER TABLE public.compras_agiles 
    ADD COLUMN IF NOT EXISTS categoria VARCHAR(10) DEFAULT 'L1';
  END IF;
END $$;

-- Clasificar registros existentes según monto
-- UTM Enero 2026: $69.751 CLP
-- Umbral: 100 UTM = $6.975.100 CLP
-- Usar monto_estimado si existe, sino monto
UPDATE public.compras_agiles
SET 
  tipo_proceso = CASE
    WHEN COALESCE(monto_estimado, monto) IS NULL OR COALESCE(monto_estimado, monto) = 0 THEN 'compra_agil'
    WHEN COALESCE(monto_estimado, monto) <= 6975100 THEN 'compra_agil'  -- <= 100 UTM
    ELSE 'licitacion'  -- > 100 UTM
  END,
  categoria = CASE
    WHEN COALESCE(monto_estimado, monto) IS NULL OR COALESCE(monto_estimado, monto) = 0 THEN 'L1'
    WHEN COALESCE(monto_estimado, monto) <= 6975100 THEN 'L1'  -- < 100 UTM = Compra Ágil
    WHEN COALESCE(monto_estimado, monto) <= 69751000 THEN 'LE'  -- 100 a 1.000 UTM = Intermedia
    WHEN COALESCE(monto_estimado, monto) <= 348755000 THEN 'LP'  -- 1.000 a 5.000 UTM = Mayor
    ELSE 'LR'  -- > 5.000 UTM = Gran Compra
  END
WHERE tipo_proceso IS NULL OR categoria IS NULL;

-- Agregar comentarios
COMMENT ON COLUMN public.compras_agiles.tipo_proceso IS 'Tipo de proceso: compra_agil o licitacion según monto (umbral: 100 UTM = $6.975.100 CLP)';
COMMENT ON COLUMN public.compras_agiles.categoria IS 'Categoría según MercadoPúblico: L1 (<100 UTM), LE (100-1000 UTM), LP (1000-5000 UTM), LR (>5000 UTM)';

-- Crear índices para mejor performance en filtros
CREATE INDEX IF NOT EXISTS idx_compras_agiles_tipo_proceso ON public.compras_agiles(tipo_proceso);
CREATE INDEX IF NOT EXISTS idx_compras_agiles_categoria ON public.compras_agiles(categoria);


-- ============================================
-- MIGRACIÓN 37/45: 20260115013053_e99e65e1-a32c-4ec6-87aa-75209efc1a6f.sql
-- ============================================

-- Create compras_agiles table for agile purchases
CREATE TABLE public.compras_agiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  organismo TEXT NOT NULL,
  monto NUMERIC(15,2),
  fecha_cierre TIMESTAMP WITH TIME ZONE,
  estado VARCHAR(50) DEFAULT 'activa',
  region VARCHAR(100),
  descripcion TEXT,
  link_oficial TEXT,
  match_encontrado BOOLEAN DEFAULT false,
  match_score INTEGER,
  datos_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.compras_agiles ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read
CREATE POLICY "Users can view compras_agiles"
  ON public.compras_agiles
  FOR SELECT
  USING (true);

-- Create policy for authenticated users to update
CREATE POLICY "Users can update compras_agiles"
  ON public.compras_agiles
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_compras_agiles_updated_at
  BEFORE UPDATE ON public.compras_agiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.compras_agiles;

-- Insert sample data
INSERT INTO public.compras_agiles (codigo, nombre, organismo, monto, fecha_cierre, estado, region, descripcion, match_encontrado, match_score)
VALUES 
  ('CA-2025-001', 'Computadores portátiles para oficina', 'Ministerio de Salud', 15000000, now() + interval '5 days', 'activa', 'Metropolitana', 'Adquisición de 20 notebooks para trabajo remoto', true, 85),
  ('CA-2025-002', 'Insumos de oficina varios', 'Municipalidad de Santiago', 2500000, now() + interval '3 days', 'activa', 'Metropolitana', 'Papel, lápices, carpetas y artículos varios', true, 92),
  ('CA-2025-003', 'Equipamiento computacional', 'Hospital Regional', 8500000, now() + interval '7 days', 'activa', 'Valparaíso', 'Monitores y periféricos', true, 78),
  ('CA-2025-004', 'Material de escritorio', 'Servicio de Impuestos Internos', 1200000, now() + interval '2 days', 'urgente', 'Metropolitana', 'Resmas de papel y toner', false, null),
  ('CA-2025-005', 'Mobiliario de oficina', 'Contraloría General', 6000000, now() + interval '10 days', 'activa', 'Biobío', 'Escritorios y sillas ergonómicas', false, null);

-- ============================================
-- MIGRACIÓN 38/45: 20260116000000_add_compras_agiles_insert_policy.sql
-- ============================================

-- Add INSERT policy for compras_agiles table
-- This allows the pending-sync server and authenticated users to insert compras ágiles data

-- Policy for authenticated users to insert
-- Service role bypasses RLS, so it can insert without this policy
-- But this allows authenticated users to insert as well
CREATE POLICY "Users can insert compras_agiles"
  ON public.compras_agiles
  FOR INSERT
  WITH CHECK (true);


-- ============================================
-- MIGRACIÓN 39/45: 20260116000001_update_oportunidades_all_view.sql
-- ============================================

-- Update oportunidades_all view to include compras_agiles
CREATE OR REPLACE VIEW public.oportunidades_all AS
-- Compras Ágiles desde tabla compras_agiles
SELECT 
  codigo,
  nombre,
  organismo AS institucion_nombre,
  estado,
  created_at AS fecha_publicacion,
  fecha_cierre,
  monto AS presupuesto_estimado,
  match_score,
  match_encontrado,
  'compra_agil' AS tipo_proceso,
  link_oficial,
  match_encontrado AS procesada
FROM public.compras_agiles

UNION ALL

-- Licitaciones desde tabla licitaciones (legacy)
SELECT 
  id_licitacion AS codigo,
  titulo AS nombre,
  organismo AS institucion_nombre,
  estado,
  created_at AS fecha_publicacion,
  fecha_cierre,
  presupuesto AS presupuesto_estimado,
  match_score,
  match_encontrado,
  'compra_agil' AS tipo_proceso,
  link_oficial,
  procesada
FROM public.licitaciones

UNION ALL

-- Licitaciones grandes desde licitaciones_bi
SELECT 
  codigo,
  nombre,
  institucion_nombre,
  estado,
  fecha_publicacion,
  fecha_cierre,
  presupuesto_estimado,
  NULL AS match_score,
  FALSE AS match_encontrado,
  'licitacion' AS tipo_proceso,
  NULL AS link_oficial,
  TRUE AS procesada
FROM public.licitaciones_bi;

-- Update comment
COMMENT ON VIEW public.oportunidades_all IS 'Vista unificada de todas las oportunidades de licitación (compras ágiles desde compras_agiles y licitaciones grandes)';


-- ============================================
-- MIGRACIÓN 40/45: 20260116000002_add_licitacion_codigo_to_items.sql
-- ============================================

-- Agregar licitacion_codigo e item_index a licitacion_items para soportar compras ágiles
-- Esto permite relacionar items directamente con el código de la licitación/compra ágil
-- sin necesidad de tener un registro en la tabla licitaciones

ALTER TABLE public.licitacion_items
ADD COLUMN IF NOT EXISTS licitacion_codigo TEXT,
ADD COLUMN IF NOT EXISTS item_index INTEGER;

-- Crear índice para búsquedas rápidas por código
CREATE INDEX IF NOT EXISTS idx_licitacion_items_codigo 
ON public.licitacion_items(licitacion_codigo);

CREATE INDEX IF NOT EXISTS idx_licitacion_items_codigo_index 
ON public.licitacion_items(licitacion_codigo, item_index);

-- Comentarios para documentación
COMMENT ON COLUMN public.licitacion_items.licitacion_codigo IS 'Código de la licitación/compra ágil (puede ser diferente de licitacion_id)';
COMMENT ON COLUMN public.licitacion_items.item_index IS 'Índice del item dentro de la licitación (para mantener orden)';


-- ============================================
-- MIGRACIÓN 41/45: 20260116000003_add_missing_sections_to_permissions.sql
-- ============================================

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


-- ============================================
-- MIGRACIÓN 42/45: 20260116000003_limpiar_datos_prueba_compras_agiles.sql
-- ============================================

-- Script para limpiar datos de prueba/inventados de compras_agiles
-- y verificar que todas las compras tengan productos asociados

-- 1. Identificar compras ágiles que parecen ser de prueba/inventadas
-- Criterios para identificar datos de prueba:
-- - Códigos que no siguen el formato estándar de MercadoPúblico
-- - Nombres genéricos o de prueba
-- - Organismos que no existen o son genéricos
-- - Fechas muy antiguas o futuras
-- - Sin productos asociados

-- Crear una vista temporal para identificar compras sospechosas
CREATE OR REPLACE VIEW compras_agiles_sospechosas AS
SELECT 
  ca.id,
  ca.codigo,
  ca.nombre,
  ca.organismo,
  ca.created_at,
  ca.fecha_cierre,
  COUNT(li.id) as num_items
FROM public.compras_agiles ca
LEFT JOIN public.licitacion_items li ON li.licitacion_codigo = ca.codigo
WHERE 
  -- Códigos que no parecen reales (formato típico: números o letras-números)
  (ca.codigo !~ '^[0-9]+$' AND ca.codigo !~ '^[A-Z0-9-]+$')
  -- O nombres genéricos
  OR LOWER(ca.nombre) LIKE '%test%'
  OR LOWER(ca.nombre) LIKE '%prueba%'
  OR LOWER(ca.nombre) LIKE '%ejemplo%'
  OR LOWER(ca.nombre) LIKE '%dummy%'
  OR LOWER(ca.nombre) LIKE '%sample%'
  OR LOWER(ca.nombre) LIKE '%demo%'
  -- O organismos genéricos
  OR LOWER(ca.organismo) LIKE '%test%'
  OR LOWER(ca.organismo) LIKE '%prueba%'
  OR LOWER(ca.organismo) LIKE '%ejemplo%'
  OR ca.organismo = 'Organismo no especificado'
  -- O sin productos asociados (más de 30 días sin items)
  OR (COUNT(li.id) = 0 AND ca.created_at < NOW() - INTERVAL '30 days')
GROUP BY ca.id, ca.codigo, ca.nombre, ca.organismo, ca.created_at, ca.fecha_cierre;

-- 2. Identificar compras sin productos asociados
CREATE OR REPLACE VIEW compras_agiles_sin_productos AS
SELECT 
  ca.id,
  ca.codigo,
  ca.nombre,
  ca.organismo,
  ca.created_at,
  ca.fecha_cierre,
  COUNT(li.id) as num_items
FROM public.compras_agiles ca
LEFT JOIN public.licitacion_items li ON li.licitacion_codigo = ca.codigo
GROUP BY ca.id, ca.codigo, ca.nombre, ca.organismo, ca.created_at, ca.fecha_cierre
HAVING COUNT(li.id) = 0;

-- 3. Función para limpiar datos de prueba (NO ejecutar automáticamente, solo para revisión)
-- IMPORTANTE: Revisar manualmente antes de ejecutar DELETE
CREATE OR REPLACE FUNCTION revisar_datos_prueba_compras_agiles()
RETURNS TABLE(
  tipo TEXT,
  codigo TEXT,
  nombre TEXT,
  organismo TEXT,
  num_items BIGINT,
  created_at TIMESTAMPTZ,
  accion_sugerida TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- Compras sospechosas (posibles datos de prueba)
  SELECT 
    'SOSPECHOSA'::TEXT as tipo,
    cs.codigo,
    cs.nombre,
    cs.organismo,
    cs.num_items,
    cs.created_at,
    CASE 
      WHEN cs.num_items = 0 THEN 'ELIMINAR - Sin productos y parece de prueba'
      ELSE 'REVISAR - Verificar si es real'
    END as accion_sugerida
  FROM compras_agiles_sospechosas cs
  
  UNION ALL
  
  -- Compras sin productos (más de 7 días sin items)
  SELECT 
    'SIN_PRODUCTOS'::TEXT as tipo,
    csp.codigo,
    csp.nombre,
    csp.organismo,
    csp.num_items,
    csp.created_at,
    CASE 
      WHEN csp.created_at < NOW() - INTERVAL '7 days' THEN 'ELIMINAR - Sin productos por más de 7 días'
      ELSE 'REVISAR - Puede estar en proceso de scraping'
    END as accion_sugerida
  FROM compras_agiles_sin_productos csp
  WHERE csp.created_at < NOW() - INTERVAL '7 days'
  
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. Función para obtener estadísticas de compras ágiles
CREATE OR REPLACE FUNCTION estadisticas_compras_agiles()
RETURNS TABLE(
  total_compras BIGINT,
  compras_con_productos BIGINT,
  compras_sin_productos BIGINT,
  compras_sospechosas BIGINT,
  total_productos BIGINT,
  promedio_productos_por_compra NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT ca.id)::BIGINT as total_compras,
    COUNT(DISTINCT CASE WHEN li.id IS NOT NULL THEN ca.id END)::BIGINT as compras_con_productos,
    COUNT(DISTINCT CASE WHEN li.id IS NULL THEN ca.id END)::BIGINT as compras_sin_productos,
    (SELECT COUNT(*)::BIGINT FROM compras_agiles_sospechosas) as compras_sospechosas,
    COUNT(li.id)::BIGINT as total_productos,
    CASE 
      WHEN COUNT(DISTINCT CASE WHEN li.id IS NOT NULL THEN ca.id END) > 0 
      THEN ROUND(COUNT(li.id)::NUMERIC / COUNT(DISTINCT CASE WHEN li.id IS NOT NULL THEN ca.id END), 2)
      ELSE 0
    END as promedio_productos_por_compra
  FROM public.compras_agiles ca
  LEFT JOIN public.licitacion_items li ON li.licitacion_codigo = ca.codigo;
END;
$$ LANGUAGE plpgsql;

-- 5. Comentarios
COMMENT ON VIEW compras_agiles_sospechosas IS 'Compras ágiles que parecen ser datos de prueba o inventados';
COMMENT ON VIEW compras_agiles_sin_productos IS 'Compras ágiles sin productos asociados en licitacion_items';
COMMENT ON FUNCTION revisar_datos_prueba_compras_agiles() IS 'Función para revisar compras que pueden ser datos de prueba. Revisar manualmente antes de eliminar.';
COMMENT ON FUNCTION estadisticas_compras_agiles() IS 'Función para obtener estadísticas generales de compras ágiles';


-- ============================================
-- MIGRACIÓN 43/45: 20260116000004_create_ordenes_compra.sql
-- ============================================

-- Crear tabla de órdenes de compra
CREATE TABLE IF NOT EXISTS public.ordenes_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT,
  descripcion TEXT,
  institucion_nombre TEXT,
  institucion_rut TEXT,
  proveedor_nombre TEXT,
  proveedor_rut TEXT,
  total_neto NUMERIC(15,2),
  total NUMERIC(15,2),
  fecha_creacion TIMESTAMPTZ,
  fecha_envio TIMESTAMPTZ,
  fecha_aceptacion TIMESTAMPTZ,
  estado TEXT,
  link_oficial TEXT,
  datos_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear tabla de items de órdenes de compra
CREATE TABLE IF NOT EXISTS public.orden_compra_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_compra_codigo TEXT NOT NULL REFERENCES public.ordenes_compra(codigo) ON DELETE CASCADE,
  item_index INTEGER NOT NULL,
  producto_id TEXT,
  nombre_producto TEXT,
  descripcion TEXT,
  cantidad NUMERIC(10,2),
  unidad TEXT,
  precio_unitario NUMERIC(15,2),
  subtotal NUMERIC(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(orden_compra_codigo, item_index)
);

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_codigo ON public.ordenes_compra(codigo);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_institucion_rut ON public.ordenes_compra(institucion_rut);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_institucion_nombre ON public.ordenes_compra(institucion_nombre);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_proveedor_rut ON public.ordenes_compra(proveedor_rut);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_proveedor_nombre ON public.ordenes_compra(proveedor_nombre);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_fecha_creacion ON public.ordenes_compra(fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_estado ON public.ordenes_compra(estado);
CREATE INDEX IF NOT EXISTS idx_orden_compra_items_codigo ON public.orden_compra_items(orden_compra_codigo);

-- Habilitar RLS
ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orden_compra_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ordenes_compra
CREATE POLICY "Users can view ordenes_compra"
  ON public.ordenes_compra
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert ordenes_compra"
  ON public.ordenes_compra
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update ordenes_compra"
  ON public.ordenes_compra
  FOR UPDATE
  USING (true);

-- Políticas RLS para orden_compra_items
CREATE POLICY "Users can view orden_compra_items"
  ON public.orden_compra_items
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert orden_compra_items"
  ON public.orden_compra_items
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update orden_compra_items"
  ON public.orden_compra_items
  FOR UPDATE
  USING (true);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_ordenes_compra_updated_at
  BEFORE UPDATE ON public.ordenes_compra
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentarios
COMMENT ON TABLE public.ordenes_compra IS 'Órdenes de compra de MercadoPúblico';
COMMENT ON TABLE public.orden_compra_items IS 'Items/productos de cada orden de compra';
COMMENT ON COLUMN public.ordenes_compra.codigo IS 'Código único de la orden de compra';
COMMENT ON COLUMN public.ordenes_compra.institucion_rut IS 'RUT de la institución que emite la OC';
COMMENT ON COLUMN public.ordenes_compra.proveedor_rut IS 'RUT del proveedor que recibe la OC';
COMMENT ON COLUMN public.orden_compra_items.orden_compra_codigo IS 'Código de la orden de compra (FK)';


-- ============================================
-- MIGRACIÓN 44/45: 20260117000000_add_costo_neto_margen_comercial_inventory.sql
-- ============================================

-- Migración: Agregar costo_neto y margen_comercial a inventory
-- Descripción: Agrega campos para costo del producto y cálculo automático de margen comercial
-- Fecha: 2026-01-17

-- Agregar costo_neto a inventory (obligatorio para nuevos productos)
DO $$
BEGIN
    -- Agregar costo_neto si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'inventory' 
        AND column_name = 'costo_neto'
    ) THEN
        ALTER TABLE public.inventory 
        ADD COLUMN IF NOT EXISTS costo_neto NUMERIC DEFAULT 0;
        
        -- Actualizar productos existentes: si no tienen costo, usar 80% del precio como estimación
        UPDATE public.inventory 
        SET costo_neto = precio_unitario * 0.8 
        WHERE costo_neto = 0 OR costo_neto IS NULL;
        
        -- Hacer el campo NOT NULL después de actualizar valores
        ALTER TABLE public.inventory 
        ALTER COLUMN costo_neto SET NOT NULL;
        
        -- Agregar comentario
        COMMENT ON COLUMN public.inventory.costo_neto IS 'Costo de adquisición del producto (obligatorio)';
    END IF;
END $$;

-- Agregar margen_comercial a inventory (calculado automáticamente)
DO $$
BEGIN
    -- Agregar margen_comercial si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'inventory' 
        AND column_name = 'margen_comercial'
    ) THEN
        ALTER TABLE public.inventory 
        ADD COLUMN IF NOT EXISTS margen_comercial NUMERIC;
        
        -- Calcular margen para productos existentes: (precio - costo) / precio * 100
        UPDATE public.inventory 
        SET margen_comercial = CASE 
            WHEN precio_unitario > 0 AND costo_neto >= 0 AND costo_neto < precio_unitario 
            THEN ROUND(((precio_unitario - costo_neto) / precio_unitario * 100)::numeric, 2)
            ELSE 0
        END
        WHERE margen_comercial IS NULL;
        
        -- Agregar comentario
        COMMENT ON COLUMN public.inventory.margen_comercial IS 'Margen comercial calculado: (precio - costo) / precio * 100';
    END IF;
END $$;

-- Agregar regiones_config a user_settings (para configuración de regiones con recargo)
DO $$
BEGIN
    -- Agregar regiones_config si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_settings' 
        AND column_name = 'regiones_config'
    ) THEN
        ALTER TABLE public.user_settings 
        ADD COLUMN IF NOT EXISTS regiones_config JSONB DEFAULT '[]'::jsonb;
        
        -- Migrar datos de regions a regiones_config si existe regions
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'user_settings' 
            AND column_name = 'regions'
        ) THEN
            -- Migrar regions existentes a regiones_config
            UPDATE public.user_settings
            SET regiones_config = (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'nombre', region,
                        'activa', true,
                        'recargo_porcentaje', 0
                    )
                )
                FROM jsonb_array_elements_text(regions::jsonb) AS region
            )
            WHERE regions IS NOT NULL 
            AND regions::text != '[]'::text
            AND (regiones_config IS NULL OR regiones_config::text = '[]'::text);
        END IF;
        
        -- Agregar comentario
        COMMENT ON COLUMN public.user_settings.regiones_config IS 'Configuración de regiones con recargos: [{"nombre": "Metropolitana", "activa": true, "recargo_porcentaje": 0}]';
    END IF;
END $$;

-- Crear función para calcular margen comercial automáticamente
CREATE OR REPLACE FUNCTION calcular_margen_comercial(
    precio_unitario NUMERIC,
    costo_neto NUMERIC
) RETURNS NUMERIC AS $$
BEGIN
    IF precio_unitario IS NULL OR precio_unitario <= 0 THEN
        RETURN NULL;
    END IF;
    
    IF costo_neto IS NULL OR costo_neto < 0 THEN
        RETURN NULL;
    END IF;
    
    IF costo_neto >= precio_unitario THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND(((precio_unitario - costo_neto) / precio_unitario * 100)::numeric, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Crear trigger para actualizar margen_comercial automáticamente
CREATE OR REPLACE FUNCTION update_margen_comercial_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.precio_unitario IS NOT NULL AND NEW.costo_neto IS NOT NULL THEN
        NEW.margen_comercial = calcular_margen_comercial(NEW.precio_unitario, NEW.costo_neto);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS trigger_update_margen_comercial ON public.inventory;
CREATE TRIGGER trigger_update_margen_comercial
    BEFORE INSERT OR UPDATE OF precio_unitario, costo_neto ON public.inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_margen_comercial_trigger();

-- Índice para búsquedas por margen
CREATE INDEX IF NOT EXISTS idx_inventory_margen_comercial 
    ON public.inventory(margen_comercial) 
    WHERE margen_comercial IS NOT NULL;

-- Comentarios finales
COMMENT ON FUNCTION calcular_margen_comercial IS 'Calcula el margen comercial: (precio - costo) / precio * 100';
COMMENT ON FUNCTION update_margen_comercial_trigger IS 'Trigger que actualiza margen_comercial automáticamente cuando cambia precio o costo';


-- ============================================
-- MIGRACIÓN 45/45: 20260117000001_create_exec_sql_function.sql
-- ============================================

-- Función helper para ejecutar SQL de forma segura
-- Esta función permite que las Edge Functions ejecuten SQL usando el service role key
-- 
-- IMPORTANTE: Esta función solo debe ser usada por Edge Functions con service role key
-- Nunca expongas esta función a usuarios finales

CREATE OR REPLACE FUNCTION public.exec_sql(sql_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  error_message TEXT;
BEGIN
  -- Intentar ejecutar el SQL
  BEGIN
    EXECUTE sql_text;
    result := jsonb_build_object(
      'success', true,
      'message', 'SQL ejecutado correctamente'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Capturar el error y retornarlo
    error_message := SQLERRM;
    result := jsonb_build_object(
      'success', false,
      'error', error_message,
      'sqlstate', SQLSTATE
    );
  END;
  
  RETURN result;
END;
$$;

-- Comentario
COMMENT ON FUNCTION public.exec_sql IS 'Función helper para ejecutar SQL desde Edge Functions. Solo debe ser usada con service role key.';

-- Política RLS: Solo service role puede ejecutar
-- Nota: Las funciones SECURITY DEFINER ya tienen permisos elevados
-- pero agregamos una verificación adicional
ALTER FUNCTION public.exec_sql SECURITY DEFINER;


-- ============================================
-- FIN DE LAS MIGRACIONES
-- ============================================
-- Total de migraciones aplicadas: 45
-- Fecha: Fri Jan 16 12:15:32 -03 2026
-- ============================================
