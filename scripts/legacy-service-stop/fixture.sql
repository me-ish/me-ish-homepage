-- Synthetic authorization fixture. No production data, keys, or schema dump.
-- Broad client policies deliberately prove that the added restrictive policies
-- override an existing allow. This is not a full Supabase/application fixture.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA storage;
CREATE SCHEMA legacy_stop_test;
GRANT USAGE ON SCHEMA public, storage, legacy_stop_test TO anon, authenticated, service_role;

DO $fixture$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY[
    'entries', 'profiles', 'portfolio_settings', 'entry_comments', 'likes',
    'natori_projects', 'natori_user_profiles', 'artists_bank_accounts', 'sales'
  ] LOOP
    EXECUTE format('CREATE TABLE public.%I (id bigint PRIMARY KEY, payload text NOT NULL)', name);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated, service_role', name);
    EXECUTE format('CREATE POLICY fixture_existing_allow ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', name);
    EXECUTE format('INSERT INTO public.%I VALUES (1, %L)', name, 'existing');
  END LOOP;
  FOREACH name IN ARRAY ARRAY['aura_requests', 'aura_projects', 'card_requests', 'entry_view_events'] LOOP
    EXECUTE format('CREATE TABLE public.%I (id bigint PRIMARY KEY, payload text NOT NULL)', name);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', name);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', name);
    EXECUTE format('CREATE POLICY fixture_existing_read ON public.%I FOR SELECT TO anon, authenticated USING (true)', name);
    EXECUTE format('INSERT INTO public.%I VALUES (1, %L)', name, 'published');
  END LOOP;
END
$fixture$;

-- These reviewed roots have table INSERT privileges but their RLS rejects it.
-- CARD/AURA projects instead retain no client INSERT privilege above.
GRANT INSERT ON public.aura_requests, public.entry_view_events TO anon, authenticated;
CREATE POLICY fixture_existing_insert_deny ON public.aura_requests
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY fixture_existing_insert_deny ON public.entry_view_events
  FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE TABLE storage.buckets (id text PRIMARY KEY, public boolean NOT NULL);
CREATE TABLE storage.objects (
  id text PRIMARY KEY,
  bucket_id text NOT NULL REFERENCES storage.buckets(id),
  name text NOT NULL,
  payload text NOT NULL
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON storage.buckets TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated, service_role;
INSERT INTO storage.buckets VALUES
  ('artworks', true), ('avatars', true), ('banners', true),
  ('aura-assets', false), ('card-assets', false), ('gallery-entry-intake', false),
  ('processing-meta', false), ('natori-consultations', false),
  ('natori-deliveries', false), ('natori-inquiry-refs', false), ('natori-portfolio', true);
INSERT INTO storage.objects SELECT id || '/existing', id, 'existing', 'original bytes' FROM storage.buckets;
CREATE POLICY fixture_existing_read ON storage.objects FOR SELECT TO anon, authenticated
  USING (current_user = 'authenticated' OR bucket_id IN (SELECT id FROM storage.buckets WHERE public));
CREATE POLICY fixture_existing_insert ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY fixture_existing_update ON storage.objects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY fixture_existing_delete ON storage.objects FOR DELETE TO anon, authenticated USING (true);

-- Signatures, owner and explicit grants reproduce the reviewed ACL shape.
-- Bodies are small writing stand-ins, not production function definitions.
CREATE FUNCTION public.aura_claim_first20_free(text, uuid) RETURNS jsonb
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.aura_requests VALUES (2, $1) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload;
  SELECT '{"ok":true}'::jsonb;
$$;
CREATE FUNCTION public.aura_claim_meish_free(text, uuid) RETURNS jsonb
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.aura_projects VALUES (2, $1) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload;
  SELECT '{"ok":true}'::jsonb;
$$;
CREATE FUNCTION public.set_entry_portfolio_hidden(bigint, boolean) RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.entries SET payload = $2::text WHERE id = $1;
$$;
CREATE FUNCTION public.increment_entry_likes(bigint) RETURNS integer
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.entries SET payload = 'incremented' WHERE id = $1 RETURNING 1;
$$;
CREATE FUNCTION public.toggle_like(anyelement) RETURNS TABLE(liked boolean, likes_count integer)
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.entries SET payload = 'toggled' WHERE id = $1::text::bigint;
  SELECT true, 1;
$$;
GRANT EXECUTE ON FUNCTION public.aura_claim_first20_free(text, uuid),
  public.aura_claim_meish_free(text, uuid), public.set_entry_portfolio_hidden(bigint, boolean),
  public.increment_entry_likes(bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_like(anyelement) TO authenticated, service_role;

CREATE FUNCTION public.finalize_sale(bigint) RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.sales SET payload = 'paid' WHERE id = $1;
$$;
REVOKE ALL ON FUNCTION public.finalize_sale(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_sale(bigint) TO service_role;

-- Test helpers are SECURITY INVOKER, so commands run with the tested role.
CREATE FUNCTION legacy_stop_test.expect_denied(command text) RETURNS void
  LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE command;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN;
  END;
  RAISE EXCEPTION 'Expected insufficient_privilege: %', command;
END
$$;
CREATE FUNCTION legacy_stop_test.expect_rows(command text, expected bigint) RETURNS void
  LANGUAGE plpgsql AS $$
DECLARE actual bigint;
BEGIN
  EXECUTE command;
  GET DIAGNOSTICS actual = ROW_COUNT;
  IF actual <> expected THEN
    RAISE EXCEPTION 'Expected % affected rows, got %: %', expected, actual, command;
  END IF;
END
$$;
CREATE FUNCTION legacy_stop_test.expect_count(command text, expected bigint) RETURNS void
  LANGUAGE plpgsql AS $$
DECLARE actual bigint;
BEGIN
  EXECUTE command INTO actual;
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Expected count %, got %: %', expected, actual, command;
  END IF;
END
$$;
