-- El tablero de Postulaciones (pipelineConstants.ts) ya tiene una columna "Perdida"
-- en la interfaz desde hace tiempo, pero el enum pipeline_etapa nunca la incluyó:
-- mover una tarjeta ahí fallaba en la base de datos (violación del enum). El código
-- lo escondía con un cast a `any` en el update.
alter type public.pipeline_etapa add value if not exists 'perdida';
