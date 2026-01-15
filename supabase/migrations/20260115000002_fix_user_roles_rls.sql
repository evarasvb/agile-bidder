-- Fix RLS policies for user_roles to allow admins to manage roles
-- ================================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Allow all authenticated users to view all roles (needed for admin panel)
CREATE POLICY "Authenticated users can view all roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (true);

-- Allow admins to insert roles for any user
CREATE POLICY "Admins can insert roles" 
ON public.user_roles 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Allow admins to delete roles for any user
CREATE POLICY "Admins can delete roles" 
ON public.user_roles 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Allow users to view their own roles (for backward compatibility)
CREATE POLICY "Users can view own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);
