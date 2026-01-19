-- Create evaristo_logs table for mission logging
CREATE TABLE IF NOT EXISTS public.evaristo_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  mision_file TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evaristo_logs ENABLE ROW LEVEL SECURITY;

-- Only admin can access logs
CREATE POLICY "Admin can view all evaristo logs"
  ON public.evaristo_logs FOR SELECT
  USING (public.is_admin() OR auth.uid() = user_id);

CREATE POLICY "Admin can insert evaristo logs"
  ON public.evaristo_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can update evaristo logs"
  ON public.evaristo_logs FOR UPDATE
  USING (auth.uid() = user_id);