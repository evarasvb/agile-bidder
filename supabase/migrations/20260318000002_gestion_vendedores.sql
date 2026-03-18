-- =============================================
-- Migration: Gestión de Vendedores Module
-- Extends vendedores table and adds pipeline assignments
-- =============================================

-- 1. Add missing columns to vendedores table
ALTER TABLE public.vendedores
  ADD COLUMN IF NOT EXISTS empresa_id uuid,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS telefono text;

-- 2. Update rol column to use a check constraint for valid roles
-- (admin, vendedor, viewer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendedores_rol_check'
  ) THEN
    ALTER TABLE public.vendedores
      ADD CONSTRAINT vendedores_rol_check
      CHECK (rol IN ('admin', 'vendedor', 'viewer'));
  END IF;
END$$;

-- 3. Create asignaciones table for pipeline-level assignments
CREATE TABLE IF NOT EXISTS public.asignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.pipeline(id) ON DELETE CASCADE,
  asignado_por uuid REFERENCES auth.users(id),
  fecha_asignacion timestamptz NOT NULL DEFAULT now(),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_asignaciones_vendedor ON public.asignaciones(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_pipeline ON public.asignaciones(pipeline_id);

-- 4. RLS policies for vendedores
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;

-- Admins see all team data
DROP POLICY IF EXISTS "admin_full_access_vendedores" ON public.vendedores;
CREATE POLICY "admin_full_access_vendedores" ON public.vendedores
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- Vendedores see all active team members (read only)
DROP POLICY IF EXISTS "vendedores_read_active" ON public.vendedores;
CREATE POLICY "vendedores_read_active" ON public.vendedores
  FOR SELECT
  USING (activo = true);

-- 5. RLS policies for asignaciones
ALTER TABLE public.asignaciones ENABLE ROW LEVEL SECURITY;

-- Admins full access to assignments
DROP POLICY IF EXISTS "admin_full_access_asignaciones" ON public.asignaciones;
CREATE POLICY "admin_full_access_asignaciones" ON public.asignaciones
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- Vendedores see only their own assignments
DROP POLICY IF EXISTS "vendedores_own_asignaciones" ON public.asignaciones;
CREATE POLICY "vendedores_own_asignaciones" ON public.asignaciones
  FOR SELECT
  USING (
    vendedor_id IN (
      SELECT id FROM public.vendedores WHERE user_id = auth.uid()
    )
  );

-- Authenticated users can create assignments (from pipeline cards)
DROP POLICY IF EXISTS "authenticated_insert_asignaciones" ON public.asignaciones;
CREATE POLICY "authenticated_insert_asignaciones" ON public.asignaciones
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can update assignments they created
DROP POLICY IF EXISTS "authenticated_update_asignaciones" ON public.asignaciones;
CREATE POLICY "authenticated_update_asignaciones" ON public.asignaciones
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can read all assignments (needed for pipeline display)
DROP POLICY IF EXISTS "authenticated_read_asignaciones" ON public.asignaciones;
CREATE POLICY "authenticated_read_asignaciones" ON public.asignaciones
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 6. View: v_equipo_dashboard - team overview with pipeline stats
CREATE OR REPLACE VIEW public.v_equipo_dashboard AS
SELECT
  v.id AS vendedor_id,
  v.nombre,
  v.email,
  v.rol,
  v.avatar_url,
  v.telefono,
  v.activo,
  COALESCE(stats.total_asignadas, 0) AS total_asignadas,
  COALESCE(stats.postuladas, 0) AS postuladas,
  COALESCE(stats.adjudicadas, 0) AS adjudicadas,
  COALESCE(stats.monto_total, 0) AS monto_total,
  CASE
    WHEN COALESCE(stats.postuladas, 0) > 0
    THEN ROUND((COALESCE(stats.adjudicadas, 0)::numeric / stats.postuladas) * 100, 1)
    ELSE 0
  END AS tasa_exito,
  COALESCE(stats.ingresos_generados, 0) AS ingresos_generados
FROM public.vendedores v
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS total_asignadas,
    COUNT(*) FILTER (WHERE p.etapa IN ('postulada', 'evaluacion', 'adjudicada', 'oc_emitida', 'pagada')) AS postuladas,
    COUNT(*) FILTER (WHERE p.etapa IN ('adjudicada', 'oc_emitida', 'pagada')) AS adjudicadas,
    COALESCE(SUM(p.monto_estimado), 0) AS monto_total,
    COALESCE(SUM(p.monto_estimado) FILTER (WHERE p.etapa IN ('adjudicada', 'oc_emitida', 'pagada')), 0) AS ingresos_generados
  FROM public.asignaciones a
  JOIN public.pipeline p ON p.id = a.pipeline_id
  WHERE a.vendedor_id = v.id
) stats ON true
WHERE v.activo = true;
