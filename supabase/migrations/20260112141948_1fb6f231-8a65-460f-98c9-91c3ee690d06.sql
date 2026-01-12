-- Drop existing permissive policies on user_preferences
DROP POLICY IF EXISTS "Allow public read access to user_preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Allow public insert to user_preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Allow public update to user_preferences" ON public.user_preferences;

-- Create secure RLS policies for user_preferences using auth.uid()
CREATE POLICY "Users can read own preferences" 
ON public.user_preferences FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" 
ON public.user_preferences FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" 
ON public.user_preferences FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Drop existing permissive policies on user_categories
DROP POLICY IF EXISTS "Allow public read access to user_categories" ON public.user_categories;
DROP POLICY IF EXISTS "Allow public insert to user_categories" ON public.user_categories;
DROP POLICY IF EXISTS "Allow public delete to user_categories" ON public.user_categories;

-- Create secure RLS policies for user_categories
CREATE POLICY "Users can read own categories" 
ON public.user_categories FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" 
ON public.user_categories FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" 
ON public.user_categories FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Drop existing permissive policies on user_regions
DROP POLICY IF EXISTS "Allow public read access to user_regions" ON public.user_regions;
DROP POLICY IF EXISTS "Allow public insert to user_regions" ON public.user_regions;
DROP POLICY IF EXISTS "Allow public delete to user_regions" ON public.user_regions;

-- Create secure RLS policies for user_regions
CREATE POLICY "Users can read own regions" 
ON public.user_regions FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own regions" 
ON public.user_regions FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own regions" 
ON public.user_regions FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Drop existing permissive policies on user_notifications
DROP POLICY IF EXISTS "Allow public read access to user_notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "Allow public insert to user_notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "Allow public update to user_notifications" ON public.user_notifications;

-- Create secure RLS policies for user_notifications
CREATE POLICY "Users can read own notifications" 
ON public.user_notifications FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications" 
ON public.user_notifications FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" 
ON public.user_notifications FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);