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