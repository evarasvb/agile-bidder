-- Tabla de configuración de auto-bids
CREATE TABLE IF NOT EXISTS auto_bids (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  codigo_producto TEXT NOT NULL,
  nombre_producto TEXT NOT NULL,
  precio_base DECIMAL(10,2) NOT NULL,
  margen_minimo DECIMAL(5,2) NOT NULL, -- Porcentaje mínimo de margen (ej: 15.00)
  tope_descuento DECIMAL(5,2) NOT NULL, -- Máximo descuento permitido (ej: 25.00)
  activo BOOLEAN DEFAULT true,
  prioridad INTEGER DEFAULT 0, -- Mayor número = mayor prioridad
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(product_id)
);

-- Tabla de oportunidades generadas automáticamente
CREATE TABLE IF NOT EXISTS auto_bid_opportunities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auto_bid_id UUID REFERENCES auto_bids(id) ON DELETE CASCADE,
  licitacion_id TEXT NOT NULL, -- ID de MercadoPublico
  licitacion_nombre TEXT NOT NULL,
  institucion TEXT NOT NULL,
  monto_estimado DECIMAL(12,2),
  cantidad_solicitada INTEGER,
  precio_sugerido DECIMAL(10,2) NOT NULL, -- Precio calculado automáticamente
  margen_calculado DECIMAL(5,2) NOT NULL,
  estado TEXT DEFAULT 'pendiente', -- pendiente, enviada, ganada, perdida
  fecha_cierre TIMESTAMP WITH TIME ZONE,
  match_score INTEGER DEFAULT 0, -- Score de match (0-100)
  metadata JSONB, -- Info adicional del match
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_auto_bids_activo ON auto_bids(activo);
CREATE INDEX IF NOT EXISTS idx_auto_bids_prioridad ON auto_bids(prioridad DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_estado ON auto_bid_opportunities(estado);
CREATE INDEX IF NOT EXISTS idx_opportunities_fecha_cierre ON auto_bid_opportunities(fecha_cierre);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_auto_bids_updated_at BEFORE UPDATE ON auto_bids
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON auto_bid_opportunities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabla de logs de errores (opcional pero útil para ErrorBoundary)
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  component_stack TEXT,
  user_id UUID REFERENCES auth.users(id),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);