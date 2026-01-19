-- ============================================
-- SECURITY FIXES MIGRATION (Idempotent)
-- Fix RLS issues for profiles, clientes, calendario_eventos, inventory
-- ============================================

-- 1. FIX PROFILES TABLE - Ensure RLS is enabled
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing profile policies to recreate them properly
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public read access" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recreate policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. FIX CLIENTES TABLE - Block anonymous access
DROP POLICY IF EXISTS "Public can view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Anyone can view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users view own cliente" ON public.clientes;

-- Ensure only authenticated users who own the record can access
CREATE POLICY "Authenticated users view own cliente" 
ON public.clientes 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- 3. FIX INVENTORY TABLE - Remove null user_id loophole
DROP POLICY IF EXISTS "Users can update own inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can delete own inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can update own inventory strict" ON public.inventory;
DROP POLICY IF EXISTS "Users can delete own inventory strict" ON public.inventory;

-- Recreate policies without the NULL loophole (strict owner-only access)
CREATE POLICY "Users can update own inventory strict" 
ON public.inventory 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own inventory strict" 
ON public.inventory 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);