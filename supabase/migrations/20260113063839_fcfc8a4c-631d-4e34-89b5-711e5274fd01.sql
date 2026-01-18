-- Create user_settings table for persisting settings
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  company_settings JSONB DEFAULT '{}',
  bidding_settings JSONB DEFAULT '{}',
  delivery_settings JSONB DEFAULT '{}',
  automation_settings JSONB DEFAULT '{}',
  regions TEXT[] DEFAULT '{}',
  api_key_encrypted TEXT,
  api_key_connected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only access their own settings
CREATE POLICY "Users can read own settings" ON public.user_settings
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings" ON public.user_settings
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings" ON public.user_settings
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own settings" ON public.user_settings
FOR DELETE USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Fix inventory RLS - allow authenticated users to insert/manage their products
-- First, add user_id column to inventory for proper user-based RLS
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add policy for authenticated users to insert inventory
CREATE POLICY "Authenticated users can insert inventory" ON public.inventory
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Add policy for authenticated users to read all inventory (for now)
CREATE POLICY "Authenticated users can read inventory" ON public.inventory
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Add policy for users to update their own inventory or admins can update all
CREATE POLICY "Users can update own inventory or admin all" ON public.inventory
FOR UPDATE USING (
  user_id = auth.uid() OR user_id IS NULL OR public.is_admin()
);

-- Add policy for users to delete their own inventory or admins can delete all
CREATE POLICY "Users can delete own inventory or admin all" ON public.inventory
FOR DELETE USING (
  user_id = auth.uid() OR user_id IS NULL OR public.is_admin()
);