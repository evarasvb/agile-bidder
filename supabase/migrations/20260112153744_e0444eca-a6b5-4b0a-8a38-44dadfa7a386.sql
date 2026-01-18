-- Create extension_api_keys table for Chrome extension authentication
CREATE TABLE IF NOT EXISTS public.extension_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL DEFAULT 'API Key',
  activa BOOLEAN NOT NULL DEFAULT true,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_extension_api_keys_api_key ON public.extension_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_extension_api_keys_cliente ON public.extension_api_keys(cliente_id);

-- Enable RLS
ALTER TABLE public.extension_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only client owner can manage their keys
CREATE POLICY "Clients can view their own API keys"
  ON public.extension_api_keys
  FOR SELECT
  USING (
    cliente_id IN (
      SELECT id FROM public.clientes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can create their own API keys"
  ON public.extension_api_keys
  FOR INSERT
  WITH CHECK (
    cliente_id IN (
      SELECT id FROM public.clientes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update their own API keys"
  ON public.extension_api_keys
  FOR UPDATE
  USING (
    cliente_id IN (
      SELECT id FROM public.clientes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can delete their own API keys"
  ON public.extension_api_keys
  FOR DELETE
  USING (
    cliente_id IN (
      SELECT id FROM public.clientes WHERE user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_extension_api_keys_updated_at
  BEFORE UPDATE ON public.extension_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Table for logging extension activity
CREATE TABLE IF NOT EXISTS public.extension_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES public.extension_api_keys(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  licitacion_id TEXT,
  oferta_id UUID,
  detalles JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for activity lookups
CREATE INDEX IF NOT EXISTS idx_extension_activity_cliente ON public.extension_activity_log(cliente_id);
CREATE INDEX IF NOT EXISTS idx_extension_activity_created ON public.extension_activity_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.extension_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS: Only client can view their activity
CREATE POLICY "Clients can view their own activity"
  ON public.extension_activity_log
  FOR SELECT
  USING (
    cliente_id IN (
      SELECT id FROM public.clientes WHERE user_id = auth.uid()
    )
  );