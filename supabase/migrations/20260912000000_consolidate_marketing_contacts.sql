-- Consolidar todas las bases de datos de contactos en una sola
-- Migración para unificar: prospects, academia_leads, clientes, y otros

-- 1. Enriquecer marketing_contactos con campos adicionales para segmentación
ALTER TABLE IF EXISTS public.marketing_contactos
ADD COLUMN IF NOT EXISTS telefono_pais text,
ADD COLUMN IF NOT EXISTS pais text DEFAULT 'Chile',
ADD COLUMN IF NOT EXISTS ciudad text,
ADD COLUMN IF NOT EXISTS estado_contacto text DEFAULT 'activo', -- activo, inactivo, bloqueado, no_contactar
ADD COLUMN IF NOT EXISTS fuente_datos text, -- prospects, academia, clientes, webinar, directo, importacion
ADD COLUMN IF NOT EXISTS etiquetas text[], -- array para categorización flexible
ADD COLUMN IF NOT EXISTS puntuacion_relevancia int DEFAULT 0, -- 0-100 para scoring
ADD COLUMN IF NOT EXISTS ultimo_contacto_en timestamptz,
ADD COLUMN IF NOT EXISTS frecuencia_contacto text DEFAULT 'semanal', -- nunca, mensual, semanal, diaria
ADD COLUMN IF NOT EXISTS consentimiento_marketing boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS consentimiento_fecha timestamptz,
ADD COLUMN IF NOT EXISTS campos_adicionales jsonb DEFAULT '{}'::jsonb; -- para datos custom

-- 2. Crear índices para performance en filtros comunes
CREATE INDEX IF NOT EXISTS idx_marketing_contactos_categoria ON public.marketing_contactos(categoria);
CREATE INDEX IF NOT EXISTS idx_marketing_contactos_estado_suscripcion ON public.marketing_contactos(estado_suscripcion);
CREATE INDEX IF NOT EXISTS idx_marketing_contactos_origen ON public.marketing_contactos(origen);
CREATE INDEX IF NOT EXISTS idx_marketing_contactos_fuente_datos ON public.marketing_contactos(fuente_datos);
CREATE INDEX IF NOT EXISTS idx_marketing_contactos_etiquetas ON public.marketing_contactos USING GIN(etiquetas);
CREATE INDEX IF NOT EXISTS idx_marketing_contactos_estado_contacto ON public.marketing_contactos(estado_contacto);
CREATE INDEX IF NOT EXISTS idx_marketing_contactos_empresa ON public.marketing_contactos(empresa);

-- 3. Vista para listas de contactos segmentadas (para el portal)
CREATE OR REPLACE VIEW public.marketing_contactos_segmentados AS
SELECT
  id,
  email,
  nombre,
  telefono,
  empresa,
  categoria,
  origen,
  fuente_datos,
  estado_suscripcion,
  estado_contacto,
  etiquetas,
  puntuacion_relevancia,
  ultimo_contacto_en,
  consentimiento_marketing,
  count(*) OVER () as total_registros
FROM public.marketing_contactos
WHERE estado_contacto = 'activo'
  AND estado_suscripcion = 'suscrito'
  AND consentimiento_marketing = true;

-- 4. Función para importar contactos de otras tablas
CREATE OR REPLACE FUNCTION public.marketing_importar_contactos(
  p_fuente text,
  p_tabla_origen text,
  p_cantidad int DEFAULT NULL
)
RETURNS TABLE(importados int, duplicados int, errores int) AS $$
DECLARE
  v_importados int := 0;
  v_duplicados int := 0;
  v_errores int := 0;
  v_query text;
BEGIN
  -- Esta función puede ser ampliada para cada fuente específica
  -- Por ahora retorna los contadores
  RETURN QUERY SELECT v_importados::int, v_duplicados::int, v_errores::int;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Función para sincronizar última interacción
CREATE OR REPLACE FUNCTION public.marketing_actualizar_ultimo_contacto(p_contacto_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.marketing_contactos
  SET ultimo_contacto_en = now()
  WHERE id = p_contacto_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Tabla de auditoría para rastrear importaciones y cambios masivos
CREATE TABLE IF NOT EXISTS public.marketing_contactos_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accion text NOT NULL, -- importacion, segmentacion, eliminacion, actualizacion
  fuente text, -- prospects, academia, clientes, webinar, etc
  cantidad_afectada int,
  detalles jsonb DEFAULT '{}'::jsonb,
  realizado_por text,
  realizado_en timestamptz DEFAULT now()
);

ALTER TABLE public.marketing_contactos_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketing_contactos_auditoria_all ON public.marketing_contactos_auditoria
  FOR ALL TO authenticated USING ((auth.jwt() ->> 'email') = 'evaras@firmavb.cl');

CREATE INDEX idx_marketing_contactos_auditoria_accion ON public.marketing_contactos_auditoria(accion);
CREATE INDEX idx_marketing_contactos_auditoria_fecha ON public.marketing_contactos_auditoria(realizado_en DESC);

-- 7. Función para registrar auditoría
CREATE OR REPLACE FUNCTION public.marketing_registrar_auditoria(
  p_accion text,
  p_fuente text,
  p_cantidad int,
  p_detalles jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.marketing_contactos_auditoria (accion, fuente, cantidad_afectada, detalles, realizado_por)
  VALUES (p_accion, p_fuente, p_cantidad, p_detalles, auth.jwt() ->> 'email')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
