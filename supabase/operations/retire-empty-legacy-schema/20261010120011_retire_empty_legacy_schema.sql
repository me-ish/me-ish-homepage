-- REVIEWED MANUAL OPERATION. Not part of automatic migration replay.
-- Deploy the matching code first; obtain production approval before executing.
-- No data deletion, CASCADE, or Storage metadata writes are performed.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;
DO $guard$
DECLARE
  target text;
  has_rows boolean;
  actual jsonb;
BEGIN
  IF current_setting('meish.legacy_schema_cleanup', true) IS DISTINCT FROM 'reviewed-20261010' THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_REVIEWED_SESSION_REQUIRED';
  END IF;
  FOREACH target IN ARRAY ARRAY['aura_first20_redemptions','aura_meish_free_claims','aura_projects','aura_promo_counters','aura_requests','card_requests','entry_comments','entry_daily_slots','entry_view_events','kpi_jobs','kpi_posts','likes','portfolio_settings','special_thanks','youtube_videos'] LOOP
    IF NOT EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=target AND c.relkind='r'
        AND pg_get_userbyid(c.relowner)='postgres') THEN
      RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_MISSING_OR_CHANGED: %', target;
    END IF;
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', target);
    EXECUTE format('SELECT EXISTS (SELECT FROM public.%I)', target) INTO has_rows;
    IF has_rows THEN RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_NOT_EMPTY: %', target; END IF;
  END LOOP;
  IF EXISTS (SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f'
      AND n.nspname || '.' || p.proname || '(' || oidvectortypes(p.proargtypes) || ')' <> ALL(ARRAY['public.aura_claim_first20_free(text, uuid)','public.aura_claim_meish_free(text, uuid)','public.get_public_portfolio(uuid)','public.increment_entry_likes(bigint)','public.toggle_like(anyelement)','public.get_gallery_stats()','public.get_my_artist_view_stats(uuid)','public.get_my_viewer_stats(uuid)','public.get_my_works_view_stats(uuid)'])
      AND pg_get_functiondef(p.oid) ~ '\m(aura_first20_redemptions|aura_meish_free_claims|aura_projects|aura_promo_counters|aura_requests|card_requests|entry_comments|entry_daily_slots|entry_view_events|kpi_jobs|kpi_posts|likes|portfolio_settings|special_thanks|youtube_videos|aura_first20_stats|entry_comment_counts|entry_view_stats|v_artist_view_stats|v_viewer_stats)\M') THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_UNEXPECTED_FUNCTION_DEPENDENCY';
  END IF;
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'default',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid='public.aura_first20_redemptions'::regclass AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY k.conname)
      FROM pg_constraint k WHERE k.conrelid='public.aura_first20_redemptions'::regclass)) INTO actual;
  IF actual IS DISTINCT FROM $expected${"columns":[{"name":"email","type":"text","default":null,"notnull":true},{"name":"used_at","type":"timestamp with time zone","default":"now()","notnull":true},{"name":"request_id","type":"uuid","default":null,"notnull":false},{"name":"converted_to_meish_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true}],"constraints":[{"name":"aura_first20_redemptions_pkey","definition":"PRIMARY KEY (email)"}]}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_DRIFT: aura_first20_redemptions';
  END IF;
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'default',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid='public.aura_meish_free_claims'::regclass AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY k.conname)
      FROM pg_constraint k WHERE k.conrelid='public.aura_meish_free_claims'::regclass)) INTO actual;
  IF actual IS DISTINCT FROM $expected${"columns":[{"name":"email","type":"text","default":null,"notnull":true},{"name":"used_at","type":"timestamp with time zone","default":"now()","notnull":true},{"name":"request_id","type":"uuid","default":null,"notnull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true},{"name":"entry_id","type":"bigint","default":null,"notnull":false}],"constraints":[{"name":"aura_meish_free_claims_entry_id_fkey","definition":"FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE SET NULL"},{"name":"aura_meish_free_claims_pkey","definition":"PRIMARY KEY (email)"}]}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_DRIFT: aura_meish_free_claims';
  END IF;
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'default',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid='public.aura_projects'::regclass AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY k.conname)
      FROM pg_constraint k WHERE k.conrelid='public.aura_projects'::regclass)) INTO actual;
  IF actual IS DISTINCT FROM $expected${"columns":[{"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true},{"name":"session_token","type":"uuid","default":null,"notnull":true},{"name":"email","type":"text","default":null,"notnull":false},{"name":"name","type":"text","default":null,"notnull":false},{"name":"display_title","type":"text","default":null,"notnull":false},{"name":"tagline","type":"text","default":null,"notnull":false},{"name":"bio","type":"text","default":null,"notnull":false},{"name":"avatar_path","type":"text","default":null,"notnull":false},{"name":"theme_id","type":"text","default":"'pure'::text","notnull":true},{"name":"accent_color","type":"text","default":"'#00a1e9'::text","notnull":false},{"name":"font_preset","type":"text","default":"'cleanJa'::text","notnull":false},{"name":"layout_pref","type":"text","default":"'center'::text","notnull":false},{"name":"works","type":"jsonb","default":"'[]'::jsonb","notnull":true},{"name":"services","type":"jsonb","default":"'[]'::jsonb","notnull":true},{"name":"skills","type":"jsonb","default":"'[]'::jsonb","notnull":true},{"name":"social","type":"jsonb","default":"'{}'::jsonb","notnull":true},{"name":"section_order","type":"text[]","default":"ARRAY['hero'::text, 'works'::text, 'skills'::text, 'services'::text, 'contact'::text]","notnull":false},{"name":"section_visibility","type":"jsonb","default":"'{}'::jsonb","notnull":true},{"name":"status","type":"text","default":"'draft'::text","notnull":true},{"name":"public_id","type":"uuid","default":"gen_random_uuid()","notnull":false},{"name":"public_slug","type":"text","default":null,"notnull":false},{"name":"visibility","type":"text","default":"'private'::text","notnull":true},{"name":"published_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"payment_status","type":"text","default":"'unpaid'::text","notnull":true},{"name":"renderer_version","type":"text","default":"'2.0.0'::text","notnull":true},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true},{"name":"updated_at","type":"timestamp with time zone","default":"now()","notnull":true},{"name":"avatar_shape","type":"text","default":"'circle'::text","notnull":true},{"name":"bg_pattern","type":"text","default":"'none'::text","notnull":true}],"constraints":[{"name":"aura_projects_pkey","definition":"PRIMARY KEY (id)"},{"name":"aura_projects_public_slug_key","definition":"UNIQUE (public_slug)"}]}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_DRIFT: aura_projects';
  END IF;
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'default',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid='public.aura_promo_counters'::regclass AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY k.conname)
      FROM pg_constraint k WHERE k.conrelid='public.aura_promo_counters'::regclass)) INTO actual;
  IF actual IS DISTINCT FROM $expected${"columns":[{"name":"key","type":"text","default":null,"notnull":true},{"name":"limit_count","type":"integer","default":null,"notnull":true}],"constraints":[{"name":"aura_promo_counters_pkey","definition":"PRIMARY KEY (key)"}]}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_DRIFT: aura_promo_counters';
  END IF;
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'default',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid='public.aura_requests'::regclass AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY k.conname)
      FROM pg_constraint k WHERE k.conrelid='public.aura_requests'::regclass)) INTO actual;
  IF actual IS DISTINCT FROM $expected${"columns":[{"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true},{"name":"updated_at","type":"timestamp with time zone","default":"now()","notnull":true},{"name":"status","type":"text","default":"'draft'::text","notnull":true},{"name":"error","type":"text","default":null,"notnull":false},{"name":"payload","type":"jsonb","default":null,"notnull":false},{"name":"design","type":"jsonb","default":null,"notnull":false},{"name":"content","type":"jsonb","default":null,"notnull":false},{"name":"email","type":"text","default":null,"notnull":false},{"name":"slug","type":"text","default":null,"notnull":false},{"name":"public_id","type":"text","default":null,"notnull":false},{"name":"visibility","type":"text","default":"'private'::text","notnull":true},{"name":"published_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"public_slug","type":"text","default":null,"notnull":false},{"name":"payment_status","type":"text","default":"'unpaid'::text","notnull":true},{"name":"paid_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"renderer_version","type":"text","default":"'1.0.0'::text","notnull":true},{"name":"session_token","type":"uuid","default":null,"notnull":false}],"constraints":[{"name":"aura_requests_pkey","definition":"PRIMARY KEY (id)"},{"name":"aura_requests_status_check","definition":"CHECK ((status = ANY (ARRAY['draft'::text, 'generated'::text, 'published'::text, 'error'::text])))"},{"name":"aura_requests_visibility_check","definition":"CHECK ((visibility = ANY (ARRAY['private'::text, 'unlisted'::text, 'public'::text])))"}]}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_DRIFT: aura_requests';
  END IF;
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'default',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid='public.card_requests'::regclass AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY k.conname)
      FROM pg_constraint k WHERE k.conrelid='public.card_requests'::regclass)) INTO actual;
  IF actual IS DISTINCT FROM $expected${"columns":[{"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true},{"name":"email","type":"text","default":null,"notnull":true},{"name":"status","type":"text","default":"'draft'::text","notnull":true},{"name":"payload","type":"jsonb","default":null,"notnull":false},{"name":"design","type":"jsonb","default":null,"notnull":false},{"name":"content","type":"jsonb","default":null,"notnull":false},{"name":"public_id","type":"uuid","default":null,"notnull":false},{"name":"public_slug","type":"text","default":null,"notnull":false},{"name":"visibility","type":"text","default":"'private'::text","notnull":false},{"name":"published_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"tier","type":"text","default":"'free'::text","notnull":false},{"name":"payment_status","type":"text","default":"'unpaid'::text","notnull":false},{"name":"stripe_session_id","type":"text","default":null,"notnull":false},{"name":"paid_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"session_token","type":"text","default":null,"notnull":true},{"name":"renderer_version","type":"text","default":"'1.0.0'::text","notnull":false},{"name":"error","type":"text","default":null,"notnull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":false},{"name":"updated_at","type":"timestamp with time zone","default":"now()","notnull":false}],"constraints":[{"name":"card_requests_pkey","definition":"PRIMARY KEY (id)"}]}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_DRIFT: card_requests';
  END IF;
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'default',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid='public.entry_comments'::regclass AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY k.conname)
      FROM pg_constraint k WHERE k.conrelid='public.entry_comments'::regclass)) INTO actual;
  IF actual IS DISTINCT FROM $expected${"columns":[{"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true},{"name":"entry_id","type":"bigint","default":null,"notnull":true},{"name":"user_id","type":"uuid","default":null,"notnull":true},{"name":"body","type":"text","default":null,"notnull":true},{"name":"author_name","type":"text","default":"'Anonymous'::text","notnull":true},{"name":"deleted_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"deleted_by","type":"uuid","default":null,"notnull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true}],"constraints":[{"name":"entry_comments_body_check","definition":"CHECK (((char_length(body) >= 1) AND (char_length(body) <= 1000)))"},{"name":"entry_comments_deleted_by_fkey","definition":"FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL"},{"name":"entry_comments_entry_id_fkey","definition":"FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE"},{"name":"entry_comments_pkey","definition":"PRIMARY KEY (id)"},{"name":"entry_comments_user_id_fkey","definition":"FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"}]}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_DRIFT: entry_comments';
  END IF;
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'default',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid='public.entry_daily_slots'::regclass AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY k.conname)
      FROM pg_constraint k WHERE k.conrelid='public.entry_daily_slots'::regclass)) INTO actual;
  IF actual IS DISTINCT FROM $expected${"columns":[{"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true},{"name":"entry_id","type":"bigint","default":null,"notnull":true},{"name":"display_date","type":"date","default":null,"notnull":true},{"name":"slot_index","type":"integer","default":null,"notnull":true},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true}],"constraints":[{"name":"entry_daily_slots_date_entry_unique","definition":"UNIQUE (display_date, entry_id)"},{"name":"entry_daily_slots_date_slot_unique","definition":"UNIQUE (display_date, slot_index)"},{"name":"entry_daily_slots_entry_id_fkey","definition":"FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE"},{"name":"entry_daily_slots_pkey","definition":"PRIMARY KEY (id)"}]}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_DRIFT: entry_daily_slots';
  END IF;
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'default',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid='public.entry_view_events'::regclass AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY k.conname)
      FROM pg_constraint k WHERE k.conrelid='public.entry_view_events'::regclass)) INTO actual;
  IF actual IS DISTINCT FROM $expected${"columns":[{"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true},{"name":"entry_id","type":"bigint","default":null,"notnull":true},{"name":"viewer_user_id","type":"uuid","default":null,"notnull":false},{"name":"session_id","type":"text","default":null,"notnull":false},{"name":"occurred_at","type":"timestamp with time zone","default":"now()","notnull":true}],"constraints":[{"name":"entry_view_events_entry_id_fkey","definition":"FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE"},{"name":"entry_view_events_pkey","definition":"PRIMARY KEY (id)"},{"name":"entry_view_events_viewer_user_id_fkey","definition":"FOREIGN KEY (viewer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL"}]}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_DRIFT: entry_view_events';
  END IF;
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'default',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid='public.kpi_jobs'::regclass AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY k.conname)
      FROM pg_constraint k WHERE k.conrelid='public.kpi_jobs'::regclass)) INTO actual;
  IF actual IS DISTINCT FROM $expected${"columns":[{"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true},{"name":"job_name","type":"text","default":null,"notnull":true},{"name":"executed_at","type":"timestamp with time zone","default":null,"notnull":true},{"name":"success","type":"boolean","default":"false","notnull":true},{"name":"duration_sec","type":"numeric(12,3)","default":null,"notnull":false},{"name":"error_message","type":"text","default":null,"notnull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true},{"name":"slot","type":"text","default":null,"notnull":false},{"name":"content_type","type":"text","default":null,"notnull":false}],"constraints":[{"name":"kpi_jobs_pkey","definition":"PRIMARY KEY (id)"}]}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_DRIFT: kpi_jobs';
  END IF;
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'default',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid='public.kpi_posts'::regclass AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY k.conname)
      FROM pg_constraint k WHERE k.conrelid='public.kpi_posts'::regclass)) INTO actual;
  IF actual IS DISTINCT FROM $expected${"columns":[{"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true},{"name":"kind","type":"text","default":null,"notnull":false},{"name":"content","type":"text","default":null,"notnull":false},{"name":"x_post_id","type":"text","default":null,"notnull":false},{"name":"posted_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"scheduled_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"delay_sec","type":"integer","default":null,"notnull":false},{"name":"impressions","type":"bigint","default":"0","notnull":false},{"name":"likes","type":"integer","default":"0","notnull":false},{"name":"retweets","type":"integer","default":"0","notnull":false},{"name":"replies","type":"integer","default":"0","notnull":false},{"name":"profile_clicks","type":"integer","default":"0","notnull":false},{"name":"engagement_rate","type":"numeric(12,6)","default":null,"notnull":false},{"name":"success","type":"boolean","default":"false","notnull":false},{"name":"error_message","type":"text","default":null,"notnull":false},{"name":"impressions_fetched_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true},{"name":"safety_status","type":"text","default":null,"notnull":false},{"name":"safety_reasons","type":"jsonb","default":null,"notnull":false},{"name":"safety_checked_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"final_post_text","type":"text","default":null,"notnull":false},{"name":"source_news_ids","type":"uuid[]","default":null,"notnull":false},{"name":"source_market_snapshot","type":"jsonb","default":null,"notnull":false},{"name":"model_name","type":"text","default":null,"notnull":false},{"name":"prompt_version","type":"text","default":null,"notnull":false}],"constraints":[{"name":"kpi_posts_pkey","definition":"PRIMARY KEY (id)"}]}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_DRIFT: kpi_posts';
  END IF;
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'default',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid='public.likes'::regclass AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY k.conname)
      FROM pg_constraint k WHERE k.conrelid='public.likes'::regclass)) INTO actual;
  IF actual IS DISTINCT FROM $expected${"columns":[{"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true},{"name":"user_id","type":"uuid","default":null,"notnull":true},{"name":"entry_id","type":"bigint","default":null,"notnull":true},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true}],"constraints":[{"name":"likes_entry_id_fkey","definition":"FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE"},{"name":"likes_pkey","definition":"PRIMARY KEY (id)"},{"name":"likes_user_entry_unique","definition":"UNIQUE (user_id, entry_id)"},{"name":"likes_user_id_fkey","definition":"FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"}]}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_DRIFT: likes';
  END IF;
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'default',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid='public.portfolio_settings'::regclass AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY k.conname)
      FROM pg_constraint k WHERE k.conrelid='public.portfolio_settings'::regclass)) INTO actual;
  IF actual IS DISTINCT FROM $expected${"columns":[{"name":"user_id","type":"uuid","default":null,"notnull":true},{"name":"is_public","type":"boolean","default":"true","notnull":true},{"name":"public_display_name","type":"text","default":null,"notnull":false},{"name":"headline","type":"text","default":null,"notnull":false},{"name":"bio_short","type":"text","default":null,"notnull":false},{"name":"contact_email","type":"text","default":null,"notnull":false},{"name":"contact_url","type":"text","default":null,"notnull":false},{"name":"works_filter","type":"text","default":"'displaying'::text","notnull":true},{"name":"sort_key","type":"text","default":"'new'::text","notnull":true},{"name":"updated_at","type":"timestamp with time zone","default":"now()","notnull":true},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true}],"constraints":[{"name":"portfolio_settings_pkey","definition":"PRIMARY KEY (user_id)"},{"name":"portfolio_settings_sort_key_check","definition":"CHECK ((sort_key = ANY (ARRAY['new'::text, 'likes'::text])))"},{"name":"portfolio_settings_user_id_fkey","definition":"FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"},{"name":"portfolio_settings_works_filter_check","definition":"CHECK ((works_filter = ANY (ARRAY['displaying'::text, 'all'::text, 'for_sale'::text])))"}]}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_DRIFT: portfolio_settings';
  END IF;
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'default',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid='public.special_thanks'::regclass AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY k.conname)
      FROM pg_constraint k WHERE k.conrelid='public.special_thanks'::regclass)) INTO actual;
  IF actual IS DISTINCT FROM $expected${"columns":[{"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true},{"name":"display_name","type":"text","default":null,"notnull":true},{"name":"avatar_url","type":"text","default":null,"notnull":false},{"name":"tagline","type":"text","default":null,"notnull":false},{"name":"homepage_url","type":"text","default":null,"notnull":false},{"name":"twitter_url","type":"text","default":null,"notnull":false},{"name":"instagram_url","type":"text","default":null,"notnull":false},{"name":"is_public","type":"boolean","default":"true","notnull":true},{"name":"sort_order","type":"integer","default":null,"notnull":false}],"constraints":[{"name":"special_thanks_pkey","definition":"PRIMARY KEY (id)"}]}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_DRIFT: special_thanks';
  END IF;
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'default',(SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum)) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid='public.youtube_videos'::regclass AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY k.conname)
      FROM pg_constraint k WHERE k.conrelid='public.youtube_videos'::regclass)) INTO actual;
  IF actual IS DISTINCT FROM $expected${"columns":[{"name":"video_id","type":"text","default":null,"notnull":true},{"name":"title","type":"text","default":null,"notnull":false},{"name":"published_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"duration_iso","type":"text","default":null,"notnull":false},{"name":"duration_seconds","type":"integer","default":null,"notnull":false},{"name":"is_shorts","type":"boolean","default":"false","notnull":false},{"name":"view_count","type":"bigint","default":"0","notnull":false},{"name":"like_count","type":"integer","default":"0","notnull":false},{"name":"comment_count","type":"integer","default":"0","notnull":false},{"name":"fetched_at","type":"timestamp with time zone","default":"now()","notnull":false},{"name":"shorts_type","type":"text","default":null,"notnull":false},{"name":"safety_status","type":"text","default":null,"notnull":false},{"name":"safety_reasons","type":"jsonb","default":null,"notnull":false},{"name":"safety_checked_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"source_news_ids","type":"uuid[]","default":null,"notnull":false},{"name":"model_name","type":"text","default":null,"notnull":false},{"name":"prompt_version","type":"text","default":null,"notnull":false},{"name":"content_type","type":"text","default":null,"notnull":false},{"name":"slot","type":"text","default":null,"notnull":false}],"constraints":[{"name":"youtube_videos_pkey","definition":"PRIMARY KEY (video_id)"}]}$expected$::jsonb THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_TABLE_DRIFT: youtube_videos';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.aura_claim_first20_free(text, uuid)'))) IS DISTINCT FROM '03ce9cd84091bb3e9565d13a74d21856' THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_FUNCTION_DRIFT: public.aura_claim_first20_free(text, uuid)';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.aura_claim_meish_free(text, uuid)'))) IS DISTINCT FROM '887587fcfabe7fd987dc952dd4217a49' THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_FUNCTION_DRIFT: public.aura_claim_meish_free(text, uuid)';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.get_gallery_stats()'))) IS DISTINCT FROM '92dd814f974064507ab80cc1ed9b29ab' THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_FUNCTION_DRIFT: public.get_gallery_stats()';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.get_my_artist_view_stats(uuid)'))) IS DISTINCT FROM 'eb90b49a08556fc450d5b3027036fa53' THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_FUNCTION_DRIFT: public.get_my_artist_view_stats(uuid)';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.get_my_viewer_stats(uuid)'))) IS DISTINCT FROM 'c3032788b93ec9062484465ea0314d18' THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_FUNCTION_DRIFT: public.get_my_viewer_stats(uuid)';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.get_my_works_view_stats(uuid)'))) IS DISTINCT FROM '22264682b059063e8c56c3389930d6fe' THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_FUNCTION_DRIFT: public.get_my_works_view_stats(uuid)';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.get_public_portfolio(uuid)'))) IS DISTINCT FROM '3062bee1e059ffe354cb25fae98ade73' THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_FUNCTION_DRIFT: public.get_public_portfolio(uuid)';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.increment_entry_likes(bigint)'))) IS DISTINCT FROM '90b59a3a83f2d60922e00395a9d608c1' THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_FUNCTION_DRIFT: public.increment_entry_likes(bigint)';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.toggle_like(anyelement)'))) IS DISTINCT FROM '15de44178cd453eaa1bc0b008bcee2ad' THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_FUNCTION_DRIFT: public.toggle_like(anyelement)';
  END IF;
  IF md5(pg_get_viewdef(to_regclass('public.aura_first20_stats'))) IS DISTINCT FROM 'b98abdfe6f8d17e2053c8ae0ef5df41d' THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_VIEW_DRIFT: aura_first20_stats';
  END IF;
  IF md5(pg_get_viewdef(to_regclass('public.entry_comment_counts'))) IS DISTINCT FROM '225495a0d58deb93c332140fc6291e58' THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_VIEW_DRIFT: entry_comment_counts';
  END IF;
  IF md5(pg_get_viewdef(to_regclass('public.entry_view_stats'))) IS DISTINCT FROM 'bfc5c1862260667773360e21db181c06' THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_VIEW_DRIFT: entry_view_stats';
  END IF;
  IF md5(pg_get_viewdef(to_regclass('public.v_artist_view_stats'))) IS DISTINCT FROM '2f57659e4530e1f8d33e3596c3d9a0a7' THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_VIEW_DRIFT: v_artist_view_stats';
  END IF;
  IF md5(pg_get_viewdef(to_regclass('public.v_viewer_stats'))) IS DISTINCT FROM 'ca0a382e2780aa5613ce9d88454f60b9' THEN
    RAISE EXCEPTION 'LEGACY_SCHEMA_VIEW_DRIFT: v_viewer_stats';
  END IF;
