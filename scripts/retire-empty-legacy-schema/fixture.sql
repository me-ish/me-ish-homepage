-- Target table columns/constraints and target functions/views from read-only
-- production catalog on 2026-10-10. All records below are synthetic.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE TABLE public.entries(id bigint PRIMARY KEY, user_id uuid, confirmed boolean, likes integer, display_ready boolean, title text);
CREATE TABLE public.natori_projects(id uuid PRIMARY KEY, payload text);
INSERT INTO public.natori_projects VALUES ('00000000-0000-4000-8000-000000000001','protected-project');
CREATE TABLE public.natori_payments(id uuid PRIMARY KEY, payload text);
INSERT INTO public.natori_payments SELECT id,'protected-payment' FROM public.natori_projects;
CREATE TABLE public.processed_stripe_events(id text PRIMARY KEY);
INSERT INTO public.processed_stripe_events VALUES ('evt_synthetic');
CREATE TABLE storage.buckets(id text PRIMARY KEY);
CREATE TABLE storage.objects(id uuid PRIMARY KEY, bucket_id text REFERENCES storage.buckets(id), name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.aura_first20_redemptions (
  "email" text NOT NULL,
  "used_at" timestamp with time zone DEFAULT now() NOT NULL,
  "request_id" uuid,
  "converted_to_meish_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "aura_first20_redemptions_pkey" PRIMARY KEY (email)
);
ALTER TABLE public.aura_first20_redemptions ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.aura_meish_free_claims (
  "email" text NOT NULL,
  "used_at" timestamp with time zone DEFAULT now() NOT NULL,
  "request_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "entry_id" bigint,
  CONSTRAINT "aura_meish_free_claims_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE SET NULL,
  CONSTRAINT "aura_meish_free_claims_pkey" PRIMARY KEY (email)
);
ALTER TABLE public.aura_meish_free_claims ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.aura_projects (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_token" uuid NOT NULL,
  "email" text,
  "name" text,
  "display_title" text,
  "tagline" text,
  "bio" text,
  "avatar_path" text,
  "theme_id" text DEFAULT 'pure'::text NOT NULL,
  "accent_color" text DEFAULT '#00a1e9'::text,
  "font_preset" text DEFAULT 'cleanJa'::text,
  "layout_pref" text DEFAULT 'center'::text,
  "works" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "services" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "social" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "section_order" text[] DEFAULT ARRAY['hero'::text, 'works'::text, 'skills'::text, 'services'::text, 'contact'::text],
  "section_visibility" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "public_id" uuid DEFAULT gen_random_uuid(),
  "public_slug" text,
  "visibility" text DEFAULT 'private'::text NOT NULL,
  "published_at" timestamp with time zone,
  "payment_status" text DEFAULT 'unpaid'::text NOT NULL,
  "renderer_version" text DEFAULT '2.0.0'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "avatar_shape" text DEFAULT 'circle'::text NOT NULL,
  "bg_pattern" text DEFAULT 'none'::text NOT NULL,
  CONSTRAINT "aura_projects_pkey" PRIMARY KEY (id),
  CONSTRAINT "aura_projects_public_slug_key" UNIQUE (public_slug)
);
ALTER TABLE public.aura_projects ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.aura_promo_counters (
  "key" text NOT NULL,
  "limit_count" integer NOT NULL,
  CONSTRAINT "aura_promo_counters_pkey" PRIMARY KEY (key)
);
ALTER TABLE public.aura_promo_counters ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.aura_requests (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "error" text,
  "payload" jsonb,
  "design" jsonb,
  "content" jsonb,
  "email" text,
  "slug" text,
  "public_id" text,
  "visibility" text DEFAULT 'private'::text NOT NULL,
  "published_at" timestamp with time zone,
  "public_slug" text,
  "payment_status" text DEFAULT 'unpaid'::text NOT NULL,
  "paid_at" timestamp with time zone,
  "renderer_version" text DEFAULT '1.0.0'::text NOT NULL,
  "session_token" uuid,
  CONSTRAINT "aura_requests_pkey" PRIMARY KEY (id),
  CONSTRAINT "aura_requests_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'generated'::text, 'published'::text, 'error'::text]))),
  CONSTRAINT "aura_requests_visibility_check" CHECK ((visibility = ANY (ARRAY['private'::text, 'unlisted'::text, 'public'::text])))
);
ALTER TABLE public.aura_requests ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.card_requests (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "payload" jsonb,
  "design" jsonb,
  "content" jsonb,
  "public_id" uuid,
  "public_slug" text,
  "visibility" text DEFAULT 'private'::text,
  "published_at" timestamp with time zone,
  "tier" text DEFAULT 'free'::text,
  "payment_status" text DEFAULT 'unpaid'::text,
  "stripe_session_id" text,
  "paid_at" timestamp with time zone,
  "session_token" text NOT NULL,
  "renderer_version" text DEFAULT '1.0.0'::text,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "card_requests_pkey" PRIMARY KEY (id)
);
ALTER TABLE public.card_requests ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.entry_comments (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "entry_id" bigint NOT NULL,
  "user_id" uuid NOT NULL,
  "body" text NOT NULL,
  "author_name" text DEFAULT 'Anonymous'::text NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "entry_comments_body_check" CHECK (((char_length(body) >= 1) AND (char_length(body) <= 1000))),
  CONSTRAINT "entry_comments_deleted_by_fkey" FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "entry_comments_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
  CONSTRAINT "entry_comments_pkey" PRIMARY KEY (id),
  CONSTRAINT "entry_comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public.entry_comments ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.entry_daily_slots (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "entry_id" bigint NOT NULL,
  "display_date" date NOT NULL,
  "slot_index" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "entry_daily_slots_date_entry_unique" UNIQUE (display_date, entry_id),
  CONSTRAINT "entry_daily_slots_date_slot_unique" UNIQUE (display_date, slot_index),
  CONSTRAINT "entry_daily_slots_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
  CONSTRAINT "entry_daily_slots_pkey" PRIMARY KEY (id)
);
ALTER TABLE public.entry_daily_slots ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.entry_view_events (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "entry_id" bigint NOT NULL,
  "viewer_user_id" uuid,
  "session_id" text,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "entry_view_events_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
  CONSTRAINT "entry_view_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "entry_view_events_viewer_user_id_fkey" FOREIGN KEY (viewer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.entry_view_events ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.kpi_jobs (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "job_name" text NOT NULL,
  "executed_at" timestamp with time zone NOT NULL,
  "success" boolean DEFAULT false NOT NULL,
  "duration_sec" numeric(12,3),
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "slot" text,
  "content_type" text,
  CONSTRAINT "kpi_jobs_pkey" PRIMARY KEY (id)
);
ALTER TABLE public.kpi_jobs ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.kpi_posts (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "kind" text,
  "content" text,
  "x_post_id" text,
  "posted_at" timestamp with time zone,
  "scheduled_at" timestamp with time zone,
  "delay_sec" integer,
  "impressions" bigint DEFAULT 0,
  "likes" integer DEFAULT 0,
  "retweets" integer DEFAULT 0,
  "replies" integer DEFAULT 0,
  "profile_clicks" integer DEFAULT 0,
  "engagement_rate" numeric(12,6),
  "success" boolean DEFAULT false,
  "error_message" text,
  "impressions_fetched_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "safety_status" text,
  "safety_reasons" jsonb,
  "safety_checked_at" timestamp with time zone,
  "final_post_text" text,
  "source_news_ids" uuid[],
  "source_market_snapshot" jsonb,
  "model_name" text,
  "prompt_version" text,
  CONSTRAINT "kpi_posts_pkey" PRIMARY KEY (id)
);
ALTER TABLE public.kpi_posts ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.likes (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "entry_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "likes_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
  CONSTRAINT "likes_pkey" PRIMARY KEY (id),
  CONSTRAINT "likes_user_entry_unique" UNIQUE (user_id, entry_id),
  CONSTRAINT "likes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.portfolio_settings (
  "user_id" uuid NOT NULL,
  "is_public" boolean DEFAULT true NOT NULL,
  "public_display_name" text,
  "headline" text,
  "bio_short" text,
  "contact_email" text,
  "contact_url" text,
  "works_filter" text DEFAULT 'displaying'::text NOT NULL,
  "sort_key" text DEFAULT 'new'::text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "portfolio_settings_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "portfolio_settings_sort_key_check" CHECK ((sort_key = ANY (ARRAY['new'::text, 'likes'::text]))),
  CONSTRAINT "portfolio_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "portfolio_settings_works_filter_check" CHECK ((works_filter = ANY (ARRAY['displaying'::text, 'all'::text, 'for_sale'::text])))
);
ALTER TABLE public.portfolio_settings ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.special_thanks (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "display_name" text NOT NULL,
  "avatar_url" text,
  "tagline" text,
  "homepage_url" text,
  "twitter_url" text,
  "instagram_url" text,
  "is_public" boolean DEFAULT true NOT NULL,
  "sort_order" integer,
  CONSTRAINT "special_thanks_pkey" PRIMARY KEY (id)
);
ALTER TABLE public.special_thanks ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.youtube_videos (
  "video_id" text NOT NULL,
  "title" text,
  "published_at" timestamp with time zone,
  "duration_iso" text,
  "duration_seconds" integer,
  "is_shorts" boolean DEFAULT false,
  "view_count" bigint DEFAULT 0,
  "like_count" integer DEFAULT 0,
  "comment_count" integer DEFAULT 0,
  "fetched_at" timestamp with time zone DEFAULT now(),
  "shorts_type" text,
  "safety_status" text,
  "safety_reasons" jsonb,
  "safety_checked_at" timestamp with time zone,
  "source_news_ids" uuid[],
  "model_name" text,
  "prompt_version" text,
  "content_type" text,
  "slot" text,
  CONSTRAINT "youtube_videos_pkey" PRIMARY KEY (video_id)
);
ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;
CREATE VIEW public.aura_first20_stats AS  SELECT pc.key,
    pc.limit_count,
    COALESCE(used.used_count, 0) AS used_count,
    GREATEST((pc.limit_count - COALESCE(used.used_count, 0)), 0) AS remaining
   FROM (aura_promo_counters pc
     LEFT JOIN ( SELECT 'first20'::text AS key,
            (count(*))::integer AS used_count
           FROM aura_first20_redemptions
          WHERE (aura_first20_redemptions.converted_to_meish_at IS NULL)) used ON ((used.key = pc.key)))
  WHERE (pc.key = 'first20'::text);
CREATE VIEW public.entry_comment_counts AS  SELECT entry_id,
    (count(*))::integer AS comment_count
   FROM entry_comments
  WHERE (deleted_at IS NULL)
  GROUP BY entry_id;
CREATE VIEW public.entry_view_stats AS  SELECT entry_id,
    count(*) AS view_count,
    count(DISTINCT session_id) AS unique_views,
    max(occurred_at) AS last_viewed_at
   FROM entry_view_events
  GROUP BY entry_id;
CREATE VIEW public.v_artist_view_stats AS  SELECT e.user_id,
    COALESCE(count(ev.id), (0)::bigint) AS total_views,
    COALESCE(count(DISTINCT ev.session_id), (0)::bigint) AS unique_views,
    COALESCE(count(DISTINCT ev.entry_id), (0)::bigint) AS viewed_works_count,
    max(ev.occurred_at) AS last_viewed_at
   FROM (entries e
     LEFT JOIN entry_view_events ev ON ((ev.entry_id = e.id)))
  WHERE ((e.user_id = auth.uid()) AND (e.confirmed = true))
  GROUP BY e.user_id;
CREATE VIEW public.v_viewer_stats AS  SELECT viewer_user_id AS user_id,
    count(*) AS total_views,
    count(DISTINCT entry_id) AS unique_works_viewed,
    max(occurred_at) AS last_viewed_at
   FROM entry_view_events ev
  WHERE (viewer_user_id = auth.uid())
  GROUP BY viewer_user_id;
CREATE OR REPLACE FUNCTION public.aura_claim_first20_free(p_email text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := lower(trim(p_email));
  v_limit int;
  v_used int;
  v_is_meish bool;
  v_meish_used bool;
  v_already_used bool;
begin
  if v_email is null or v_email = '' then
    return jsonb_build_object('ok', false, 'reason', 'email_missing');
  end if;

  -- 1) 採用者は first20 を使わせない（要件：採用者は先着枠に含めない）
  select exists(
    select 1 from public.entries
    where lower(trim(email)) = v_email
      and confirmed = true
  ) into v_is_meish;

  if v_is_meish then
    return jsonb_build_object('ok', false, 'reason', 'meish_member_should_use_meish_free');
  end if;

  select exists(
    select 1 from public.aura_meish_free_claims where email = v_email
  ) into v_meish_used;

  if v_meish_used then
    return jsonb_build_object('ok', false, 'reason', 'meish_already_used');
  end if;

  -- 2) 既に first20 使用済み（active=返還されていない）なら不可
  select exists(
    select 1 from public.aura_first20_redemptions
    where email = v_email
      and converted_to_meish_at is null
  ) into v_already_used;

  if v_already_used then
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;

  -- 3) 上限 row をロック（同時実行でも21人目が通らないように）
  select limit_count into v_limit
  from public.aura_promo_counters
  where key = 'first20'
  for update;

  if v_limit is null then
    v_limit := 20;
  end if;

  -- 4) 現在の使用数（返還されていないもののみ）
  select count(*)::int into v_used
  from public.aura_first20_redemptions
  where converted_to_meish_at is null;

  if v_used >= v_limit then
    return jsonb_build_object('ok', false, 'reason', 'limit_reached');
  end if;

  -- 5) 消費（PKで一意、競合は unique_violation で弾く）
  insert into public.aura_first20_redemptions(email, used_at, request_id)
  values (v_email, now(), p_request_id);

  return jsonb_build_object('ok', true, 'reason', 'first20_claimed');
