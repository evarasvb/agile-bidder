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