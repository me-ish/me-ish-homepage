-- Helper function: look up auth user ID by email (used in admin approve route)
CREATE OR REPLACE FUNCTION get_auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, pg_temp
AS $$
  SELECT id FROM auth.users WHERE email = p_email LIMIT 1;
$$;
