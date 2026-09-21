-- Aplicada directo a la base por otra sesión (sin dejar el archivo en el repo).
-- Índice para la FK evaristo_acciones.conversacion_id -> evaristo_conversaciones.
CREATE INDEX IF NOT EXISTS idx_evaristo_acciones_conversacion_id ON public.evaristo_acciones (conversacion_id);
