-- Eliminar las políticas RESTRICTIVE existentes
DROP POLICY IF EXISTS "Admins can manage compras_agiles" ON public.compras_agiles;
DROP POLICY IF EXISTS "Authenticated users can view compras_agiles" ON public.compras_agiles;
DROP POLICY IF EXISTS "Users can update compras_agiles" ON public.compras_agiles;

-- Crear políticas PERMISSIVE (por defecto) para acceso público de lectura
-- Las compras ágiles son datos públicos de MercadoPúblico, todos deben poder verlos
CREATE POLICY "Anyone can view compras_agiles" 
ON public.compras_agiles 
FOR SELECT 
USING (true);

-- Solo usuarios autenticados pueden actualizar (para marcar matches)
CREATE POLICY "Authenticated users can update compras_agiles" 
ON public.compras_agiles 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Solo admins pueden insertar/eliminar
CREATE POLICY "Admins can insert compras_agiles" 
ON public.compras_agiles 
FOR INSERT 
WITH CHECK (is_admin());

CREATE POLICY "Admins can delete compras_agiles" 
ON public.compras_agiles 
FOR DELETE 
USING (is_admin());