exception
  when unique_violation then
    -- 先に他処理が入っていた場合など
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  when others then
    return jsonb_build_object('ok', false, 'reason', 'internal_error', 'message', sqlerrm);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.aura_claim_meish_free(p_email text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := lower(trim(p_email));
  v_entry record;
  v_existing record;
begin
  if v_email is null or v_email = '' then
    return jsonb_build_object('ok', false, 'reason', 'email_missing');
  end if;

  -- 採用確認（entries.confirmed=true）
  select id into v_entry
  from public.entries
  where lower(trim(email)) = v_email
    and confirmed = true
  limit 1;

  if v_entry.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_meish_member');
  end if;

  -- 既に meish を使っていたら不可
  select email into v_existing
  from public.aura_meish_free_claims
  where email = v_email;

  if v_existing.email is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;

  -- meish消費（原子的：PKで一意）
  insert into public.aura_meish_free_claims(email, used_at, request_id, entry_id)
  values (v_email, now(), p_request_id, v_entry.id);

  -- first20 を以前使っていた場合は「返還」扱いにする（先着枠から除外）
  update public.aura_first20_redemptions
  set converted_to_meish_at = now()
  where email = v_email
    and converted_to_meish_at is null;

  return jsonb_build_object('ok', true, 'reason', 'meish_claimed');
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  when others then
    return jsonb_build_object('ok', false, 'reason', 'internal_error', 'message', sqlerrm);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_gallery_stats()
 RETURNS TABLE(works_count bigint, artists_count bigint, unique_views bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT
    COUNT(*)::bigint,
    COUNT(DISTINCT e.user_id)::bigint,
    COALESCE(SUM(evs.unique_views), 0)::bigint
  FROM entries e
  LEFT JOIN entry_view_stats evs ON evs.entry_id = e.id
  WHERE e.confirmed = true AND e.display_ready = true;
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_artist_view_stats(p_user_id uuid)
 RETURNS TABLE(total_views bigint, unique_views bigint, viewed_works_count bigint, last_viewed_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT
    total_views,
    unique_views,
    viewed_works_count,
    last_viewed_at
  FROM v_artist_view_stats
  WHERE user_id = p_user_id;
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_viewer_stats(p_user_id uuid)
 RETURNS TABLE(total_views bigint, unique_works_viewed bigint, last_viewed_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT
    total_views,
    unique_works_viewed,
    last_viewed_at
  FROM v_viewer_stats
  WHERE user_id = p_user_id;
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_works_view_stats(p_user_id uuid)
 RETURNS TABLE(entry_id bigint, title text, view_count bigint, unique_views bigint, last_viewed_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT
    e.id::bigint AS entry_id,
    e.title,
    COALESCE(evs.view_count, 0)::bigint,
    COALESCE(evs.unique_views, 0)::bigint,
    evs.last_viewed_at
  FROM entries e
  LEFT JOIN entry_view_stats evs ON evs.entry_id = e.id
  WHERE e.user_id = p_user_id
    AND e.confirmed = true
  ORDER BY COALESCE(evs.view_count, 0) DESC;
$function$
;
CREATE OR REPLACE FUNCTION public.get_public_portfolio(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s public.portfolio_settings;
  result jsonb;
  wf text;
  sk text;
begin
  select * into s
  from public.portfolio_settings
  where user_id = p_user_id;

  -- 設定が存在し、かつ非公開なら公開APIとしてはnullを返す
  if s.user_id is not null and s.is_public is false then
    return null;
  end if;

  wf := coalesce(s.works_filter, 'displaying');
  sk := coalesce(s.sort_key, 'new');

  -- settings を返す（設定が無い場合はデフォルト設定を返す）
  result := jsonb_build_object(
    'settings',
    coalesce(
      to_jsonb(s),
      jsonb_build_object(
        'user_id', p_user_id,
        'is_public', true,
        'works_filter', 'displaying',
        'sort_key', 'new'
      )
    )
  );

  -- entries（公開VIEWから返す）
  -- works_filter:
  -- - all: 全件
  -- - for_sale: is_for_sale=true
  -- - displaying: display_ready=true かつ展示期間内（start/endを尊重）
  result := result || jsonb_build_object(
    'entries',
    (
      select coalesce(
        jsonb_agg(to_jsonb(e) order by
          case when sk = 'likes' then e.likes end desc nulls last,
          e.created_at desc
        ),
        '[]'::jsonb
      )
      from public.v_public_portfolio_entries e
      where e.user_id = p_user_id
        and (
          wf = 'all'
          or (wf = 'for_sale' and e.is_for_sale = true)
          or (
            wf = 'displaying'
            and e.display_ready = true
            and (e.display_start_at is null or e.display_start_at <= now())
            and (e.display_end_at is null or now() < e.display_end_at)
          )
        )
    )
  );

  return result;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.increment_entry_likes(p_entry_id bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_likes integer;
begin
  update public.entries
     set likes = coalesce(likes, 0) + 1
   where id = p_entry_id
   returning likes into v_likes;

  if v_likes is null then
    raise exception 'entry not found';
  end if;

  return v_likes;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.toggle_like(p_entry_id anyelement)
 RETURNS TABLE(liked boolean, likes_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_exists boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  -- 既に like 済みか
  select exists(
    select 1 from public.likes
    where user_id = v_user_id and entry_id = p_entry_id
  ) into v_exists;

  if v_exists then
    -- unlike
    delete from public.likes
      where user_id = v_user_id and entry_id = p_entry_id;

    update public.entries
      set likes = greatest(coalesce(likes,0) - 1, 0)
      where id = p_entry_id;

    liked := false;
  else
    -- like（競合しても unique 制約で守られる）
    insert into public.likes(user_id, entry_id)
      values (v_user_id, p_entry_id)
      on conflict (user_id, entry_id) do nothing;

    update public.entries
      set likes = coalesce(likes,0) + 1
      where id = p_entry_id;

    liked := true;
  end if;

  select coalesce(e.likes,0) into likes_count
    from public.entries e
    where e.id = p_entry_id;

  return next;
end $function$
;
CREATE POLICY "Allow public access 1exduyn_0" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'artworks'::text));
CREATE POLICY "Allow public read access sudlkv_0" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'processing-meta'::text));
CREATE POLICY "delete own avatar" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));
CREATE POLICY "delete own banner" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'banners'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));
CREATE POLICY "gallery intake requires signed service access" ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated USING ((bucket_id <> 'gallery-entry-intake'::text)) WITH CHECK ((bucket_id <> 'gallery-entry-intake'::text));
CREATE POLICY "legacy_stop_storage_insert" ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK ((bucket_id <> ALL (ARRAY['artworks'::text, 'avatars'::text, 'banners'::text, 'aura-assets'::text, 'card-assets'::text, 'gallery-entry-intake'::text, 'processing-meta'::text])));
CREATE POLICY "legacy_stop_storage_update" ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING ((bucket_id <> ALL (ARRAY['artworks'::text, 'avatars'::text, 'banners'::text, 'aura-assets'::text, 'card-assets'::text, 'gallery-entry-intake'::text, 'processing-meta'::text]))) WITH CHECK ((bucket_id <> ALL (ARRAY['artworks'::text, 'avatars'::text, 'banners'::text, 'aura-assets'::text, 'card-assets'::text, 'gallery-entry-intake'::text, 'processing-meta'::text])));
CREATE POLICY "public read avatars & banners" ON storage.objects AS PERMISSIVE FOR SELECT TO anon,authenticated USING ((bucket_id = ANY (ARRAY['avatars'::text, 'banners'::text])));
CREATE POLICY "update own avatar" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))) WITH CHECK (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));
CREATE POLICY "update own banner" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'banners'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))) WITH CHECK (((bucket_id = 'banners'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));
CREATE POLICY "upload own avatar" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));
CREATE POLICY "upload own banner" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'banners'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));
CREATE POLICY "user can delete own avatars & banners" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = ANY (ARRAY['avatars'::text, 'banners'::text])) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));
CREATE POLICY "user can update own avatars & banners" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = ANY (ARRAY['avatars'::text, 'banners'::text])) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))) WITH CHECK (((bucket_id = ANY (ARRAY['avatars'::text, 'banners'::text])) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));
CREATE POLICY "user can upload own avatars & banners" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = ANY (ARRAY['avatars'::text, 'banners'::text])) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));
INSERT INTO storage.buckets VALUES ('artworks'),('avatars'),('banners'),('aura-assets'),('card-assets'),('gallery-entry-intake'),('processing-meta'),('natori-portfolio'),('natori-consultations'),('natori-inquiry-refs'),('natori-deliveries');
INSERT INTO storage.objects VALUES ('00000000-0000-4000-8000-000000000001','natori-portfolio','synthetic.png');
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000002');
INSERT INTO public.entries VALUES (1,'00000000-0000-4000-8000-000000000002',true,3,true,'synthetic');
