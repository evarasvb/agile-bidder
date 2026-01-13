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