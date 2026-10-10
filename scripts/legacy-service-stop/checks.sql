-- Called for each real database role, in a transaction rolled back afterwards.
BEGIN;
SET LOCAL ROLE :"test_role";
SELECT set_config('legacy_test.stop_state', :'stop_state', true);
DO $checks$
DECLARE
  blocked boolean := current_setting('legacy_test.stop_state') = 'stopped'
    AND current_user IN ('anon', 'authenticated');
  name text;
  command text;
  old_bucket boolean;
  readable boolean;
BEGIN
  FOREACH name IN ARRAY ARRAY['entries', 'profiles', 'portfolio_settings'] LOOP
    PERFORM legacy_stop_test.expect_count(format('SELECT count(*) FROM public.%I WHERE id = 1', name), 1);
    command := format('INSERT INTO public.%I VALUES (2, %L)', name, 'new');
    IF blocked THEN
      PERFORM legacy_stop_test.expect_denied(command);
      PERFORM legacy_stop_test.expect_rows(format('UPDATE public.%I SET payload = %L WHERE id = 1', name, 'replaced'), 0);
      PERFORM legacy_stop_test.expect_denied(format(
        'INSERT INTO public.%I VALUES (1, %L) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload', name, 'upserted'));
      PERFORM legacy_stop_test.expect_count(format('SELECT count(*) FROM public.%I WHERE id = 1 AND payload = %L', name, 'existing'), 1);
    ELSE
      PERFORM legacy_stop_test.expect_rows(command, 1);
      PERFORM legacy_stop_test.expect_rows(format('UPDATE public.%I SET payload = %L WHERE id = 1', name, 'replaced'), 1);
      PERFORM legacy_stop_test.expect_rows(format(
        'INSERT INTO public.%I VALUES (1, %L) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload', name, 'upserted'), 1);
    END IF;
  END LOOP;

  -- Existing published records stay readable; direct creation was already denied.
  FOREACH name IN ARRAY ARRAY['aura_requests', 'aura_projects', 'card_requests', 'entry_view_events'] LOOP
    PERFORM legacy_stop_test.expect_count(format('SELECT count(*) FROM public.%I WHERE id = 1', name), 1);
    IF current_user IN ('anon', 'authenticated') THEN
      PERFORM legacy_stop_test.expect_denied(format('INSERT INTO public.%I VALUES (3, %L)', name, 'new'));
    ELSE
      PERFORM legacy_stop_test.expect_rows(format('INSERT INTO public.%I VALUES (3, %L)', name, 'server-write'), 1);
    END IF;
  END LOOP;

  -- New comments/likes stop; an existing comment's soft deletion and unlike stay.
  FOREACH name IN ARRAY ARRAY['entry_comments', 'likes'] LOOP
    PERFORM legacy_stop_test.expect_count(format('SELECT count(*) FROM public.%I WHERE id = 1', name), 1);
    command := format('INSERT INTO public.%I VALUES (2, %L)', name, 'new');
    IF blocked THEN
      PERFORM legacy_stop_test.expect_denied(command);
    ELSE
      PERFORM legacy_stop_test.expect_rows(command, 1);
    END IF;
    PERFORM legacy_stop_test.expect_rows(format('UPDATE public.%I SET payload = %L WHERE id = 1', name, 'soft-deleted'), 1);
    PERFORM legacy_stop_test.expect_rows(format('DELETE FROM public.%I WHERE id = 1', name), 1);
  END LOOP;

  -- Both formerly explicit client grants and PUBLIC-inherited EXECUTE are tested.
  FOREACH command IN ARRAY ARRAY[
    'SELECT public.aura_claim_first20_free(''fixture@example.invalid'', NULL::uuid)',
    'SELECT public.aura_claim_meish_free(''fixture@example.invalid'', NULL::uuid)',
    'SELECT public.set_entry_portfolio_hidden(1::bigint, true)',
    'SELECT public.increment_entry_likes(1::bigint)',
    'SELECT * FROM public.toggle_like(1::bigint)'
  ] LOOP
    IF blocked THEN
      PERFORM legacy_stop_test.expect_denied(command);
    ELSE
      EXECUTE command;
    END IF;
  END LOOP;

  FOR name IN SELECT id FROM storage.buckets ORDER BY id LOOP
    old_bucket := name IN ('artworks','avatars','banners','aura-assets','card-assets','gallery-entry-intake','processing-meta');
    readable := current_user <> 'anon' OR name IN ('artworks','avatars','banners','natori-portfolio');
    PERFORM legacy_stop_test.expect_count(format(
      'SELECT count(*) FROM storage.objects WHERE id = %L', name || '/existing'), readable::integer);
    command := format('INSERT INTO storage.objects VALUES (%L, %L, %L, %L)',
      name || '/new', name, 'new', 'new bytes');
    IF blocked AND old_bucket THEN
      PERFORM legacy_stop_test.expect_denied(command);
      PERFORM legacy_stop_test.expect_rows(format(
        'UPDATE storage.objects SET payload = %L WHERE id = %L', 'changed bytes', name || '/existing'), 0);
      PERFORM legacy_stop_test.expect_denied(format(
        'INSERT INTO storage.objects VALUES (%L, %L, %L, %L) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload',
        name || '/existing', name, 'existing', 'upserted bytes'));
      PERFORM legacy_stop_test.expect_count(format(
        'SELECT count(*) FROM storage.objects WHERE id = %L AND payload = %L',
        name || '/existing', 'original bytes'), readable::integer);
    ELSE
      PERFORM legacy_stop_test.expect_rows(command, 1);
      PERFORM legacy_stop_test.expect_rows(format(
        'UPDATE storage.objects SET payload = %L WHERE id = %L', 'changed bytes', name || '/existing'), readable::integer);
      IF readable THEN
        PERFORM legacy_stop_test.expect_rows(format(
          'INSERT INTO storage.objects VALUES (%L, %L, %L, %L) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload',
          name || '/existing', name, 'existing', 'upserted bytes'), 1);
      END IF;
    END IF;
  END LOOP;

  -- A previously permitted Natori row cannot be moved into an old bucket.
  IF blocked THEN
    PERFORM legacy_stop_test.expect_denied(
      'UPDATE storage.objects SET bucket_id = ''artworks'' WHERE id = ''natori-portfolio/existing''');
    PERFORM legacy_stop_test.expect_rows(
      'UPDATE storage.objects SET bucket_id = ''natori-portfolio'' WHERE id = ''artworks/existing''', 0);
    PERFORM legacy_stop_test.expect_count(
      'SELECT count(*) FROM storage.objects WHERE id = ''artworks/existing'' AND bucket_id = ''artworks''', 1);
    PERFORM legacy_stop_test.expect_count(
      'SELECT count(*) FROM storage.objects WHERE id = ''natori-portfolio/existing'' AND bucket_id = ''natori-portfolio''', 1);
  END IF;

  -- Existing Natori and financial maintenance writes retain their baseline rights.
  FOREACH name IN ARRAY ARRAY['natori_projects', 'natori_user_profiles', 'artists_bank_accounts', 'sales'] LOOP
    PERFORM legacy_stop_test.expect_rows(format('INSERT INTO public.%I VALUES (2, %L)', name, 'new'), 1);
    PERFORM legacy_stop_test.expect_rows(format('UPDATE public.%I SET payload = %L WHERE id = 1', name, 'maintained'), 1);
  END LOOP;
  IF current_user = 'service_role' THEN
    PERFORM public.finalize_sale(1::bigint);
    PERFORM legacy_stop_test.expect_count('SELECT count(*) FROM public.sales WHERE id = 1 AND payload = ''paid''', 1);
  ELSE
    PERFORM legacy_stop_test.expect_denied('SELECT public.finalize_sale(1::bigint)');
  END IF;

  -- DELETE remains unchanged, including existing owner-side cleanup semantics.
  FOREACH name IN ARRAY ARRAY['entries', 'profiles', 'portfolio_settings'] LOOP
    PERFORM legacy_stop_test.expect_rows(format('DELETE FROM public.%I WHERE id = 1', name), 1);
  END LOOP;
  FOR name IN SELECT id FROM storage.buckets ORDER BY id LOOP
    readable := current_user <> 'anon' OR name IN ('artworks','avatars','banners','natori-portfolio');
    PERFORM legacy_stop_test.expect_rows(format(
      'DELETE FROM storage.objects WHERE id = %L', name || '/existing'), readable::integer);
  END LOOP;
END
$checks$;
ROLLBACK;
