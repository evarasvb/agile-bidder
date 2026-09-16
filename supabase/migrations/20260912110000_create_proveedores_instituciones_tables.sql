-- Tabla consolidada de proveedores extraídos de MercadoPublico
CREATE TABLE IF NOT EXISTS public.proveedores_consolidados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rut TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  razon_social TEXT,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  comuna TEXT,
  region TEXT,
  rubro TEXT, -- tecnologia, ferreteria, alimentos, servicios, etc.
  tamanio_empresa TEXT, -- pequeña, mediana, grande
  actividad_economica TEXT,
  descripcion TEXT,
  sitio_web TEXT,

  -- Auditoría
  fuente_datos TEXT DEFAULT 'mercadopublico', -- mercadopublico, estado, otros
  fecha_extraccion TIMESTAMPTZ DEFAULT NOW(),
  ultima_actualizacion TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_proveedores_consolidados_rut ON public.proveedores_consolidados(rut);
CREATE INDEX IF NOT EXISTS idx_proveedores_consolidados_email ON public.proveedores_consolidados(email);
CREATE INDEX IF NOT EXISTS idx_proveedores_consolidados_rubro ON public.proveedores_consolidados(rubro);
CREATE INDEX IF NOT EXISTS idx_proveedores_consolidados_region ON public.proveedores_consolidados(region);
CREATE INDEX IF NOT EXISTS idx_proveedores_consolidados_fuente ON public.proveedores_consolidados(fuente_datos);

-- Tabla de instituciones públicas (organismos, ministerios, municipios, servicios)
CREATE TABLE IF NOT EXISTS public.instituciones_publicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rut TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  tipo_institucion TEXT, -- ministerio, servicio, municipio, empresa_publica, otro
  email_contacto TEXT,
  telefono TEXT,
  direccion TEXT,
  comuna TEXT,
  region TEXT,
  website TEXT,

  -- Datos de compras públicas
  monto_total_compras NUMERIC DEFAULT 0,
  cantidad_compras INT DEFAULT 0,
  ultima_compra_fecha TIMESTAMPTZ,

  -- Auditoría
  fecha_extraccion TIMESTAMPTZ DEFAULT NOW(),
  ultima_actualizacion TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para instituciones
CREATE INDEX IF NOT EXISTS idx_instituciones_publicas_rut ON public.instituciones_publicas(rut);
CREATE INDEX IF NOT EXISTS idx_instituciones_publicas_tipo ON public.instituciones_publicas(tipo_institucion);
CREATE INDEX IF NOT EXISTS idx_instituciones_publicas_region ON public.instituciones_publicas(region);
CREATE INDEX IF NOT EXISTS idx_instituciones_publicas_email ON public.instituciones_publicas(email_contacto);

-- Tabla de auditoría para sincronizaciones
CREATE TABLE IF NOT EXISTS public.sync_proveedores_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_sync TIMESTAMPTZ DEFAULT NOW(),
  tipo_sync TEXT, -- 'proveedores_mercadopublico', 'instituciones_publicas', etc.
  cantidad_procesados INT,
  cantidad_nuevos INT,
  cantidad_actualizados INT,
  cantidad_errores INT,
  tiempo_segundos INT,
  status TEXT, -- 'success', 'error', 'partial'
  detalles JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_proveedores_log_fecha ON public.sync_proveedores_log(fecha_sync);
CREATE INDEX IF NOT EXISTS idx_sync_proveedores_log_tipo ON public.sync_proveedores_log(tipo_sync);

-- RLS Policies
ALTER TABLE public.proveedores_consolidados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instituciones_publicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_proveedores_log ENABLE ROW LEVEL SECURITY;

-- Policies: allow authenticated users to read all
CREATE POLICY "allow_read_proveedores_consolidados" ON public.proveedores_consolidados
  FOR SELECT USING (true);

CREATE POLICY "allow_read_instituciones_publicas" ON public.instituciones_publicas
  FOR SELECT USING (true);

CREATE POLICY "allow_read_sync_log" ON public.sync_proveedores_log
  FOR SELECT USING (true);

-- Service role can insert/update
CREATE POLICY "allow_service_role_proveedores" ON public.proveedores_consolidados
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "allow_service_role_instituciones" ON public.instituciones_publicas
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "allow_service_role_sync_log" ON public.sync_proveedores_log
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
