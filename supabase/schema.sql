--
-- PostgreSQL database dump
--

\restrict pBYfzeU3LziJgazxukcuY4NjzFZSBXPvCKRy5PkzFe5QtOhQJEt1pkdQzT7fV70

-- Dumped from database version 15.8
-- Dumped by pg_dump version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: aura_claim_first20(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.aura_claim_first20(p_email text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_used_at timestamptz;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return false;
  end if;

  -- 既にこのemailが先着特典を使っていたら、二重消費させない
  select first20_used_at into v_used_at
  from public.aura_free_claims
  where email = p_email
  for update;

  if v_used_at is not null then
    return false;
  end if;

  -- 枠を確保（used_count < limit_count の時だけ増やす）
  update public.aura_promo_counters
  set used_count = used_count + 1,
      updated_at = now()
  where key = 'first20' and used_count < limit_count;

  if not found then
    return false;
  end if;

  insert into public.aura_free_claims(email, first20_used_at, updated_at)
  values (p_email, now(), now())
  on conflict (email) do update
    set first20_used_at = coalesce(public.aura_free_claims.first20_used_at, excluded.first20_used_at),
        updated_at = now();

  return true;
end;
$$;


--
-- Name: aura_claim_first20_free(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.aura_claim_first20_free(p_email text, p_request_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: aura_claim_meish_free(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.aura_claim_meish_free(p_email text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_used_at timestamptz;
  v_exists boolean;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return false;
  end if;

  -- 既に使っていたら不可（email単位で一回）
  select meish_used_at into v_used_at
  from public.aura_free_claims
  where email = p_email
  for update;

  if v_used_at is not null then
    return false;
  end if;

  -- ✅ entries.confirmed=true かつ auth.users.email が一致するか
  select exists (
    select 1
    from public.entries e
    join auth.users u on u.id = e.user_id
    where e.confirmed = true
      and lower(u.email) = lower(p_email)
    limit 1
  ) into v_exists;

  if not v_exists then
    return false;
  end if;

  -- 消費（1回無料を確定）
  insert into public.aura_free_claims(email, meish_used_at, updated_at)
  values (p_email, now(), now())
  on conflict (email) do update
    set meish_used_at = coalesce(public.aura_free_claims.meish_used_at, excluded.meish_used_at),
        updated_at = now();

  return true;
end;
$$;


--
-- Name: aura_claim_meish_free(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.aura_claim_meish_free(p_email text, p_request_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: consume_cert_token(integer, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_cert_token(p_entry_id integer, p_token_hash text, p_one_time boolean DEFAULT true) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
declare
  v_id uuid;
  v_used timestamptz;
  v_revoked boolean;
  v_expires timestamptz;
begin
  select id, used_at, revoked, expires_at
    into v_id, v_used, v_revoked, v_expires
  from public.cert_links
  where entry_id = p_entry_id
    and token_hash = p_token_hash
  limit 1;

  if v_id is null then
    return false; -- 見つからない
  end if;

  if v_revoked then
    return false; -- 無効化済み
  end if;

  if v_expires is not null and v_expires <= now() then
    return false; -- 期限切れ
  end if;

  if p_one_time and v_used is not null then
    return false; -- すでに消費済み
  end if;

  if p_one_time then
    update public.cert_links
      set used_at = now()
    where id = v_id;
  end if;

  return true;
end;
$$;


--
-- Name: finalize_sale(bigint, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_sale(p_entry_id bigint, p_quantity integer, p_session_id text) RETURNS TABLE(new_edition_sold integer, sold_out boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_entry record;
  v_inserted boolean;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;

  if p_session_id is null or length(trim(p_session_id)) = 0 then
    raise exception 'session_id must be provided';
  end if;

  -- ✅ 冪等ゲート：session_id を sales で確保（処理済みなら加算しない）
  insert into public.sales (entry_id, stripe_session_id, purchased_at, metadata)
  values (p_entry_id, p_session_id, now(), jsonb_build_object('source','finalize_sale'))
  on conflict (stripe_session_id) do nothing;

  get diagnostics v_inserted = row_count;

  if not v_inserted then
    -- 既に処理済み：現在値を返して終了
    select e.edition_sold,
           (e.edition_total is not null and coalesce(e.edition_sold,0) >= e.edition_total)
      into new_edition_sold, sold_out
    from public.entries e
    where e.id = p_entry_id;

    return;
  end if;

  -- 対象行をロックして取得
  select * into v_entry
  from public.entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'entry % not found', p_entry_id;
  end if;

  -- 在庫チェック（edition_total が null は無制限）
  if v_entry.edition_total is not null then
    if coalesce(v_entry.edition_sold,0) + p_quantity > v_entry.edition_total then
      raise exception 'sold out: requested %, remaining %',
        p_quantity,
        greatest(v_entry.edition_total - coalesce(v_entry.edition_sold,0), 0);
    end if;
  end if;

  -- インクリメント
  update public.entries
     set edition_sold = coalesce(edition_sold,0) + p_quantity
   where id = p_entry_id
   returning edition_sold,
             (edition_total is not null and edition_sold >= edition_total)
        into new_edition_sold, sold_out;

  return;
end;
$$;


--
-- Name: normalize_unlimited_total(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_unlimited_total() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.edition_mode = 'unlimited' then
    new.edition_total := null;   -- ここを 0 運用にしたいなら 0
    if new.edition_sold is null then
      new.edition_sold := 0;
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_emails (
    email public.citext NOT NULL
);


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    body_md text NOT NULL,
    category text DEFAULT 'info'::text NOT NULL,
    link_url text,
    pinned boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: announcements_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.announcements_public AS
 SELECT announcements.id,
    announcements.title,
    announcements.body_md,
    announcements.category,
    announcements.link_url,
    announcements.pinned,
    announcements.published_at
   FROM public.announcements
  WHERE ((announcements.expires_at IS NULL) OR (announcements.expires_at > now()));


--
-- Name: artists_bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artists_bank_accounts (
    id bigint NOT NULL,
    external_user_id text NOT NULL,
    bank_code text NOT NULL,
    branch_code text NOT NULL,
    account_type text NOT NULL,
    account_number text NOT NULL,
    account_name_kana text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT artists_bank_accounts_account_number_check CHECK ((account_number ~ '^[0-9]{1,7}$'::text)),
    CONSTRAINT artists_bank_accounts_account_type_check CHECK ((account_type = ANY (ARRAY['futsu'::text, 'toza'::text]))),
    CONSTRAINT artists_bank_accounts_bank_code_check CHECK ((bank_code ~ '^[0-9]{4}$'::text)),
    CONSTRAINT artists_bank_accounts_branch_code_check CHECK ((branch_code ~ '^[0-9]{3}$'::text))
);


--
-- Name: artists_bank_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.artists_bank_accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: artists_bank_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.artists_bank_accounts_id_seq OWNED BY public.artists_bank_accounts.id;


--
-- Name: aura_first20_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aura_first20_redemptions (
    email text NOT NULL,
    used_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id uuid,
    converted_to_meish_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: aura_promo_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aura_promo_counters (
    key text NOT NULL,
    limit_count integer NOT NULL
);


--
-- Name: aura_first20_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.aura_first20_stats AS
 SELECT pc.key,
    pc.limit_count,
    COALESCE(used.used_count, 0) AS used_count,
    GREATEST((pc.limit_count - COALESCE(used.used_count, 0)), 0) AS remaining
   FROM (public.aura_promo_counters pc
     LEFT JOIN ( SELECT 'first20'::text AS key,
            (count(*))::integer AS used_count
           FROM public.aura_first20_redemptions
          WHERE (aura_first20_redemptions.converted_to_meish_at IS NULL)) used ON ((used.key = pc.key)))
  WHERE (pc.key = 'first20'::text);


--
-- Name: aura_meish_free_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aura_meish_free_claims (
    email text NOT NULL,
    used_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id uuid,
    entry_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: aura_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aura_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    error text,
    payload jsonb,
    design jsonb,
    content jsonb,
    email text,
    slug text,
    public_id text,
    visibility text DEFAULT 'private'::text NOT NULL,
    published_at timestamp with time zone,
    public_slug text,
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    paid_at timestamp with time zone,
    renderer_version text DEFAULT '1.0.0'::text NOT NULL,
    CONSTRAINT aura_requests_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'generated'::text, 'published'::text, 'error'::text]))),
    CONSTRAINT aura_requests_visibility_check CHECK ((visibility = ANY (ARRAY['private'::text, 'unlisted'::text, 'public'::text])))
);


--
-- Name: COLUMN aura_requests.renderer_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aura_requests.renderer_version IS 'SemVer string (MAJOR.MINOR.PATCH). MAJOR determines renderer directory. Stamped at publish time.';


--
-- Name: cert_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cert_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id integer NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone,
    revoked boolean DEFAULT false NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entries (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    artist_name text,
    email text,
    sns_links text NOT NULL,
    title text,
    description text NOT NULL,
    is_for_sale boolean DEFAULT false NOT NULL,
    sale_type text NOT NULL,
    price numeric,
    image_url text NOT NULL,
    gallery_type text,
    confirmed boolean,
    file_name text,
    user_id uuid,
    display_plan text,
    type text,
    is_sold boolean DEFAULT false,
    meish_fee_yen numeric,
    artist_reward_yen numeric,
    is_paid_to_artist boolean,
    paid_at timestamp with time zone,
    likes integer DEFAULT 0 NOT NULL,
    external_user_id uuid,
    edition_total integer,
    edition_sold integer DEFAULT 0 NOT NULL,
    display_ready boolean DEFAULT false,
    confirmed_at timestamp with time zone,
    display_start_at timestamp with time zone,
    display_end_at timestamp with time zone,
    edition_remaining integer GENERATED ALWAYS AS (
CASE
    WHEN (edition_total IS NULL) THEN NULL::integer
    ELSE GREATEST((edition_total - edition_sold), 0)
END) STORED,
    sold_out_calc boolean GENERATED ALWAYS AS (((edition_total IS NOT NULL) AND (edition_sold >= edition_total))) STORED,
    rejected_at timestamp with time zone,
    reject_reason text,
    reject_email_sent_at timestamp with time zone,
    token_id numeric,
    has_signature boolean,
    force_wm boolean DEFAULT false NOT NULL,
    edition_mode text,
    ai_usage text,
    ai_usage_scope text[],
    ai_usage_note text,
    CONSTRAINT entries_ai_usage_check CHECK (((ai_usage IS NULL) OR (ai_usage = ANY (ARRAY['none'::text, 'assist'::text, 'gen_assist'::text, 'ai_primary'::text])))),
    CONSTRAINT entries_edition_le_total CHECK (((edition_total IS NULL) OR (edition_sold <= edition_total))),
    CONSTRAINT entries_edition_mode_chk CHECK ((edition_mode = ANY (ARRAY['limited'::text, 'unlimited'::text]))),
    CONSTRAINT entries_edition_mode_consistency CHECK ((((edition_mode = 'unlimited'::text) AND (edition_total IS NULL)) OR ((edition_mode = 'limited'::text) AND (edition_total IS NOT NULL) AND (edition_total > 0)))),
    CONSTRAINT entries_edition_sold_nonneg CHECK ((edition_sold >= 0)),
    CONSTRAINT entries_edition_total_pos CHECK (((edition_total IS NULL) OR (edition_total >= 1)))
);


--
-- Name: COLUMN entries.confirmed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entries.confirmed_at IS '承認日時';


--
-- Name: COLUMN entries.display_start_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entries.display_start_at IS '展示開始日時（この日時以降に表示対象）';


--
-- Name: COLUMN entries.display_end_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entries.display_end_at IS '展示終了日時（この日時以降は非表示）';


--
-- Name: COLUMN entries.edition_remaining; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entries.edition_remaining IS 'Remaining editions (null = unlimited)';


--
-- Name: COLUMN entries.sold_out_calc; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entries.sold_out_calc IS 'Computed SOLD (true when edition_total is not null and edition_sold >= edition_total)';


--
-- Name: COLUMN entries.has_signature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entries.has_signature IS '作者サインの有無。true: サインあり → WM付与なし / false: サインなし → me-ishのWM付与 / null: 未回答（過去データ）';


--
-- Name: COLUMN entries.force_wm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entries.force_wm IS '管理画面からWM付与を強制するフラグ（trueで必ずWM付与）';


--
-- Name: COLUMN entries.ai_usage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entries.ai_usage IS 'AI usage category: none / assist (non-generative) / gen_assist (generative hybrid) / ai_primary';


--
-- Name: COLUMN entries.ai_usage_scope; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entries.ai_usage_scope IS 'Scope tags when ai_usage=gen_assist. e.g. {background,props,inpaint,other}';


--
-- Name: COLUMN entries.ai_usage_note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entries.ai_usage_note IS 'Free-form note about AI usage scope/details (optional).';


--
-- Name: entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.entries ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inquiries (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    is_read boolean DEFAULT false
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_name text DEFAULT ''''''::text NOT NULL,
    sns_links jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone,
    bio text,
    avatar_url text,
    banner_url text
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id bigint NOT NULL,
    price integer,
    buyer_email text,
    stripe_session_id text NOT NULL,
    purchased_at timestamp with time zone DEFAULT now(),
    metadata jsonb
);


--
-- Name: special_thanks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.special_thanks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_name text NOT NULL,
    avatar_url text,
    tagline text,
    homepage_url text,
    twitter_url text,
    instagram_url text,
    is_public boolean DEFAULT true NOT NULL,
    sort_order integer
);


--
-- Name: v_cert_links_active; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_cert_links_active AS
 SELECT cert_links.id,
    cert_links.entry_id,
    cert_links.token_hash,
    cert_links.expires_at,
    cert_links.revoked,
    cert_links.used_at,
    cert_links.created_at,
    cert_links.updated_at
   FROM public.cert_links
  WHERE ((cert_links.revoked = false) AND ((cert_links.expires_at IS NULL) OR (cert_links.expires_at > now())) AND (cert_links.used_at IS NULL));


--
-- Name: artists_bank_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artists_bank_accounts ALTER COLUMN id SET DEFAULT nextval('public.artists_bank_accounts_id_seq'::regclass);


--
-- Name: admin_emails admin_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_emails
    ADD CONSTRAINT admin_emails_pkey PRIMARY KEY (email);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: artists_bank_accounts artists_bank_accounts_external_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artists_bank_accounts
    ADD CONSTRAINT artists_bank_accounts_external_user_id_key UNIQUE (external_user_id);


--
-- Name: artists_bank_accounts artists_bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artists_bank_accounts
    ADD CONSTRAINT artists_bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: aura_first20_redemptions aura_first20_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aura_first20_redemptions
    ADD CONSTRAINT aura_first20_redemptions_pkey PRIMARY KEY (email);


--
-- Name: aura_meish_free_claims aura_meish_free_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aura_meish_free_claims
    ADD CONSTRAINT aura_meish_free_claims_pkey PRIMARY KEY (email);


--
-- Name: aura_promo_counters aura_promo_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aura_promo_counters
    ADD CONSTRAINT aura_promo_counters_pkey PRIMARY KEY (key);


--
-- Name: aura_requests aura_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aura_requests
    ADD CONSTRAINT aura_requests_pkey PRIMARY KEY (id);


--
-- Name: cert_links cert_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cert_links
    ADD CONSTRAINT cert_links_pkey PRIMARY KEY (id);


--
-- Name: entries entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_pkey PRIMARY KEY (id);


--
-- Name: inquiries inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: sales sales_stripe_session_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_stripe_session_id_unique UNIQUE (stripe_session_id);


--
-- Name: special_thanks special_thanks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_thanks
    ADD CONSTRAINT special_thanks_pkey PRIMARY KEY (id);


--
-- Name: aura_first20_redemptions_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aura_first20_redemptions_active_idx ON public.aura_first20_redemptions USING btree (converted_to_meish_at) WHERE (converted_to_meish_at IS NULL);


--
-- Name: aura_requests_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aura_requests_created_at_idx ON public.aura_requests USING btree (created_at DESC);


--
-- Name: aura_requests_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aura_requests_email_idx ON public.aura_requests USING btree (email);


--
-- Name: aura_requests_public_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX aura_requests_public_id_key ON public.aura_requests USING btree (public_id) WHERE (public_id IS NOT NULL);


--
-- Name: aura_requests_public_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX aura_requests_public_slug_unique ON public.aura_requests USING btree (public_slug) WHERE (public_slug IS NOT NULL);


--
-- Name: aura_requests_published_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aura_requests_published_at_idx ON public.aura_requests USING btree (published_at);


--
-- Name: aura_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aura_requests_status_idx ON public.aura_requests USING btree (status);


--
-- Name: aura_requests_visibility_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aura_requests_visibility_idx ON public.aura_requests USING btree (visibility);


--
-- Name: cert_links_entry_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cert_links_entry_active_idx ON public.cert_links USING btree (entry_id, revoked, expires_at);


--
-- Name: cert_links_entry_token_ux; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cert_links_entry_token_ux ON public.cert_links USING btree (entry_id, token_hash);


--
-- Name: idx_aura_requests_renderer_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aura_requests_renderer_version ON public.aura_requests USING btree (renderer_version);


--
-- Name: special_thanks_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX special_thanks_sort_idx ON public.special_thanks USING btree (sort_order, display_name);


--
-- Name: profiles set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: aura_requests trg_aura_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_aura_requests_updated_at BEFORE UPDATE ON public.aura_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cert_links trg_cert_links_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cert_links_set_updated_at BEFORE UPDATE ON public.cert_links FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: entries trg_entries_normalize_unlimited; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_entries_normalize_unlimited BEFORE INSERT OR UPDATE ON public.entries FOR EACH ROW EXECUTE FUNCTION public.normalize_unlimited_total();


--
-- Name: announcements announcements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: cert_links cert_links_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cert_links
    ADD CONSTRAINT cert_links_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.entries(id) ON DELETE CASCADE;


--
-- Name: inquiries Allow admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin read" ON public.inquiries FOR SELECT TO authenticated USING ((auth.uid() = 'b3211e93-a630-4826-8e78-5a50db043170'::uuid));


--
-- Name: inquiries Allow admin update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin update" ON public.inquiries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: entries Allow linking for entries without user_id; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow linking for entries without user_id" ON public.entries FOR UPDATE TO authenticated USING ((user_id IS NULL)) WITH CHECK (true);


--
-- Name: entries Allow only admin to update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow only admin to update" ON public.entries FOR UPDATE TO authenticated USING ((auth.uid() = 'b3211e93-a630-4826-8e78-5a50db043170'::uuid)) WITH CHECK ((auth.uid() = 'b3211e93-a630-4826-8e78-5a50db043170'::uuid));


--
-- Name: entries Allow public insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert" ON public.entries FOR INSERT WITH CHECK (true);


--
-- Name: entries Allow public select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public select" ON public.entries FOR SELECT USING (true);


--
-- Name: entries Allow public to increment likes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public to increment likes" ON public.entries FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Users can read their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: announcements admin can delete announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin can delete announcements" ON public.announcements FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.admin_emails a
  WHERE ((a.email)::text = auth.email()))));


--
-- Name: announcements admin can insert announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin can insert announcements" ON public.announcements FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.admin_emails a
  WHERE ((a.email)::text = auth.email()))));


--
-- Name: announcements admin can update announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin can update announcements" ON public.announcements FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.admin_emails a
  WHERE ((a.email)::text = auth.email())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.admin_emails a
  WHERE ((a.email)::text = auth.email()))));


--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: aura_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.aura_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: cert_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cert_links ENABLE ROW LEVEL SECURITY;

--
-- Name: entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

--
-- Name: entries entries_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY entries_insert_own ON public.entries FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: entries entries_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY entries_select_own ON public.entries FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: entries entries_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY entries_update_own ON public.entries FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: inquiries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

--
-- Name: aura_requests no_client_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY no_client_write ON public.aura_requests TO authenticated, anon USING (false) WITH CHECK (false);


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: special_thanks public read thanks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read thanks" ON public.special_thanks FOR SELECT TO authenticated, anon USING ((is_public = true));


--
-- Name: aura_requests public_read_published; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_published ON public.aura_requests FOR SELECT TO authenticated, anon USING (((visibility = 'public'::text) AND (public_id IS NOT NULL)));


--
-- Name: announcements read announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read announcements" ON public.announcements FOR SELECT TO authenticated, anon USING (true);


--
-- Name: sales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

--
-- Name: special_thanks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.special_thanks ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict pBYfzeU3LziJgazxukcuY4NjzFZSBXPvCKRy5PkzFe5QtOhQJEt1pkdQzT7fV70

