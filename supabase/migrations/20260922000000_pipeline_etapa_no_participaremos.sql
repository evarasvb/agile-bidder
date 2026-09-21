-- Nueva etapa de pipeline: decisión de NO presentarse a una oportunidad.
-- Distinta de 'perdida' (se participó y no se ganó): aquí se decide no participar.
ALTER TYPE public.pipeline_etapa ADD VALUE IF NOT EXISTS 'no_participaremos';
