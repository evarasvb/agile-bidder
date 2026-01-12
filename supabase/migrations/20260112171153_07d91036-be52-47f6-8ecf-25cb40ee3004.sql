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