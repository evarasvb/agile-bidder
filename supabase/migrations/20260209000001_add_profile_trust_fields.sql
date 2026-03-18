-- ============================================
-- MIGRATION: Add trust/profile fields to profiles table
-- Adds first_name, last_name, rut, phone, about_me,
-- instagram_username, instagram_verified, website, company_name
-- ============================================

-- Add new columns to profiles table (idempotent)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rut TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS about_me TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram_username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Migrate full_name into first_name + last_name for existing rows where first_name is null
UPDATE public.profiles 
SET 
  first_name = CASE 
    WHEN full_name IS NOT NULL AND full_name LIKE '% %' 
    THEN split_part(full_name, ' ', 1)
    ELSE full_name 
  END,
  last_name = CASE 
    WHEN full_name IS NOT NULL AND full_name LIKE '% %' 
    THEN substring(full_name from position(' ' in full_name) + 1)
    ELSE NULL 
  END
WHERE first_name IS NULL AND full_name IS NOT NULL;
