-- 閲覧数集計ビュー
-- アーティスト向け: 自分の作品の閲覧数合計
-- 閲覧者向け: 自分が見た作品数

-- アーティスト向け閲覧統計ビュー
CREATE OR REPLACE VIEW v_artist_view_stats AS
SELECT
  e.user_id,
  COALESCE(COUNT(ev.id), 0)::bigint AS total_views,
  COALESCE(COUNT(DISTINCT ev.session_id), 0)::bigint AS unique_views,
  COALESCE(COUNT(DISTINCT ev.entry_id), 0)::bigint AS viewed_works_count,
  MAX(ev.occurred_at) AS last_viewed_at
FROM entries e
LEFT JOIN entry_view_events ev ON ev.entry_id = e.id
WHERE e.user_id IS NOT NULL
  AND e.confirmed = true
GROUP BY e.user_id;

-- 閲覧者向け統計ビュー
CREATE OR REPLACE VIEW v_viewer_stats AS
SELECT
  viewer_user_id AS user_id,
  COUNT(*)::bigint AS total_views,
  COUNT(DISTINCT entry_id)::bigint AS unique_works_viewed,
  MAX(occurred_at) AS last_viewed_at
FROM entry_view_events
WHERE viewer_user_id IS NOT NULL
GROUP BY viewer_user_id;

-- RLSポリシー: 自分の統計のみ閲覧可能
-- ビューに直接RLSは適用できないため、関数でラップするか
-- クライアント側でuser_idフィルタをかける

-- アーティスト統計取得用の関数
CREATE OR REPLACE FUNCTION get_my_artist_view_stats(p_user_id uuid)
RETURNS TABLE (
  total_views bigint,
  unique_views bigint,
  viewed_works_count bigint,
  last_viewed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    total_views,
    unique_views,
    viewed_works_count,
    last_viewed_at
  FROM v_artist_view_stats
  WHERE user_id = p_user_id;
$$;

-- 閲覧者統計取得用の関数
CREATE OR REPLACE FUNCTION get_my_viewer_stats(p_user_id uuid)
RETURNS TABLE (
  total_views bigint,
  unique_works_viewed bigint,
  last_viewed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    total_views,
    unique_works_viewed,
    last_viewed_at
  FROM v_viewer_stats
  WHERE user_id = p_user_id;
$$;

-- 作品別の閲覧数（アーティスト用）
CREATE OR REPLACE FUNCTION get_my_works_view_stats(p_user_id uuid)
RETURNS TABLE (
  entry_id bigint,
  title text,
  view_count bigint,
  unique_views bigint,
  last_viewed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
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
$$;
