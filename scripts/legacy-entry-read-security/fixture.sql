-- Synthetic fixture only: no production schema dump or customer records.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'
$$;

CREATE TABLE public.entries (
  id bigint PRIMARY KEY,
  user_id uuid,
  email text NOT NULL,
  external_user_id uuid,
  title text NOT NULL,
  confirmed boolean NOT NULL,
  display_ready boolean NOT NULL,
  reject_reason text,
  plan_payment_session_id text
);
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO anon, authenticated, service_role;
-- Include separate column and PUBLIC grants: table-only REVOKE is insufficient.
GRANT SELECT (email, reject_reason) ON public.entries TO anon;
GRANT SELECT (plan_payment_session_id) ON public.entries TO PUBLIC;
CREATE POLICY "Allow public select" ON public.entries FOR SELECT TO PUBLIC
  USING (confirmed AND display_ready);
CREATE POLICY entries_select_own ON public.entries FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY entries_select_by_email ON public.entries FOR SELECT TO authenticated
  USING (email = auth.email());
CREATE POLICY fixture_write_allow ON public.entries FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY legacy_stop_insert ON public.entries AS RESTRICTIVE
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY legacy_stop_update ON public.entries AS RESTRICTIVE
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

INSERT INTO public.entries VALUES
  (1, '11111111-1111-4111-8111-111111111111', 'alice@example.invalid',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Alice private', false, false, 'private', 'cs_test_a'),
  (2, '22222222-2222-4222-8222-222222222222', 'bob@example.invalid',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Bob public', true, true, 'private', 'cs_test_b'),
  (3, NULL, 'alice@example.invalid',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Alice unlinked', true, true, NULL, NULL),
  (4, NULL, 'other@example.invalid', NULL, 'Unlinked other', true, true, NULL, NULL),
  (5, '22222222-2222-4222-8222-222222222222', 'alice@example.invalid',
   NULL, 'Linked ID takes priority', true, true, NULL, NULL);

CREATE VIEW public.v_my_external_user_ids WITH (security_invoker = true) AS
  SELECT id, external_user_id FROM public.entries;
GRANT SELECT ON public.v_my_external_user_ids TO anon, authenticated, service_role;
CREATE VIEW public.v_server_entries AS SELECT id, email FROM public.entries;
REVOKE ALL ON public.v_server_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_server_entries TO service_role;

CREATE TABLE public.cert_links (entry_id bigint PRIMARY KEY, payload text NOT NULL);
CREATE TABLE public.sales (entry_id bigint PRIMARY KEY, payload text NOT NULL);
CREATE TABLE public.artists_bank_accounts (id bigint PRIMARY KEY, payload text NOT NULL);
CREATE TABLE public.natori_projects (id bigint PRIMARY KEY, payload text NOT NULL);
CREATE TABLE public.natori_talk_roughs (id bigint PRIMARY KEY, payload text NOT NULL);
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, public boolean NOT NULL);
CREATE TABLE storage.objects (id bigint PRIMARY KEY, bucket_id text NOT NULL);
INSERT INTO public.cert_links VALUES (1, 'synthetic certificate');
INSERT INTO public.sales VALUES (2, 'synthetic financial fact');
INSERT INTO public.artists_bank_accounts VALUES (1, 'synthetic bank');
INSERT INTO public.natori_projects VALUES (1, 'synthetic project');
INSERT INTO public.natori_talk_roughs VALUES (1, 'synthetic rough');
INSERT INTO storage.buckets VALUES ('natori-portfolio', true), ('natori-deliveries', false);
INSERT INTO storage.objects VALUES (1, 'natori-deliveries');
GRANT SELECT ON public.cert_links, public.sales, public.artists_bank_accounts,
  public.natori_projects, public.natori_talk_roughs TO service_role;

CREATE SCHEMA entry_read_test;
CREATE TABLE entry_read_test.before_state AS SELECT
  (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.entries e) AS entries,
  (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.natori_projects e) AS projects,
  (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.natori_talk_roughs e) AS roughs,
  (SELECT jsonb_agg(to_jsonb(e) ORDER BY entry_id) FROM public.cert_links e) AS certificates,
  (SELECT jsonb_agg(to_jsonb(e) ORDER BY entry_id) FROM public.sales e) AS sales,
  (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.artists_bank_accounts e) AS banks,
  (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM storage.buckets e) AS buckets,
  (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM storage.objects e) AS objects,
  (SELECT jsonb_agg(jsonb_build_object('name', c.oid::regclass::text, 'acl', c.relacl::text,
    'rls', c.relrowsecurity) ORDER BY c.oid::regclass::text)
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname IN ('public', 'storage') AND c.relkind IN ('r', 'v')
     AND c.oid <> 'public.entries'::regclass) AS protected_catalog;
