-- Add new columns for processing and matching workflow
ALTER TABLE public.licitaciones 
ADD COLUMN procesada boolean NOT NULL DEFAULT false,
ADD COLUMN match_encontrado boolean NOT NULL DEFAULT false,
ADD COLUMN match_score numeric DEFAULT NULL;

-- Create index for faster filtering
CREATE INDEX idx_licitaciones_procesada ON public.licitaciones(procesada);
CREATE INDEX idx_licitaciones_match ON public.licitaciones(match_encontrado);

-- Add UPDATE policy for service role
CREATE POLICY "Allow service role update to licitaciones" 
ON public.licitaciones 
FOR UPDATE 
USING (true)
WITH CHECK (true);