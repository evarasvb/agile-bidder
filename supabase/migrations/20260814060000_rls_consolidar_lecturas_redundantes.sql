-- PERFORMANCE: quitar políticas de LECTURA (SELECT) redundantes que el advisor
-- `multiple_permissive_policies` marca. Cada DROP se eligió porque OTRA política
-- que se mantiene ya concede el MISMO o MAYOR acceso de lectura, así que el
-- "quién ve qué" queda EXACTAMENTE igual — sólo se evalúan menos políticas por
-- consulta.

-- compras_agiles: "Allow public read" (public, USING true) ya deja leer a todos.
-- Las dos de "authenticated" son un subconjunto redundante.
drop policy if exists "Authenticated users can view all compras_agiles" on public.compras_agiles;
drop policy if exists "compras_agiles_select_authenticated" on public.compras_agiles;

-- instituciones: "auth_select" (authenticated, true) y "Usuarios autenticados..."
-- (public, auth.uid() IS NOT NULL) conceden lo mismo (lectura a logueados). Se
-- deja "auth_select".
drop policy if exists "Usuarios autenticados pueden ver instituciones" on public.instituciones;

-- licitaciones: "Enable all for authenticated users" (public, USING true) ya deja
-- leer a todos; la de SELECT sólo-logueados es un subconjunto redundante.
drop policy if exists "Authenticated users can view licitaciones" on public.licitaciones;

-- ordenes_compra: "Users can view ordenes_compra" (public, true) ya deja leer a
-- todos; "Usuarios autenticados..." es un subconjunto redundante.
drop policy if exists "Usuarios autenticados pueden ver órdenes de compra" on public.ordenes_compra;
