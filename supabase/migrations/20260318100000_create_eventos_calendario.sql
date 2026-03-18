-- Create tipo_evento_calendario enum
CREATE TYPE public.tipo_evento_calendario AS ENUM (
  'cierre',
  'adjudicacion',
  'tarea',
  'recordatorio',
  'otro'
);

-- Create repetir_evento enum
CREATE TYPE public.repetir_evento AS ENUM (
  'none',
  'daily',
  'weekly',
  'monthly'
);

-- Create eventos_calendario table
CREATE TABLE public.eventos_calendario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  tipo public.tipo_evento_calendario NOT NULL DEFAULT 'otro',
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ,
  todo_el_dia BOOLEAN NOT NULL DEFAULT false,
  oportunidad_id UUID,
  oportunidad_tipo TEXT CHECK (oportunidad_tipo IN ('licitacion', 'compra_agil', 'pipeline')),
  asignado_a UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  repetir public.repetir_evento NOT NULL DEFAULT 'none',
  recordatorio_minutos INTEGER,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.eventos_calendario ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own events"
  ON public.eventos_calendario FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own events"
  ON public.eventos_calendario FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
  ON public.eventos_calendario FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events"
  ON public.eventos_calendario FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_eventos_calendario_user_fecha ON public.eventos_calendario(user_id, fecha_inicio);
CREATE INDEX idx_eventos_calendario_tipo ON public.eventos_calendario(tipo);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_eventos_calendario_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_eventos_calendario_timestamp
  BEFORE UPDATE ON public.eventos_calendario
  FOR EACH ROW
  EXECUTE FUNCTION public.update_eventos_calendario_updated_at();
