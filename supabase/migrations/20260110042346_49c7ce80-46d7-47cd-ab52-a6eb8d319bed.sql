-- Create enum for notification frequency
DO $$ BEGIN
    CREATE TYPE public.notification_frequency AS ENUM ('immediate', 'daily', 'weekly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    company_name TEXT,
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    onboarding_step INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_categories table
CREATE TABLE IF NOT EXISTS public.user_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    category_id TEXT NOT NULL,
    category_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, category_id)
);

-- Create user_regions table
CREATE TABLE IF NOT EXISTS public.user_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    region_code TEXT NOT NULL,
    region_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, region_code)
);

-- Create user_notifications table
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    email_notifications BOOLEAN NOT NULL DEFAULT true,
    push_notifications BOOLEAN NOT NULL DEFAULT false,
    notification_frequency notification_frequency NOT NULL DEFAULT 'daily',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_preferences (public access for now, will be restricted with auth later)
CREATE POLICY "Allow public read access to user_preferences"
ON public.user_preferences FOR SELECT USING (true);

CREATE POLICY "Allow public insert to user_preferences"
ON public.user_preferences FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to user_preferences"
ON public.user_preferences FOR UPDATE USING (true) WITH CHECK (true);

-- RLS Policies for user_categories
CREATE POLICY "Allow public read access to user_categories"
ON public.user_categories FOR SELECT USING (true);

CREATE POLICY "Allow public insert to user_categories"
ON public.user_categories FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete to user_categories"
ON public.user_categories FOR DELETE USING (true);

-- RLS Policies for user_regions
CREATE POLICY "Allow public read access to user_regions"
ON public.user_regions FOR SELECT USING (true);

CREATE POLICY "Allow public insert to user_regions"
ON public.user_regions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete to user_regions"
ON public.user_regions FOR DELETE USING (true);

-- RLS Policies for user_notifications
CREATE POLICY "Allow public read access to user_notifications"
ON public.user_notifications FOR SELECT USING (true);

CREATE POLICY "Allow public insert to user_notifications"
ON public.user_notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to user_notifications"
ON public.user_notifications FOR UPDATE USING (true) WITH CHECK (true);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_notifications_updated_at
BEFORE UPDATE ON public.user_notifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();