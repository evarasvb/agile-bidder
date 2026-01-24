-- Crear tabla lista_precios_firmavb para el catálogo de productos de FirmaVB
CREATE TABLE IF NOT EXISTS public.lista_precios_firmavb (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proveedor TEXT,
  categoria TEXT,
  descripcion TEXT NOT NULL,
  codigo TEXT,
  costo NUMERIC DEFAULT 0,
  margen_comercial NUMERIC DEFAULT 0,
  precio_venta_neto NUMERIC DEFAULT 0,
  unidad TEXT DEFAULT 'UN',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_lista_precios_descripcion ON public.lista_precios_firmavb USING gin(to_tsvector('spanish', descripcion));
CREATE INDEX IF NOT EXISTS idx_lista_precios_categoria ON public.lista_precios_firmavb(categoria);
CREATE INDEX IF NOT EXISTS idx_lista_precios_codigo ON public.lista_precios_firmavb(codigo);
CREATE INDEX IF NOT EXISTS idx_lista_precios_proveedor ON public.lista_precios_firmavb(proveedor);
CREATE INDEX IF NOT EXISTS idx_lista_precios_activo ON public.lista_precios_firmavb(activo);

-- Habilitar RLS
ALTER TABLE public.lista_precios_firmavb ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: todos los usuarios autenticados pueden ver productos
CREATE POLICY "Authenticated users can view lista_precios" 
ON public.lista_precios_firmavb 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Solo admins pueden insertar/actualizar/eliminar
CREATE POLICY "Admins can insert lista_precios" 
ON public.lista_precios_firmavb 
FOR INSERT 
WITH CHECK (is_admin());

CREATE POLICY "Admins can update lista_precios" 
ON public.lista_precios_firmavb 
FOR UPDATE 
USING (is_admin());

CREATE POLICY "Admins can delete lista_precios" 
ON public.lista_precios_firmavb 
FOR DELETE 
USING (is_admin());

-- Trigger para actualizar updated_at
CREATE TRIGGER update_lista_precios_firmavb_updated_at
BEFORE UPDATE ON public.lista_precios_firmavb
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comentarios
COMMENT ON TABLE public.lista_precios_firmavb IS 'Catálogo maestro de productos de FirmaVB con precios de venta';
COMMENT ON COLUMN public.lista_precios_firmavb.proveedor IS 'Nombre del proveedor';
COMMENT ON COLUMN public.lista_precios_firmavb.categoria IS 'Categoría del producto';
COMMENT ON COLUMN public.lista_precios_firmavb.descripcion IS 'Descripción completa del producto';
COMMENT ON COLUMN public.lista_precios_firmavb.codigo IS 'Código SKU o referencia';
COMMENT ON COLUMN public.lista_precios_firmavb.costo IS 'Costo de adquisición';
COMMENT ON COLUMN public.lista_precios_firmavb.margen_comercial IS 'Margen comercial en porcentaje';
COMMENT ON COLUMN public.lista_precios_firmavb.precio_venta_neto IS 'Precio de venta neto';
COMMENT ON COLUMN public.lista_precios_firmavb.unidad IS 'Unidad de medida';