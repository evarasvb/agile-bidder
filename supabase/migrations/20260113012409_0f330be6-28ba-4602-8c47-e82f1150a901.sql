-- Add image_url column to cliente_inventario table
ALTER TABLE public.cliente_inventario 
ADD COLUMN IF NOT EXISTS imagen_url TEXT;