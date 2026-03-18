-- ============================================================================
-- Migration: matches_v2 - Item-level matching engine
-- Date: 2026-03-18
-- Description: Creates matches table for storing item-level matching results
--              between opportunities (licitaciones/compras_agiles) and inventory
-- ============================================================================

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Opportunity reference (polymorphic: licitacion or compra_agil)
  oportunidad_id TEXT NOT NULL,
  oportunidad_tipo TEXT NOT NULL CHECK (oportunidad_tipo IN ('licitacion', 'compra_agil')),

  -- Match results
  match_score INTEGER NOT NULL DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
  items_matched JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- items_matched structure: [{
  --   item_id: string,
  --   item_nombre: string,
  --   item_cantidad: number,
  --   item_unidad: string,
  --   inventory_id: string,
  --   inventory_sku: string,
  --   inventory_nombre: string,
  --   match_score: number (0-100),
  --   match_type: 'exact' | 'partial' | 'keyword' | 'fuzzy' | 'category',
  --   matched_terms: string[],
  --   precio_inventario: number,
  --   precio_sugerido: number,
  --   margen_aplicado: number
  -- }]

  -- Price suggestion
  precio_sugerido NUMERIC(15,2) DEFAULT 0,

  -- Status workflow
  estado TEXT NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'revisado', 'descartado', 'en_proceso', 'ofertado')),

  -- Buyer intelligence data
  comprador_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- comprador_info structure: {
  --   institucion_nombre: string,
  --   institucion_rut: string | null,
  --   departamento: string | null,
  --   region: string | null,
  --   historial_compras: number,
  --   buen_pagador: boolean | null,
  --   oportunidades_previas: number,
  --   monto_historico: number
  -- }

  -- Metadata
  score_breakdown JSONB DEFAULT '{}'::jsonb,
  -- score_breakdown structure: {
  --   nombre_similarity: number (0-100, weight: 40%),
  --   category_match: number (0-100, weight: 30%),
  --   historical_success: number (0-100, weight: 15%),
  --   price_competitiveness: number (0-100, weight: 15%)
  -- }

  confidence_level TEXT DEFAULT 'low' CHECK (confidence_level IN ('high', 'medium', 'low')),
  items_coverage NUMERIC(5,2) DEFAULT 0, -- % of opportunity items matched

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_matches_user_id ON matches(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_oportunidad ON matches(oportunidad_id, oportunidad_tipo);
CREATE INDEX IF NOT EXISTS idx_matches_score ON matches(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_matches_estado ON matches(estado);
CREATE INDEX IF NOT EXISTS idx_matches_created ON matches(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_unique_opportunity
  ON matches(user_id, oportunidad_id, oportunidad_tipo);

-- GIN index on JSONB columns for querying within items_matched
CREATE INDEX IF NOT EXISTS idx_matches_items_gin ON matches USING gin(items_matched);
CREATE INDEX IF NOT EXISTS idx_matches_comprador_gin ON matches USING gin(comprador_info);

-- Enable RLS
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own matches"
  ON matches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own matches"
  ON matches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own matches"
  ON matches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own matches"
  ON matches FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can do anything (for edge functions / triggers)
CREATE POLICY "Service role full access on matches"
  ON matches FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_matches_updated_at();

-- ============================================================================
-- Function: match_opportunities_on_sync
-- Triggered when new licitaciones or compras_agiles are inserted
-- Calls the match-opportunities edge function
-- ============================================================================

-- Notify function for new opportunities (used by trigger)
CREATE OR REPLACE FUNCTION notify_new_opportunity()
RETURNS TRIGGER AS $$
BEGIN
  -- Use pg_notify to signal that new opportunities are available for matching
  PERFORM pg_notify(
    'new_opportunity',
    json_build_object(
      'table', TG_TABLE_NAME,
      'id', CASE
        WHEN TG_TABLE_NAME = 'licitaciones' THEN NEW.id_licitacion
        ELSE NEW.id::text
      END,
      'tipo', CASE
        WHEN TG_TABLE_NAME = 'licitaciones' THEN 'licitacion'
        ELSE 'compra_agil'
      END,
      'timestamp', now()
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on licitaciones insert
DROP TRIGGER IF EXISTS trigger_match_new_licitacion ON licitaciones;
CREATE TRIGGER trigger_match_new_licitacion
  AFTER INSERT ON licitaciones
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_opportunity();

-- Trigger on compras_agiles insert
DROP TRIGGER IF EXISTS trigger_match_new_compra_agil ON compras_agiles;
CREATE TRIGGER trigger_match_new_compra_agil
  AFTER INSERT ON compras_agiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_opportunity();
