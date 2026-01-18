-- Create import_history table to track all Excel/CSV imports
CREATE TABLE IF NOT EXISTS public.import_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('xlsx', 'xls', 'csv')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'partial', 'failed')),
  errors JSONB DEFAULT '[]'::jsonb,
  imported_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own import history
CREATE POLICY "Users can view their own import history"
ON public.import_history
FOR SELECT
USING (auth.uid() = imported_by);

-- Allow authenticated users to insert their own import records
CREATE POLICY "Users can insert their own import history"
ON public.import_history
FOR INSERT
WITH CHECK (auth.uid() = imported_by);

-- Allow admins to view all import history
CREATE POLICY "Admins can view all import history"
ON public.import_history
FOR SELECT
USING (public.is_admin());