END;
$guard$;

DROP FUNCTION public.aura_claim_first20_free(text, uuid) RESTRICT;
DROP FUNCTION public.aura_claim_meish_free(text, uuid) RESTRICT;
DROP FUNCTION public.get_public_portfolio(uuid) RESTRICT;
DROP FUNCTION public.increment_entry_likes(bigint) RESTRICT;
DROP FUNCTION public.toggle_like(anyelement) RESTRICT;
DROP FUNCTION public.get_gallery_stats() RESTRICT;
DROP FUNCTION public.get_my_artist_view_stats(uuid) RESTRICT;
DROP FUNCTION public.get_my_viewer_stats(uuid) RESTRICT;
DROP FUNCTION public.get_my_works_view_stats(uuid) RESTRICT;
DROP VIEW public.aura_first20_stats RESTRICT;
DROP VIEW public.entry_comment_counts RESTRICT;
DROP VIEW public.entry_view_stats RESTRICT;
DROP VIEW public.v_artist_view_stats RESTRICT;
DROP VIEW public.v_viewer_stats RESTRICT;
DROP TABLE public.aura_first20_redemptions RESTRICT;
DROP TABLE public.aura_meish_free_claims RESTRICT;
DROP TABLE public.aura_projects RESTRICT;
DROP TABLE public.aura_promo_counters RESTRICT;
DROP TABLE public.aura_requests RESTRICT;
DROP TABLE public.card_requests RESTRICT;
DROP TABLE public.entry_comments RESTRICT;
DROP TABLE public.entry_daily_slots RESTRICT;
DROP TABLE public.entry_view_events RESTRICT;
DROP TABLE public.kpi_jobs RESTRICT;
DROP TABLE public.kpi_posts RESTRICT;
DROP TABLE public.likes RESTRICT;
DROP TABLE public.portfolio_settings RESTRICT;
DROP TABLE public.special_thanks RESTRICT;
DROP TABLE public.youtube_videos RESTRICT;

COMMIT;
