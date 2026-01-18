-- Fix 1: Recreate calendario_eventos view with security_invoker = on
-- This ensures the view respects RLS policies of the querying user

DROP VIEW IF EXISTS public.calendario_eventos;

CREATE VIEW public.calendario_eventos
WITH (security_invoker = on) AS
SELECT lb.codigo,
    lb.nombre,
    lb.institucion_nombre,
    lb.presupuesto_estimado,
    lb.fecha_cierre AS fecha_evento,
    'licitacion'::text AS tipo_proceso,
    'cierre'::text AS tipo_evento
   FROM licitaciones_bi lb
  WHERE lb.fecha_cierre >= now()
UNION ALL
 SELECT ca.codigo::text AS codigo,
    ca.nombre,
    ca.organismo AS institucion_nombre,
    ca.monto AS presupuesto_estimado,
    ca.fecha_cierre AS fecha_evento,
    'compra_agil'::text AS tipo_proceso,
    'cierre'::text AS tipo_evento
   FROM compras_agiles ca
  WHERE ca.fecha_cierre >= now();

-- Fix 2: Add admin SELECT policy to clientes table
-- This allows admins to view all clients while regular users can only see their own

-- Drop existing admin policy if it exists
DROP POLICY IF EXISTS "Admins can view all clientes" ON public.clientes;

-- Create admin policy for viewing all clients
CREATE POLICY "Admins can view all clientes"
ON public.clientes
FOR SELECT
USING (is_admin());

-- Fix 3: Add constraint to prevent null user_id on clientes
-- First update any existing null values (if any) - then add NOT NULL constraint
-- We already confirmed no null values exist

ALTER TABLE public.clientes 
ALTER COLUMN user_id SET NOT NULL;