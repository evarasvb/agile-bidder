-- =====================================================
-- Tabla principal para almacenar Órdenes de Compra (OC)
-- Esta es la fuente principal de datos para BI
-- =====================================================
CREATE TABLE public.ordenes_compra (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE, -- Código único de la OC en MercadoPúblico
  
  -- Información de la OC
  nombre TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT,
  tipo TEXT,
  
  -- Fechas importantes
  fecha_envio TIMESTAMP WITH TIME ZONE,
  fecha_aceptacion TIMESTAMP WITH TIME ZONE,
  fecha_creacion TIMESTAMP WITH TIME ZONE,
  
  -- Información del Proveedor (vendedor/competidor)
  proveedor_nombre TEXT,
  proveedor_rut TEXT,
  proveedor_codigo TEXT,
  proveedor_direccion TEXT,
  proveedor_comuna TEXT,
  proveedor_region TEXT,
  
  -- Información de la Institución (comprador)
  institucion_nombre TEXT,
  institucion_rut TEXT,
  institucion_codigo TEXT,
  
  -- Información financiera
  total_neto NUMERIC(15, 2),
  total_iva NUMERIC(15, 2),
  total NUMERIC(15, 2),
  moneda TEXT DEFAULT 'CLP',
  
  -- Referencia a licitación si aplica
  licitacion_codigo TEXT,
  
  -- Metadata
  raw_data JSONB, -- Datos crudos de la API para futuras referencias
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- Tabla para los items/productos de las Órdenes de Compra
-- =====================================================
CREATE TABLE public.ordenes_compra_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_compra_id UUID NOT NULL REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  
  -- Información del producto
  correlativo INTEGER,
  codigo_producto TEXT,
  codigo_categoria TEXT,
  categoria TEXT,
  nombre_producto TEXT NOT NULL,
  descripcion TEXT,
  especificacion_comprador TEXT,
  especificacion_proveedor TEXT,
  
  -- Cantidades y precios
  cantidad NUMERIC(15, 4) NOT NULL DEFAULT 1,
  unidad TEXT,
  precio_unitario_neto NUMERIC(15, 2),
  total_neto NUMERIC(15, 2),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- Tabla para almacenar información de Licitaciones con más detalle
-- =====================================================
CREATE TABLE public.licitaciones_bi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE, -- CodigoExterno de MercadoPúblico
  
  -- Información general
  nombre TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT,
  codigo_estado INTEGER,
  tipo TEXT,
  codigo_tipo INTEGER,
  
  -- Fechas
  fecha_publicacion TIMESTAMP WITH TIME ZONE,
  fecha_cierre TIMESTAMP WITH TIME ZONE,
  fecha_cierre_documentos TIMESTAMP WITH TIME ZONE,
  fecha_adjudicacion TIMESTAMP WITH TIME ZONE,
  fecha_creacion TIMESTAMP WITH TIME ZONE,
  
  -- Información de la Institución
  institucion_nombre TEXT,
  institucion_rut TEXT,
  institucion_codigo TEXT,
  
  -- Unidad de compra
  unidad_compra TEXT,
  unidad_compra_direccion TEXT,
  unidad_compra_comuna TEXT,
  unidad_compra_region TEXT,
  
  -- Información financiera
  presupuesto_estimado NUMERIC(15, 2),
  moneda TEXT DEFAULT 'CLP',
  
  -- Evaluación
  etapas INTEGER,
  tiempo_evaluacion_dias INTEGER,
  
  -- Metadata
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- Tabla para los items requeridos en las licitaciones
-- =====================================================
CREATE TABLE public.licitaciones_bi_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  licitacion_id UUID NOT NULL REFERENCES public.licitaciones_bi(id) ON DELETE CASCADE,
  
  correlativo INTEGER,
  codigo_producto TEXT,
  codigo_categoria TEXT,
  categoria TEXT,
  nombre_producto TEXT NOT NULL,
  descripcion TEXT,
  
  cantidad NUMERIC(15, 4) NOT NULL DEFAULT 1,
  unidad TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- Tabla para adjudicaciones de licitaciones
-- =====================================================
CREATE TABLE public.licitaciones_adjudicaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  licitacion_id UUID NOT NULL REFERENCES public.licitaciones_bi(id) ON DELETE CASCADE,
  
  -- Proveedor adjudicado
  proveedor_nombre TEXT,
  proveedor_rut TEXT,
  proveedor_codigo TEXT,
  
  -- Montos
  monto_adjudicado NUMERIC(15, 2),
  moneda TEXT DEFAULT 'CLP',
  
  -- Fecha
  fecha_adjudicacion TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- Tabla maestra de Proveedores (para BI de competencia)
-- =====================================================
CREATE TABLE public.proveedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rut TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  razon_social TEXT,
  
  -- Ubicación
  direccion TEXT,
  comuna TEXT,
  region TEXT,
  
  -- Contacto
  telefono TEXT,
  email TEXT,
  
  -- Clasificación
  rubro TEXT,
  actividad_economica TEXT,
  tamanio_empresa TEXT, -- Grande, Mediana, Pequeña, Micro
  
  -- Estadísticas calculadas
  total_ordenes INTEGER DEFAULT 0,
  monto_total_ordenes NUMERIC(15, 2) DEFAULT 0,
  ultima_orden_fecha TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- Tabla maestra de Instituciones Públicas
-- =====================================================
CREATE TABLE public.instituciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rut TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  codigo TEXT,
  
  -- Ubicación
  direccion TEXT,
  comuna TEXT,
  region TEXT,
  
  -- Clasificación
  tipo TEXT, -- Municipalidad, Ministerio, Servicio, Hospital, etc.
  sector TEXT,
  
  -- Estadísticas
  total_licitaciones INTEGER DEFAULT 0,
  total_ordenes INTEGER DEFAULT 0,
  monto_total_compras NUMERIC(15, 2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- Índices para optimizar consultas BI
-- =====================================================
CREATE INDEX idx_ordenes_compra_fecha_envio ON public.ordenes_compra(fecha_envio);
CREATE INDEX idx_ordenes_compra_proveedor_rut ON public.ordenes_compra(proveedor_rut);
CREATE INDEX idx_ordenes_compra_institucion_rut ON public.ordenes_compra(institucion_rut);
CREATE INDEX idx_ordenes_compra_estado ON public.ordenes_compra(estado);
CREATE INDEX idx_ordenes_compra_licitacion ON public.ordenes_compra(licitacion_codigo);

CREATE INDEX idx_licitaciones_bi_fecha_cierre ON public.licitaciones_bi(fecha_cierre);
CREATE INDEX idx_licitaciones_bi_institucion_rut ON public.licitaciones_bi(institucion_rut);
CREATE INDEX idx_licitaciones_bi_estado ON public.licitaciones_bi(estado);

CREATE INDEX idx_proveedores_nombre ON public.proveedores(nombre);
CREATE INDEX idx_instituciones_nombre ON public.instituciones(nombre);

-- =====================================================
-- Triggers para updated_at
-- =====================================================
CREATE TRIGGER update_ordenes_compra_updated_at
  BEFORE UPDATE ON public.ordenes_compra
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_licitaciones_bi_updated_at
  BEFORE UPDATE ON public.licitaciones_bi
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_proveedores_updated_at
  BEFORE UPDATE ON public.proveedores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instituciones_updated_at
  BEFORE UPDATE ON public.instituciones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- RLS Policies (datos públicos, lectura para todos)
-- =====================================================
ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_compra_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitaciones_bi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitaciones_bi_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitaciones_adjudicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instituciones ENABLE ROW LEVEL SECURITY;

-- Los datos de MercadoPúblico son públicos, permitir lectura a usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden ver órdenes de compra"
ON public.ordenes_compra FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados pueden ver items de órdenes"
ON public.ordenes_compra_items FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados pueden ver licitaciones BI"
ON public.licitaciones_bi FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados pueden ver items de licitaciones"
ON public.licitaciones_bi_items FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados pueden ver adjudicaciones"
ON public.licitaciones_adjudicaciones FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados pueden ver proveedores"
ON public.proveedores FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados pueden ver instituciones"
ON public.instituciones FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Solo admins pueden insertar/actualizar datos (el sistema vía edge functions)
CREATE POLICY "Admins pueden gestionar órdenes de compra"
ON public.ordenes_compra FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins pueden gestionar items de órdenes"
ON public.ordenes_compra_items FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins pueden gestionar licitaciones BI"
ON public.licitaciones_bi FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins pueden gestionar items de licitaciones"
ON public.licitaciones_bi_items FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins pueden gestionar adjudicaciones"
ON public.licitaciones_adjudicaciones FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins pueden gestionar proveedores"
ON public.proveedores FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins pueden gestionar instituciones"
ON public.instituciones FOR ALL
USING (public.is_admin());