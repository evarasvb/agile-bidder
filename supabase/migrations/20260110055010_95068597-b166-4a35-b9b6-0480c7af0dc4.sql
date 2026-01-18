-- Tabla de clientes (usuarios del sistema)
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  empresa_nombre TEXT NOT NULL,
  rut TEXT NOT NULL,
  nombre_responsable TEXT NOT NULL,
  region TEXT NOT NULL,
  telefono TEXT,
  categoria_negocio TEXT,
  plan TEXT DEFAULT 'free',
  activo BOOLEAN DEFAULT true,
  onboarding_completado BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de inventario de clientes
CREATE TABLE IF NOT EXISTS public.cliente_inventario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT,
  precio_unitario NUMERIC NOT NULL DEFAULT 0,
  margen_minimo NUMERIC DEFAULT 10,
  stock INTEGER DEFAULT 0,
  tiempo_entrega_dias INTEGER DEFAULT 3,
  palabras_clave TEXT[],
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, sku)
);

-- Tabla de exclusiones de clientes
CREATE TABLE IF NOT EXISTS public.cliente_exclusiones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo_exclusion TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de notificaciones de clientes
CREATE TABLE IF NOT EXISTS public.cliente_notificaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  email_instantaneo BOOLEAN DEFAULT true,
  resumen_diario BOOLEAN DEFAULT false,
  resumen_semanal BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT false,
  webhook_url TEXT,
  presupuesto_minimo NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cliente_id)
);

-- Tabla de ofertas de clientes
CREATE TABLE IF NOT EXISTS public.cliente_ofertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  licitacion_id TEXT NOT NULL,
  estado TEXT DEFAULT 'borrador',
  match_score NUMERIC,
  productos_ofertados JSONB DEFAULT '[]'::jsonb,
  valor_total NUMERIC DEFAULT 0,
  margen_total NUMERIC DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_exclusiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_ofertas ENABLE ROW LEVEL SECURITY;

-- RLS Policies (public access for now, will be restricted with auth later)
CREATE POLICY "Public access for clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for cliente_inventario" ON public.cliente_inventario FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for cliente_exclusiones" ON public.cliente_exclusiones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for cliente_notificaciones" ON public.cliente_notificaciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for cliente_ofertas" ON public.cliente_ofertas FOR ALL USING (true) WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cliente_inventario_updated_at BEFORE UPDATE ON public.cliente_inventario FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cliente_notificaciones_updated_at BEFORE UPDATE ON public.cliente_notificaciones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cliente_ofertas_updated_at BEFORE UPDATE ON public.cliente_ofertas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cliente_inventario_cliente ON public.cliente_inventario(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_inventario_palabras ON public.cliente_inventario USING GIN(palabras_clave);
CREATE INDEX IF NOT EXISTS idx_cliente_exclusiones_cliente ON public.cliente_exclusiones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_ofertas_cliente ON public.cliente_ofertas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_ofertas_licitacion ON public.cliente_ofertas(licitacion_id);