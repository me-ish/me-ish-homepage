-- =============================================================================
-- 20260208_rls_unprotected_tables.sql
-- RLS未設定テーブルにポリシーを追加（P0セキュリティ修正）
-- =============================================================================

-- =========================================================
-- 1. portfolio_settings — ユーザーは自分のみ読み書き可能
-- =========================================================
ALTER TABLE public.portfolio_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ps_select_own ON public.portfolio_settings;
CREATE POLICY ps_select_own ON public.portfolio_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ps_insert_own ON public.portfolio_settings;
CREATE POLICY ps_insert_own ON public.portfolio_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ps_update_own ON public.portfolio_settings;
CREATE POLICY ps_update_own ON public.portfolio_settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ps_delete_own ON public.portfolio_settings;
CREATE POLICY ps_delete_own ON public.portfolio_settings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 公開ポートフォリオ閲覧用（is_public = true のみ）
DROP POLICY IF EXISTS ps_select_public ON public.portfolio_settings;
CREATE POLICY ps_select_public ON public.portfolio_settings
  FOR SELECT TO anon
  USING (is_public = true);

-- =========================================================
-- 2. artists_bank_accounts — service_role のみ（RLSで一般ユーザーをブロック）
--    entries.external_user_id 経由でのみ参照される
-- =========================================================
ALTER TABLE public.artists_bank_accounts ENABLE ROW LEVEL SECURITY;

-- authenticated/anon からの直接アクセスを全てブロック
-- service_role はRLSバイパスなので管理APIは動作する

-- =========================================================
-- 3. aura_requests — session_token ベースのアクセス制御
--    email ベース（user_id カラムなし）のためアプリ層で保護
--    RLS有効化で anon/authenticated の直接アクセスをブロック
-- =========================================================
ALTER TABLE public.aura_requests ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは自分のメールに紐づくリクエストのみ参照可能
DROP POLICY IF EXISTS aura_select_own_email ON public.aura_requests;
CREATE POLICY aura_select_own_email ON public.aura_requests
  FOR SELECT TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- 公開済みポートフォリオは誰でも閲覧可能（公開ページ用）
DROP POLICY IF EXISTS aura_select_published ON public.aura_requests;
CREATE POLICY aura_select_published ON public.aura_requests
  FOR SELECT TO anon, authenticated
  USING (
    visibility = 'public'
    AND status = 'published'
    AND published_at IS NOT NULL
  );

-- =========================================================
-- 4. profiles — 誰でも閲覧可能だが更新は本人のみ
-- =========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- プロフィールは公開情報（ギャラリー表示に必要）
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
CREATE POLICY profiles_select_all ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- =========================================================
-- 5. admin_emails — service_role のみ
-- =========================================================
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;
-- 一般ユーザーからの直接アクセスを全てブロック

-- =========================================================
-- 6. inquiries — 投稿者は自分の問い合わせのみ閲覧可能
-- =========================================================
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inquiries_insert_anon ON public.inquiries;
CREATE POLICY inquiries_insert_anon ON public.inquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 閲覧は service_role（管理者）のみ
