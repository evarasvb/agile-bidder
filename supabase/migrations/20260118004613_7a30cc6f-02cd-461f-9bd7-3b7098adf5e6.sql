-- Fix PUBLIC_DATA_EXPOSURE security issue
-- Restrict compras_agiles and licitaciones tables to authenticated users only
-- This prevents anonymous/unauthenticated access while still allowing all authenticated users
-- to view government procurement opportunities (which is the core functionality of the platform)

-- Drop existing overly permissive policy on compras_agiles
DROP POLICY IF EXISTS "Users can view compras_agiles" ON public.compras_agiles;

-- Create new policy requiring authentication
CREATE POLICY "Authenticated users can view compras_agiles"
  ON public.compras_agiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Drop existing overly permissive policy on licitaciones (if exists)
DROP POLICY IF EXISTS "Authenticated users can read licitaciones" ON public.licitaciones;

-- Create new policy requiring authentication  
CREATE POLICY "Authenticated users can view licitaciones"
  ON public.licitaciones
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Ensure admins can manage these tables
DROP POLICY IF EXISTS "Admins can manage compras_agiles" ON public.compras_agiles;
CREATE POLICY "Admins can manage compras_agiles"
  ON public.compras_agiles
  FOR ALL
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage licitaciones" ON public.licitaciones;
CREATE POLICY "Admins can manage licitaciones"
  ON public.licitaciones
  FOR ALL
  USING (is_admin());