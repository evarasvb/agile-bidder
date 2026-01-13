-- Create table for multiple product images
CREATE TABLE public.product_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('inventory', 'cliente_inventario')),
  image_url TEXT NOT NULL,
  storage_path TEXT,
  orden INTEGER DEFAULT 0,
  es_principal BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_product_images_product ON public.product_images(product_id, product_type);

-- Enable RLS
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all product images (public products)
CREATE POLICY "Anyone can view product images"
ON public.product_images
FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can insert images
CREATE POLICY "Authenticated users can insert images"
ON public.product_images
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update their own images
CREATE POLICY "Users can update own images"
ON public.product_images
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Policy: Users can delete their own images
CREATE POLICY "Users can delete own images"
ON public.product_images
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);