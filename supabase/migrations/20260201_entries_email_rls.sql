-- Allow authenticated users to select their own entries by email
-- This is needed because entries may not have user_id set (legacy entries)
-- but they do have email which matches the authenticated user's email

CREATE POLICY entries_select_by_email
  ON entries
  FOR SELECT
  TO authenticated
  USING (email = auth.email());

-- Add comment explaining the policy
COMMENT ON POLICY entries_select_by_email ON entries IS
  'Allows authenticated users to view their entries by matching email address. This supplements entries_select_own for cases where user_id is not set.';
