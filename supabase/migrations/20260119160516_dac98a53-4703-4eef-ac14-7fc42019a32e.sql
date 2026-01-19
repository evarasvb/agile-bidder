-- SECURITY FIX: Replace permissive USING(true) policies with proper user-scoped policies

-- ============================================
-- FIX INVENTORY TABLE RLS POLICIES
-- ============================================

-- Drop all permissive policies on inventory
DROP POLICY IF EXISTS "Allow public read access to inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow service role insert to inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow service role update to inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow service role delete to inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can view own inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can insert own inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can update own inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can delete own inventory" ON public.inventory;
DROP POLICY IF EXISTS "Admins can manage all inventory" ON public.inventory;

-- Create user-scoped policies for inventory (uses user_id column)
CREATE POLICY "Users can view own inventory"
  ON public.inventory FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can insert own inventory"
  ON public.inventory FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update own inventory"
  ON public.inventory FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can delete own inventory"
  ON public.inventory FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ============================================
-- FIX OFERTAS TABLE RLS POLICIES
-- ============================================

-- Drop all permissive policies on ofertas
DROP POLICY IF EXISTS "Allow public read access to ofertas" ON public.ofertas;
DROP POLICY IF EXISTS "Allow public insert to ofertas" ON public.ofertas;
DROP POLICY IF EXISTS "Allow public update to ofertas" ON public.ofertas;
DROP POLICY IF EXISTS "Allow public delete to ofertas" ON public.ofertas;
DROP POLICY IF EXISTS "Users can view own ofertas" ON public.ofertas;
DROP POLICY IF EXISTS "Users can insert own ofertas" ON public.ofertas;
DROP POLICY IF EXISTS "Users can update own ofertas" ON public.ofertas;
DROP POLICY IF EXISTS "Users can delete own ofertas" ON public.ofertas;
DROP POLICY IF EXISTS "Admins can manage all ofertas" ON public.ofertas;

-- Create user-scoped policies for ofertas (uses created_by column)
CREATE POLICY "Users can view own ofertas"
  ON public.ofertas FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "Users can insert own ofertas"
  ON public.ofertas FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

CREATE POLICY "Users can update own ofertas"
  ON public.ofertas FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR public.is_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "Users can delete own ofertas"
  ON public.ofertas FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());