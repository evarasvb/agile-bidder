-- Add new columns for processing and matching workflow
ALTER TABLE public.licitaciones 
ADD COLUMN IF NOT EXISTS procesada boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS match_encontrado boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS match_score numeric DEFAULT NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_licitaciones_procesada ON public.licitaciones(procesada);
CREATE INDEX IF NOT EXISTS idx_licitaciones_match ON public.licitaciones(match_encontrado);

-- Add UPDATE policy for service role
DROP POLICY IF EXISTS "Allow service role update to licitaciones" ON public.licitaciones;
CREATE POLICY "Allow service role update to licitaciones" 
ON public.licitaciones 
FOR UPDATE 
USING (true)
WITH CHECK (true);