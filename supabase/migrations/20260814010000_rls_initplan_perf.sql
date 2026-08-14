-- PERFORMANCE: las políticas RLS re-evaluaban auth.uid()/auth.role()/auth.jwt()
-- UNA VEZ POR FILA (advisor `auth_rls_initplan`, 141 casos). En tablas de miles de
-- filas (compras_agiles, cliente_inventario, licitaciones_bi, clientes, etc.) esto
-- es una causa directa de lentitud.
--
-- El arreglo es el recomendado por Supabase y NO cambia el comportamiento: envolver
-- la llamada en un subselect escalar — `auth.uid()` -> `(select auth.uid())` — para
-- que el planner la evalúe una sola vez (initPlan) en lugar de por cada fila.
--
-- Se recorren todas las políticas del esquema public que todavía tienen la llamada
-- "desnuda", se transforma la expresión y se re-aplica con ALTER POLICY. Es atómico:
-- si algo fallara, la transacción revierte sin dejar políticas a medias.

DO $$
DECLARE
  r record;
  nq text;
  nc text;
  stmt text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual       IS NOT NULL AND qual       ~ 'auth\.(uid|role|jwt)\(\)' AND lower(qual)       !~ 'select auth\.')
        OR (with_check IS NOT NULL AND with_check ~ 'auth\.(uid|role|jwt)\(\)' AND lower(with_check) !~ 'select auth\.')
      )
  LOOP
    nq := r.qual;
    nc := r.with_check;

    IF nq IS NOT NULL AND lower(nq) !~ 'select auth\.' THEN
      nq := regexp_replace(nq, 'auth\.uid\(\)',  '(select auth.uid())',  'g');
      nq := regexp_replace(nq, 'auth\.role\(\)', '(select auth.role())', 'g');
      nq := regexp_replace(nq, 'auth\.jwt\(\)',  '(select auth.jwt())',  'g');
    END IF;

    IF nc IS NOT NULL AND lower(nc) !~ 'select auth\.' THEN
      nc := regexp_replace(nc, 'auth\.uid\(\)',  '(select auth.uid())',  'g');
      nc := regexp_replace(nc, 'auth\.role\(\)', '(select auth.role())', 'g');
      nc := regexp_replace(nc, 'auth\.jwt\(\)',  '(select auth.jwt())',  'g');
    END IF;

    stmt := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF r.qual       IS NOT NULL THEN stmt := stmt || format(' USING (%s)', nq); END IF;
    IF r.with_check IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)', nc); END IF;

    EXECUTE stmt;
  END LOOP;
END $$;
