-- Table for tracking commissionable sales (based on accepted purchase orders)
CREATE TABLE public.ventas_comisionables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_compra_id UUID REFERENCES public.ordenes_compra(id),
  codigo_oc VARCHAR(100) NOT NULL,
  fecha_aceptacion TIMESTAMP WITH TIME ZONE,
  comprador VARCHAR(255),
  monto_neto DECIMAL(15,2) NOT NULL DEFAULT 0,
  comision_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 2.00,
  comision_monto DECIMAL(15,2) GENERATED ALWAYS AS (monto_neto * comision_porcentaje / 100) STORED,
  periodo VARCHAR(7) NOT NULL, -- Format: YYYY-MM
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for monthly commission invoices
CREATE TABLE public.facturas_comision (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_factura VARCHAR(50) UNIQUE NOT NULL,
  periodo VARCHAR(7) NOT NULL, -- Format: YYYY-MM
  fecha_emision TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fecha_vencimiento TIMESTAMP WITH TIME ZONE,
  total_ventas DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_comision DECIMAL(15,2) NOT NULL DEFAULT 0,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente', -- pendiente, pagada, vencida
  fecha_pago TIMESTAMP WITH TIME ZONE,
  metodo_pago VARCHAR(50),
  documento_url TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for company billing settings
CREATE TABLE public.empresas_billing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nombre_empresa VARCHAR(255),
  rut_empresa VARCHAR(20),
  plan VARCHAR(50) NOT NULL DEFAULT 'enterprise',
  comision_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 2.00,
  tarjeta_ultimos_4 VARCHAR(4),
  tarjeta_marca VARCHAR(20),
  tarjeta_expiracion VARCHAR(7),
  direccion_facturacion TEXT,
  email_facturacion VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.ventas_comisionables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas_comision ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas_billing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ventas_comisionables
CREATE POLICY "Users can view their own commissionable sales" 
ON public.ventas_comisionables FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own commissionable sales" 
ON public.ventas_comisionables FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for facturas_comision
CREATE POLICY "Users can view their own invoices" 
ON public.facturas_comision FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own invoices" 
ON public.facturas_comision FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for empresas_billing
CREATE POLICY "Users can view their own billing settings" 
ON public.empresas_billing FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own billing settings" 
ON public.empresas_billing FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own billing settings" 
ON public.empresas_billing FOR UPDATE 
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_ventas_comisionables_periodo ON public.ventas_comisionables(periodo);
CREATE INDEX idx_ventas_comisionables_user_id ON public.ventas_comisionables(user_id);
CREATE INDEX idx_facturas_comision_periodo ON public.facturas_comision(periodo);
CREATE INDEX idx_facturas_comision_user_id ON public.facturas_comision(user_id);