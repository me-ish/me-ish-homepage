-- Admin workflow view for /admin/entries overview panels

DROP VIEW IF EXISTS public.v_admin_entry_workflow;

CREATE VIEW public.v_admin_entry_workflow AS
SELECT
  e.id AS entry_id,
  e.gallery_type,
  e.created_at,
  e.confirmed,
  e.confirmed_at,
  e.rejected_at,
  e.reject_reason,
  e.reject_email_sent_at,
  e.display_ready,
  e.display_start_at,
  e.display_end_at,
  e.image_url,
  j.status AS processing_status,
  j.updated_at AS processing_updated_at,
  COALESCE(j.attempts, 0) AS processing_attempts,
  j.last_error,
  CASE
    WHEN e.confirmed = false THEN 'rejected'
    WHEN COALESCE(e.display_ready, false) = true
      AND e.display_end_at IS NOT NULL
      AND e.display_end_at <= now() THEN 'ended'
    WHEN COALESCE(e.display_ready, false) = true THEN 'displaying'
    WHEN e.confirmed IS NULL THEN 'unreviewed'
    WHEN e.confirmed = true
      AND COALESCE(e.display_ready, false) = false
      AND (
        j.status = 'succeeded'
        OR e.image_url LIKE '%/final/%'
      ) THEN 'ready_to_enable'
    WHEN e.confirmed = true
      AND COALESCE(e.display_ready, false) = false
      AND j.status = 'running' THEN 'processing'
    WHEN e.confirmed = true
      AND COALESCE(e.display_ready, false) = false
      AND j.status = 'failed' THEN 'processing_failed'
    WHEN e.confirmed = true
      AND COALESCE(e.display_ready, false) = false THEN 'approved_queued'
    ELSE 'approved_queued'
  END AS phase,
  ROUND(EXTRACT(EPOCH FROM (now() - e.created_at)) / 3600.0, 1) AS age_hours,
  (
    (e.confirmed IS NULL AND e.created_at < now() - interval '48 hours')
    OR
    (
      e.confirmed = true
      AND COALESCE(e.display_ready, false) = false
      AND j.status = 'running'
      AND j.updated_at < now() - interval '2 hours'
    )
    OR
    (
      e.confirmed = true
      AND COALESCE(e.display_ready, false) = false
      AND j.status = 'failed'
      AND j.updated_at < now() - interval '24 hours'
    )
    OR
    (
      e.confirmed = true
      AND COALESCE(e.display_ready, false) = false
      AND j.status IS NULL
      AND e.confirmed_at IS NOT NULL
      AND e.confirmed_at < now() - interval '24 hours'
    )
  ) AS is_stalled,
  (
    e.confirmed = true
    AND COALESCE(e.display_ready, false) = false
    AND (
      j.status = 'succeeded'
      OR e.image_url LIKE '%/final/%'
    )
  ) AS is_ready_candidate,
  (
    COALESCE(e.display_ready, false) = true
    AND (e.display_end_at IS NULL OR e.display_end_at > now())
  ) AS is_live,
  (
    COALESCE(e.display_ready, false) = true
    AND e.display_end_at IS NOT NULL
    AND e.display_end_at <= now()
  ) AS is_ended
FROM public.entries e
LEFT JOIN public.entry_processing_jobs j
  ON j.entry_id = e.id;

COMMENT ON VIEW public.v_admin_entry_workflow IS
  'Admin workflow projection for entry operations and SLA-like monitoring.';
