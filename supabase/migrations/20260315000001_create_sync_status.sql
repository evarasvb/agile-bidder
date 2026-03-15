-- Tabla para monitorear el estado de sincronizaciones automáticas
CREATE TABLE IF NOT EXISTS sync_status (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type text NOT NULL UNIQUE,
  last_sync_at timestamptz,
  fecha_consulta text,
  licitaciones_status text,
  licitaciones_synced integer DEFAULT 0,
  ordenes_status text,
  ordenes_synced integer DEFAULT 0,
  last_failure_at timestamptz,
  last_failure_message text,
  run_id text,
  run_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índice para búsquedas rápidas por tipo
CREATE INDEX IF NOT EXISTS idx_sync_status_type ON sync_status(sync_type);

-- Insertar registro inicial para mercadopublico
INSERT INTO sync_status (sync_type) VALUES ('mercadopublico')
ON CONFLICT (sync_type) DO NOTHING;
