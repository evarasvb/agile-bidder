-- Fix Security Issues: Warn Level
-- 1. Fix compras_agiles public read - require authentication
-- 2. Fix inventory weak ownership - stricter policies

-- =====================================================
-- 1. FIX: compras_agiles table - require authentication for SELECT
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view compras_agiles" ON public.compras_agiles;

-- Create authenticated-only policy
CREATE POLICY "Authenticated users can view compras_agiles"
  ON public.compras_agiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 2. FIX: inventory table - stricter ownership validation
-- =====================================================

-- Drop existing policies that allow weak ownership
DROP POLICY IF EXISTS "Users can update own inventory or shared items" ON public.inventory;
DROP POLICY IF EXISTS "Users can delete own inventory or shared items" ON public.inventory;
DROP POLICY IF EXISTS "Admin can delete any inventory" ON public.inventory;
DROP POLICY IF EXISTS "Admin can update any inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can update own inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can delete own inventory" ON public.inventory;

-- Create stricter UPDATE policy - only owner or admin
CREATE POLICY "Users can update own inventory strict"
  ON public.inventory
  FOR UPDATE
  USING (
    user_id = auth.uid() 
    OR public.is_admin()
  );

-- Create stricter DELETE policy - only owner or admin  
CREATE POLICY "Users can delete own inventory strict"
  ON public.inventory
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.is_admin()
  );