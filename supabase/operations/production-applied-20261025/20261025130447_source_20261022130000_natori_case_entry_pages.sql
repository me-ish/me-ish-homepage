-- Additive read transport for the opt-in entry preview. Existing readers/writers unchanged.
-- A bounded page is never presented as a complete collection. Changing catalogues
-- invalidate the next page instead of shifting an offset silently.
BEGIN;
CREATE FUNCTION public.natori_case_entry_page_v1(p_owner_id uuid,p_kind text,p_offset integer DEFAULT 0,p_revision text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $entry_page$
DECLARE catalogue jsonb; fingerprint text; size integer; page_rows jsonb;
BEGIN
  IF p_owner_id IS NULL OR p_offset IS NULL OR p_offset<0 OR p_kind IS NULL
    OR p_kind NOT IN ('cases','events','notices') OR (p_offset>0 AND p_revision IS NULL) THEN
    RAISE EXCEPTION 'case_entry_page_invalid';
  END IF;
  IF p_kind='cases' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'revision',p.updated_at) ORDER BY p.id),'[]'::jsonb)
      INTO catalogue FROM public.natori_projects p WHERE p.user_id=p_owner_id;
  ELSIF p_kind='events' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'user_id',e.user_id,'title',e.title,'date',e.date,'note',e.note) ORDER BY e.date,e.id),'[]'::jsonb)
      INTO catalogue FROM public.natori_events e WHERE e.user_id=p_owner_id;
  ELSE
    WITH latest AS (
      SELECT DISTINCT ON(j.notification_key) j.*,p.user_id,p.title AS project_title
      FROM public.natori_notification_jobs j JOIN public.natori_projects p ON p.id=j.project_id
      WHERE p.user_id=p_owner_id ORDER BY j.notification_key,j.attempt_no DESC,j.id
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',j.id,'user_id',j.user_id,'project_id',j.project_id,
      'project_title',j.project_title,'purpose',j.purpose,'status',j.status,'attempt_no',j.attempt_no,
      'sent_at',j.sent_at,'created_at',j.created_at,'updated_at',j.updated_at,
      'target_id',CASE WHEN j.purpose IN ('quote_issue_client','quote_accept_artist') THEN j.quote_id::text
        WHEN j.purpose='payment_link_client' THEN j.snapshot->>'attemptId'
        WHEN j.purpose LIKE 'delivery_%' THEN j.snapshot->>'releaseId'
        WHEN j.purpose='rough_ok_artist' THEN j.snapshot->>'roughId'
        WHEN j.purpose LIKE 'consultation_%' THEN j.snapshot->>'messageId' ELSE NULL END,
      'target_revision',CASE WHEN j.purpose='quote_issue_client' THEN j.snapshot->>'version'
        WHEN j.purpose='quote_accept_artist' THEN j.snapshot->>'acceptedAt'
        WHEN j.purpose IN ('payment_link_client','delivery_issue_client') THEN j.snapshot->>'deadline'
        WHEN j.purpose LIKE 'delivery_accept_%' THEN j.snapshot->>'acceptedAt'
        WHEN j.purpose='rough_ok_artist' THEN j.snapshot->>'clientOkAt' ELSE NULL END)
      ORDER BY (j.status='sent'),j.created_at DESC,j.id),'[]'::jsonb) INTO catalogue FROM latest j;
  END IF;
  size:=jsonb_array_length(catalogue); fingerprint:=md5(catalogue::text);
  IF p_revision IS NOT NULL AND p_revision IS DISTINCT FROM fingerprint THEN
    RETURN jsonb_build_object('changed',true,'revision',fingerprint,'total',size,'offset',p_offset,'rows','[]'::jsonb,'next',NULL);
  END IF;
  IF p_offset>size THEN RAISE EXCEPTION 'case_entry_page_invalid'; END IF;
  IF p_kind='cases' THEN
    SELECT coalesce(jsonb_agg(s.snapshot ORDER BY r.ordinality),'[]'::jsonb) INTO page_rows
      FROM jsonb_array_elements(catalogue) WITH ORDINALITY r(value,ordinality)
      CROSS JOIN LATERAL public.natori_case_snapshot_v1((r.value->>'id')::uuid,p_owner_id) s(snapshot)
      WHERE r.ordinality>p_offset AND r.ordinality<=p_offset+50::bigint;
  ELSE
    SELECT coalesce(jsonb_agg(r.value ORDER BY r.ordinality),'[]'::jsonb) INTO page_rows
      FROM jsonb_array_elements(catalogue) WITH ORDINALITY r(value,ordinality)
      WHERE r.ordinality>p_offset AND r.ordinality<=p_offset+50::bigint;
  END IF;
  RETURN jsonb_build_object('changed',false,'revision',fingerprint,'total',size,'offset',p_offset,'rows',page_rows,
    'next',CASE WHEN p_offset+jsonb_array_length(page_rows)<size THEN p_offset+jsonb_array_length(page_rows) ELSE NULL END);
END
$entry_page$;
REVOKE ALL ON FUNCTION public.natori_case_entry_page_v1(uuid,text,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.natori_case_entry_page_v1(uuid,text,integer,text) TO service_role;
COMMIT;
