-- Create compras_agiles table for agile purchases
CREATE TABLE public.compras_agiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  organismo TEXT NOT NULL,
  monto NUMERIC(15,2),
  fecha_cierre TIMESTAMP WITH TIME ZONE,
  estado VARCHAR(50) DEFAULT 'activa',
  region VARCHAR(100),
  descripcion TEXT,
  link_oficial TEXT,
  match_encontrado BOOLEAN DEFAULT false,
  match_score INTEGER,
  datos_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.compras_agiles ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read
CREATE POLICY "Users can view compras_agiles"
  ON public.compras_agiles
  FOR SELECT
  USING (true);

-- Create policy for authenticated users to update
CREATE POLICY "Users can update compras_agiles"
  ON public.compras_agiles
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_compras_agiles_updated_at
  BEFORE UPDATE ON public.compras_agiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.compras_agiles;

-- Insert sample data
INSERT INTO public.compras_agiles (codigo, nombre, organismo, monto, fecha_cierre, estado, region, descripcion, match_encontrado, match_score)
VALUES 
  ('CA-2025-001', 'Computadores portátiles para oficina', 'Ministerio de Salud', 15000000, now() + interval '5 days', 'activa', 'Metropolitana', 'Adquisición de 20 notebooks para trabajo remoto', true, 85),
  ('CA-2025-002', 'Insumos de oficina varios', 'Municipalidad de Santiago', 2500000, now() + interval '3 days', 'activa', 'Metropolitana', 'Papel, lápices, carpetas y artículos varios', true, 92),
  ('CA-2025-003', 'Equipamiento computacional', 'Hospital Regional', 8500000, now() + interval '7 days', 'activa', 'Valparaíso', 'Monitores y periféricos', true, 78),
  ('CA-2025-004', 'Material de escritorio', 'Servicio de Impuestos Internos', 1200000, now() + interval '2 days', 'urgente', 'Metropolitana', 'Resmas de papel y toner', false, null),
  ('CA-2025-005', 'Mobiliario de oficina', 'Contraloría General', 6000000, now() + interval '10 days', 'activa', 'Biobío', 'Escritorios y sillas ergonómicas', false, null);