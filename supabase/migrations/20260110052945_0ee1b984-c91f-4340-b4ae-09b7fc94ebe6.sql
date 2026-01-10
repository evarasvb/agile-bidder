-- =============================================
-- FASE 1: TABLA DE INVENTARIO COMPLETO
-- =============================================
CREATE TABLE public.inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  nombre_producto TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  precio_unitario NUMERIC NOT NULL DEFAULT 0,
  margen_minimo NUMERIC NOT NULL DEFAULT 10,
  margen_objetivo NUMERIC NOT NULL DEFAULT 25,
  stock_disponible NUMERIC NOT NULL DEFAULT 0,
  unidad_medida TEXT NOT NULL DEFAULT 'unidad',
  tiempo_entrega_dias INTEGER NOT NULL DEFAULT 7,
  proveedor TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory (public read, service role write)
CREATE POLICY "Allow public read access to inventory"
ON public.inventory FOR SELECT
USING (true);

CREATE POLICY "Allow service role insert to inventory"
ON public.inventory FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow service role update to inventory"
ON public.inventory FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow service role delete to inventory"
ON public.inventory FOR DELETE
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_inventory_updated_at
BEFORE UPDATE ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FASE 3: TABLA DE OFERTAS
-- =============================================
CREATE TABLE public.ofertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  licitacion_id TEXT NOT NULL REFERENCES public.licitaciones(id_licitacion),
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'revision', 'aprobada', 'enviada', 'rechazada', 'ganada', 'perdida')),
  match_score NUMERIC,
  productos_ofertados JSONB NOT NULL DEFAULT '[]',
  valor_total_oferta NUMERIC NOT NULL DEFAULT 0,
  margen_total NUMERIC NOT NULL DEFAULT 0,
  notas_internas TEXT,
  documento_oferta_url TEXT,
  fecha_envio TIMESTAMP WITH TIME ZONE,
  respuesta_mp JSONB,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ofertas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ofertas
CREATE POLICY "Allow public read access to ofertas"
ON public.ofertas FOR SELECT
USING (true);

CREATE POLICY "Allow public insert to ofertas"
ON public.ofertas FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update to ofertas"
ON public.ofertas FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete to ofertas"
ON public.ofertas FOR DELETE
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_ofertas_updated_at
BEFORE UPDATE ON public.ofertas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FASE 9: TABLA DE LOGS MEJORADA
-- =============================================
CREATE TABLE public.system_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('match', 'oferta_generada', 'oferta_enviada', 'scraping', 'error', 'info')),
  severidad TEXT NOT NULL DEFAULT 'info' CHECK (severidad IN ('info', 'warning', 'error', 'success')),
  mensaje TEXT NOT NULL,
  licitacion_id TEXT,
  oferta_id UUID REFERENCES public.ofertas(id),
  detalles JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_logs
CREATE POLICY "Allow public read access to system_logs"
ON public.system_logs FOR SELECT
USING (true);

CREATE POLICY "Allow public insert to system_logs"
ON public.system_logs FOR INSERT
WITH CHECK (true);

-- Indexes for better query performance
CREATE INDEX idx_inventory_categoria ON public.inventory(categoria);
CREATE INDEX idx_inventory_activo ON public.inventory(activo);
CREATE INDEX idx_inventory_keywords ON public.inventory USING GIN(keywords);
CREATE INDEX idx_ofertas_estado ON public.ofertas(estado);
CREATE INDEX idx_ofertas_licitacion ON public.ofertas(licitacion_id);
CREATE INDEX idx_system_logs_tipo ON public.system_logs(tipo);
CREATE INDEX idx_system_logs_created ON public.system_logs(created_at DESC);

-- Insert sample inventory data for testing
INSERT INTO public.inventory (sku, nombre_producto, descripcion, categoria, keywords, precio_unitario, margen_minimo, margen_objetivo, stock_disponible, unidad_medida, tiempo_entrega_dias, proveedor) VALUES
('OFF-001', 'Resma Papel Carta', 'Resma de papel bond tamaño carta 500 hojas 75g/m2', 'Oficina', ARRAY['papel', 'resma', 'carta', 'bond', 'oficina', 'impresion'], 3500, 15, 30, 500, 'resma', 3, 'Papeles del Sur'),
('OFF-002', 'Toner HP 85A', 'Toner compatible HP LaserJet 85A negro', 'Tecnología', ARRAY['toner', 'hp', 'impresora', 'laser', 'cartucho', 'negro'], 25000, 20, 35, 100, 'unidad', 5, 'TechSupply'),
('OFF-003', 'Silla Ergonómica Ejecutiva', 'Silla de oficina ergonómica con apoyo lumbar', 'Mobiliario', ARRAY['silla', 'ergonomica', 'oficina', 'ejecutiva', 'mobiliario'], 89000, 18, 28, 25, 'unidad', 10, 'Muebles Corp'),
('TEC-001', 'Notebook Lenovo ThinkPad', 'Notebook empresarial 14" Core i5 16GB RAM 512GB SSD', 'Tecnología', ARRAY['notebook', 'lenovo', 'thinkpad', 'computador', 'laptop', 'portatil'], 750000, 12, 22, 15, 'unidad', 7, 'TechSupply'),
('TEC-002', 'Monitor LED 24"', 'Monitor LED Full HD 24 pulgadas HDMI VGA', 'Tecnología', ARRAY['monitor', 'led', 'pantalla', 'display', 'hdmi'], 120000, 15, 25, 40, 'unidad', 5, 'TechSupply'),
('LIM-001', 'Kit Limpieza Industrial', 'Kit completo de limpieza industrial 20 piezas', 'Aseo', ARRAY['limpieza', 'aseo', 'industrial', 'kit', 'mantenimiento'], 45000, 25, 40, 80, 'kit', 3, 'CleanPro'),
('MED-001', 'Guantes Nitrilo Caja', 'Caja de 100 guantes de nitrilo talla M', 'Médico', ARRAY['guantes', 'nitrilo', 'medico', 'salud', 'proteccion', 'desechable'], 12000, 20, 35, 200, 'caja', 2, 'MediSupply'),
('CON-001', 'Cemento Portland 25kg', 'Saco de cemento Portland gris 25 kilos', 'Construcción', ARRAY['cemento', 'portland', 'construccion', 'obra', 'material'], 6500, 10, 20, 300, 'saco', 5, 'Materiales XYZ');