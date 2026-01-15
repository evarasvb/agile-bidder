-- Agregar campo buen_pagador a compras_agiles
-- Este campo indica si el organismo tiene historial de pago confiable

ALTER TABLE public.compras_agiles
ADD COLUMN IF NOT EXISTS buen_pagador BOOLEAN DEFAULT NULL;

-- Agregar comentario al campo
COMMENT ON COLUMN public.compras_agiles.buen_pagador IS 'Indica si el organismo tiene historial de pago confiable (true = buen pagador, false = mal pagador, NULL = desconocido)';

-- Crear índice para búsquedas rápidas por buen_pagador
CREATE INDEX IF NOT EXISTS idx_compras_agiles_buen_pagador 
ON public.compras_agiles(buen_pagador) 
WHERE buen_pagador IS NOT NULL;

-- Función para actualizar buen_pagador basado en historial de órdenes de compra
-- (Se puede usar para calcular automáticamente basado en historial de pagos)
CREATE OR REPLACE FUNCTION public.calcular_buen_pagador(organismo_nombre TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  promedio_dias_pago NUMERIC;
  total_ordenes INTEGER;
BEGIN
  -- Calcular promedio de días de pago basado en órdenes de compra
  SELECT 
    AVG(EXTRACT(DAY FROM (fecha_aceptacion - fecha_envio))),
    COUNT(*)
  INTO promedio_dias_pago, total_ordenes
  FROM public.ordenes_compra
  WHERE institucion_nombre = organismo_nombre
    AND fecha_aceptacion IS NOT NULL
    AND fecha_envio IS NOT NULL;
  
  -- Si hay menos de 3 órdenes, no hay suficiente data
  IF total_ordenes < 3 THEN
    RETURN NULL;
  END IF;
  
  -- Si el promedio de días de pago es <= 30, es buen pagador
  -- Si es > 60, es mal pagador
  IF promedio_dias_pago <= 30 THEN
    RETURN TRUE;
  ELSIF promedio_dias_pago > 60 THEN
    RETURN FALSE;
  ELSE
    RETURN NULL; -- Neutral
  END IF;
END;
$$ LANGUAGE plpgsql;
