-- Gallery stats RPC: works count, artist count, unique views in a single query
-- Replaces client-side N+1 (entries + entry_view_stats) with one DB call

CREATE OR REPLACE FUNCTION get_gallery_stats()
RETURNS TABLE (works_count bigint, artists_count bigint, unique_views bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::bigint,
    COUNT(DISTINCT e.user_id)::bigint,
    COALESCE(SUM(evs.unique_views), 0)::bigint
  FROM entries e
  LEFT JOIN entry_view_stats evs ON evs.entry_id = e.id
  WHERE e.confirmed = true AND e.display_ready = true;
$$;
