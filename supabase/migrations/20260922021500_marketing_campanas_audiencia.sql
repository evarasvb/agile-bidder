-- Cada campaña define SU PROPIA audiencia (no todas son para todos): antes el
-- filtro de "Gestión de Contactos" era un estado local de la pantalla, y CUALQUIER
-- campaña que se enviara usaba ese mismo filtro suelto sin relación con la campaña.
alter table public.marketing_campanas
  add column if not exists audiencia_fuente text,
  add column if not exists audiencia_rubro text,
  add column if not exists audiencia_categoria text,
  add column if not exists audiencia_suscripcion text;
