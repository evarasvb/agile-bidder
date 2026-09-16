-- La tabla marketing_control_center (20260909000000) nunca se había aplicado en
-- producción, y el diálogo "Nueva Campaña" con IA (#251) ya guardaba canal_primario
-- en marketing_campanas y hashtags/imagen_url en marketing_piezas sin que esas
-- columnas existieran, causando "Error: Desconocido" al crear cualquier campaña.
alter table public.marketing_campanas add column if not exists canal_primario text;
alter table public.marketing_piezas add column if not exists hashtags text;
alter table public.marketing_piezas add column if not exists imagen_url text;
