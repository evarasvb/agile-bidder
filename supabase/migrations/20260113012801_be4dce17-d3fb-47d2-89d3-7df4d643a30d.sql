-- Add image_url column to inventory table (admin inventory)
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS imagen_url TEXT;