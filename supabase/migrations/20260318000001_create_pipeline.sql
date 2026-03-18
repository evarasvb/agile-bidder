-- Pipeline table: tracks opportunities through procurement lifecycle stages
-- 8 stages: descubierta → seguimiento → preparacion → postulada → evaluacion → adjudicada → oc_emitida → pagada

CREATE TYPE public.pipeline_etapa AS ENUM (
  'descubierta',
  'seguimiento',
  'preparacion',
  'postulada',
  'evaluacion',
  'adjudicada',
  'oc_emitida',
  'pagada'
);

CREATE TABLE public.pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Opportunity reference (polymorphic: compra_agil or licitacion)
  oportunidad_id TEXT NOT NULL,
  oportunidad_tipo TEXT NOT NULL DEFAULT 'compra_agil' CHECK (oportunidad_tipo IN ('compra_agil', 'licitacion', 'manual')),

  -- Pipeline stage
  etapa pipeline_etapa NOT NULL DEFAULT 'descubierta',

  -- Opportunity snapshot (denormalized for card display)
  titulo TEXT NOT NULL,
  institucion TEXT,
  monto_estimado NUMERIC(15,2),
  fecha_cierre TIMESTAMPTZ,
  match_score INTEGER DEFAULT 0,

  -- Pipeline-specific fields
  notas TEXT,
  archivos JSONB DEFAULT '[]'::jsonb,
  asignado_a UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Stage history: [{etapa, fecha, usuario_id}]
  etapa_historial JSONB DEFAULT '[]'::jsonb,

  -- Sort order within a column
  posicion INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate entries for same opportunity per user
  UNIQUE(user_id, oportunidad_id, oportunidad_tipo)
);

-- Indexes for common queries
CREATE INDEX idx_pipeline_user_id ON public.pipeline(user_id);
CREATE INDEX idx_pipeline_etapa ON public.pipeline(etapa);
CREATE INDEX idx_pipeline_user_etapa ON public.pipeline(user_id, etapa);
CREATE INDEX idx_pipeline_oportunidad ON public.pipeline(oportunidad_id, oportunidad_tipo);
CREATE INDEX idx_pipeline_asignado ON public.pipeline(asignado_a);
CREATE INDEX idx_pipeline_fecha_cierre ON public.pipeline(fecha_cierre);

-- Enable RLS
ALTER TABLE public.pipeline ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only see/manage their own pipeline items
CREATE POLICY "Users can view own pipeline"
  ON public.pipeline
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pipeline"
  ON public.pipeline
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pipeline"
  ON public.pipeline
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pipeline"
  ON public.pipeline
  FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at trigger
DROP TRIGGER IF EXISTS update_pipeline_updated_at ON public.pipeline;
CREATE TRIGGER update_pipeline_updated_at
  BEFORE UPDATE ON public.pipeline
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.pipeline IS 'Pipeline de oportunidades de licitación con etapas Kanban';
COMMENT ON COLUMN public.pipeline.etapa IS 'Etapa actual en el pipeline (enum de 8 etapas)';
COMMENT ON COLUMN public.pipeline.etapa_historial IS 'Historial de cambios de etapa [{etapa, fecha, usuario_id}]';
COMMENT ON COLUMN public.pipeline.oportunidad_tipo IS 'Tipo: compra_agil, licitacion, o manual';
