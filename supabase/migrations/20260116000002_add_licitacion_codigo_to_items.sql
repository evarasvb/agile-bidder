-- Agregar licitacion_codigo e item_index a licitacion_items para soportar compras ágiles
-- Esto permite relacionar items directamente con el código de la licitación/compra ágil
-- sin necesidad de tener un registro en la tabla licitaciones

ALTER TABLE public.licitacion_items
ADD COLUMN IF NOT EXISTS licitacion_codigo TEXT,
ADD COLUMN IF NOT EXISTS item_index INTEGER;

-- Crear índice para búsquedas rápidas por código
CREATE INDEX IF NOT EXISTS idx_licitacion_items_codigo 
ON public.licitacion_items(licitacion_codigo);

CREATE INDEX IF NOT EXISTS idx_licitacion_items_codigo_index 
ON public.licitacion_items(licitacion_codigo, item_index);

-- Comentarios para documentación
COMMENT ON COLUMN public.licitacion_items.licitacion_codigo IS 'Código de la licitación/compra ágil (puede ser diferente de licitacion_id)';
COMMENT ON COLUMN public.licitacion_items.item_index IS 'Índice del item dentro de la licitación (para mantener orden)';
