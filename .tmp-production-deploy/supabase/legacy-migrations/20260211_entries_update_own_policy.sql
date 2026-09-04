-- Allow authenticated users to UPDATE their own entries (consent toggles, portfolio_hidden, etc.)
DROP POLICY IF EXISTS entries_update_own ON public.entries;
CREATE POLICY entries_update_own
  ON public.entries
  FOR UPDATE
  TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
