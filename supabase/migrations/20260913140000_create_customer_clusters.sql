-- Tabla de clusters/segmentos de clientes
CREATE TABLE IF NOT EXISTS public.customer_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id INT NOT NULL,
  cluster_name TEXT NOT NULL,
  cluster_description TEXT,

  -- Cliente identificado (puede ser proveedor o institución)
  customer_rut TEXT NOT NULL,
  customer_type TEXT, -- 'proveedor', 'institucion'
  customer_name TEXT,

  -- Características del cluster
  characteristics JSONB, -- {'sector': 'tecnologia', 'size': 'mediana', 'activity_level': 'high', etc}
  purchase_history JSONB, -- {'total_orders': 45, 'avg_order_value': 2500000, 'categories': [...]}

  -- Perfil enriquecido por IA
  ai_profile TEXT, -- Descripción generada por IA del cliente y su comportamiento

  -- Metadata
  fecha_clustering TIMESTAMPTZ DEFAULT NOW(),
  ultima_actualizacion TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_rut, cluster_id)
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_customer_clusters_rut ON public.customer_clusters(customer_rut);
CREATE INDEX IF NOT EXISTS idx_customer_clusters_cluster_id ON public.customer_clusters(cluster_id);
CREATE INDEX IF NOT EXISTS idx_customer_clusters_cluster_name ON public.customer_clusters(cluster_name);
CREATE INDEX IF NOT EXISTS idx_customer_clusters_customer_type ON public.customer_clusters(customer_type);

-- Tabla de metadatos de clusters
CREATE TABLE IF NOT EXISTS public.cluster_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id INT NOT NULL UNIQUE,
  cluster_name TEXT NOT NULL,
  cluster_description TEXT,

  -- Estadísticas del cluster
  customer_count INT DEFAULT 0,
  avg_purchase_value NUMERIC,
  total_purchases NUMERIC,
  sectors JSONB, -- array de sectores predominantes
  regions JSONB, -- array de regiones predominantes

  -- Características identificadas por IA
  key_characteristics TEXT,
  recommended_messaging TEXT, -- Sugerencia de cómo dirigirse a este cluster

  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  ultima_actualizacion TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de auditoría para clustering
CREATE TABLE IF NOT EXISTS public.clustering_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_clustering TIMESTAMPTZ DEFAULT NOW(),
  clientes_procesados INT,
  clusters_generados INT,
  tiempo_segundos INT,
  status TEXT, -- 'success', 'error', 'partial'
  detalles JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clustering_log_fecha ON public.clustering_log(fecha_clustering);

-- RLS Policies
ALTER TABLE public.customer_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cluster_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clustering_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "allow_read_customer_clusters" ON public.customer_clusters
  FOR SELECT USING (true);

CREATE POLICY "allow_read_cluster_metadata" ON public.cluster_metadata
  FOR SELECT USING (true);

CREATE POLICY "allow_read_clustering_log" ON public.clustering_log
  FOR SELECT USING (true);

-- Service role can insert/update
CREATE POLICY "allow_service_role_customer_clusters" ON public.customer_clusters
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "allow_service_role_cluster_metadata" ON public.cluster_metadata
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "allow_service_role_clustering_log" ON public.clustering_log
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
