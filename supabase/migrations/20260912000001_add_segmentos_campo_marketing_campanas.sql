-- Agregar campo de segmentos a marketing_campanas para mejor control
ALTER TABLE IF EXISTS public.marketing_campanas
ADD COLUMN IF NOT EXISTS segmentos_seleccionados text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS canal_primario text,
ADD COLUMN IF NOT EXISTS audiencia_estimada_final int;

-- Actualizar RLS si es necesario
ALTER TABLE public.marketing_campanas ENABLE ROW LEVEL SECURITY;

-- Crear índice para búsquedas por canal
CREATE INDEX IF NOT EXISTS idx_marketing_campanas_canal ON public.marketing_campanas(canal_primario);
