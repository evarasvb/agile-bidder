-- Table for licitaciones (procurements)
CREATE TABLE IF NOT EXISTS public.licitaciones (
  id_licitacion TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  organismo TEXT NOT NULL,
  presupuesto NUMERIC,
  fecha_cierre TIMESTAMP WITH TIME ZONE,
  estado TEXT DEFAULT 'activa',
  link_oficial TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for licitacion items (products within each procurement)
CREATE TABLE IF NOT EXISTS public.licitacion_items (
  id SERIAL PRIMARY KEY,
  licitacion_id TEXT NOT NULL REFERENCES public.licitaciones(id_licitacion) ON DELETE CASCADE,
  nombre_producto TEXT NOT NULL,
  descripcion TEXT,
  cantidad NUMERIC,
  unidad TEXT
);

-- Enable RLS but allow public read for scraper data display
ALTER TABLE public.licitaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacion_items ENABLE ROW LEVEL SECURITY;

-- Public read policy for licitaciones (scraper data is public)
CREATE POLICY "Allow public read access to licitaciones" 
ON public.licitaciones 
FOR SELECT 
USING (true);

-- Public read policy for licitacion_items
CREATE POLICY "Allow public read access to licitacion_items" 
ON public.licitacion_items 
FOR SELECT 
USING (true);

-- Insert policy for service role (scraper will use service key)
CREATE POLICY "Allow service role insert to licitaciones" 
ON public.licitaciones 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow service role insert to licitacion_items" 
ON public.licitacion_items 
FOR INSERT 
WITH CHECK (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.licitaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.licitacion_items;