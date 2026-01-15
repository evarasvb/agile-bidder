-- Add INSERT policy for compras_agiles table
-- This allows the pending-sync server and authenticated users to insert compras ágiles data

-- Policy for authenticated users to insert
-- Service role bypasses RLS, so it can insert without this policy
-- But this allows authenticated users to insert as well
CREATE POLICY "Users can insert compras_agiles"
  ON public.compras_agiles
  FOR INSERT
  WITH CHECK (true);
