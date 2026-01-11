-- Add new columns to cliente_notificaciones for granular alert settings
ALTER TABLE public.cliente_notificaciones
ADD COLUMN IF NOT EXISTS alerta_nuevos_matches BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS alerta_cierre_proximo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS alerta_cambios_guardadas BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS horas_antes_cierre INTEGER DEFAULT 48,
ADD COLUMN IF NOT EXISTS score_minimo_alerta INTEGER DEFAULT 70;

-- Create notification log table to track sent notifications
CREATE TABLE IF NOT EXISTS public.notificaciones_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  licitacion_id TEXT,
  email_enviado BOOLEAN DEFAULT false,
  datos JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on notificaciones_log
ALTER TABLE public.notificaciones_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notificaciones_log
CREATE POLICY "Clients can view their own notification logs"
ON public.notificaciones_log FOR SELECT
USING (cliente_id IN (
  SELECT id FROM public.clientes WHERE id = cliente_id
));

CREATE POLICY "System can insert notification logs"
ON public.notificaciones_log FOR INSERT
WITH CHECK (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_notificaciones_log_cliente_id ON public.notificaciones_log(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_log_created_at ON public.notificaciones_log(created_at DESC);