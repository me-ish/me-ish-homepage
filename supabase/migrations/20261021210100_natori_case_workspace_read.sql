-- Fixed owner-scoped case reads. No table, row, RLS or default-ACL changes.
-- Canonical source: scripts/natori-case-preview/readContract.ts + caseManagementQuery.ts.
-- service_role bypasses RLS: callers MUST use the server-resolved owner and
-- validate every returned owner/id before normalization. Never accept a browser owner.
-- Apply only through a separately approved service migration; local checks use
-- synthetic dependency tables, not a successful full historical migration replay.
BEGIN;

CREATE OR REPLACE FUNCTION public.natori_case_snapshot_v1(p_project_id uuid,p_owner_id uuid)
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $case_snapshot$
SELECT to_jsonb(envelope) FROM (WITH authorized_case AS MATERIALIZED (
  SELECT p.id, p.user_id, p.title, p.client_name, p.due_date, p.status, p.type, p.amount, p.active_quote_id,
    p.quote_accepted_at, p.quote_accepted_amount, p.payment_confirmed_at,
    p.paid_amount, p.paid_at, p.delivery_accepted_at, p.completed_at,
    p.delivered_mail_at, p.payment_link_id, p.payment_link_url, p.payment_link_status,
    p.stripe_payment_session_id, p.deleted_at, p.created_at, p.updated_at
  FROM public.natori_projects p
  WHERE p.id = $1::uuid AND p.user_id = $2::uuid
), project_intake_rows AS MATERIALIZED (SELECT o.operation_id::text AS id, o.project_id::text AS project_id,
    o.status, o.created_at, o.updated_at
    FROM public.natori_intake_operations o
    JOIN authorized_case p ON o.project_id = p.id AND o.owner_id = p.user_id),
project_registration_rows AS MATERIALIZED (select w.id::text,w.project_id::text,w.data->>'origin' as origin,w.created_at
 from public.natori_case_work_records w join authorized_case p on p.id=w.project_id and p.user_id=w.owner_id where w.kind='origin'),
financial_quotes_rows AS MATERIALIZED (SELECT q.id::text, q.project_id::text, q.user_id::text,
      q.version, q.amount, q.expires_at, q.accepted_at, q.superseded_at, q.created_at, q.issued_at
    FROM public.natori_quotes q JOIN authorized_case p ON q.project_id=p.id AND q.user_id=p.user_id),
financial_drafts_rows AS MATERIALIZED (SELECT d.project_id::text AS id, d.project_id::text,
      d.user_id::text, d.revision, d.updated_at
    FROM public.natori_estimate_drafts d JOIN authorized_case p ON d.project_id=p.id AND d.user_id=p.user_id),
financial_links_rows AS MATERIALIZED (SELECT a.id::text, a.project_id::text, a.owner_id::text,
      a.quote_id::text, a.generation, a.amount, a.state, a.deadline, a.deadline_revision,
      a.created_at, a.updated_at, (a.link_id IS NOT NULL AND a.link_url IS NOT NULL) AS has_provider_link,
      coalesce(a.link_id=p.payment_link_id AND a.link_url=p.payment_link_url,false) AS is_project_link
    FROM public.natori_payment_link_attempts a JOIN authorized_case p ON a.project_id=p.id AND a.owner_id=p.user_id),
financial_payments_rows AS MATERIALIZED (SELECT t.id::text, t.project_id::text, t.quote_id::text,
      t.amount, t.status, t.received_at, t.stripe_currency AS currency,
      (t.stripe_session_id IS NOT NULL) AS has_session,
      coalesce(t.stripe_session_id=p.stripe_payment_session_id,false) AS is_original,
      (p.stripe_payment_session_id IS NULL AND t.stripe_session_id IS NULL AND t.status='manual'
        AND t.received_at=p.payment_confirmed_at AND t.amount=p.paid_amount) IS TRUE AS is_manual_candidate,
      (t.status='needs_review' AND t.note='amount_unavailable') IS TRUE AS amount_unavailable,
      (t.status='received' AND t.stripe_account_scope IS NOT NULL AND t.stripe_livemode IS NOT NULL
        AND (t.stripe_payment_intent_id IS NOT NULL OR t.stripe_charge_id IS NOT NULL)) AS has_refund_mapping
    FROM public.natori_payment_transactions t JOIN authorized_case p ON t.project_id=p.id),
financial_inbox_rows AS MATERIALIZED (SELECT md5(jsonb_build_array(e.account_scope,e.livemode,e.event_id)::text) AS id,
      e.project_id::text, e.owner_id::text, e.status, e.created_at, e.updated_at
    FROM public.natori_stripe_event_inbox e JOIN authorized_case p ON e.project_id=p.id AND e.owner_id=p.user_id
    WHERE e.status IN ('processing','needs_review') AND (
      e.request->>'kind' IS DISTINCT FROM 'refund'
      OR e.error_code IN ('refund_snapshot_missing','refund_snapshot_incomplete','refund_id_missing','event_identity_conflict')
      OR e.status='processing')),
financial_refunds_rows AS MATERIALIZED (SELECT r.id::text, r.project_id::text, r.owner_id::text,
      r.transaction_id::text, r.amount, r.currency, r.provider_status, r.resolution,
      r.confirmed_at, r.created_at, r.updated_at,
      (r.claimed_project_id IS NULL OR r.claimed_project_id=p.id) AS project_matches
    FROM public.natori_refund_ledger r JOIN authorized_case p ON r.project_id=p.id AND r.owner_id=p.user_id),
financial_notifications_rows AS MATERIALIZED (SELECT j.id::text, j.project_id::text, j.quote_id::text,
      md5(j.notification_key) AS notification_key, j.attempt_no, j.purpose, j.status,
      j.sent_at, j.created_at, j.updated_at,
      jsonb_build_object('version',j.snapshot->'version','amount',j.snapshot->'amount',
        'acceptedAt',j.snapshot->'acceptedAt','attemptId',j.snapshot->'attemptId',
        'generation',j.snapshot->'generation','deadline',j.snapshot->'deadline',
        'releaseId',j.snapshot->'releaseId','roughId',j.snapshot->'roughId',
        'clientOkAt',j.snapshot->'clientOkAt','messageId',j.snapshot->'messageId',
        'operationId',j.snapshot->'operationId') AS snapshot,
      r.id::text AS release_id, r.expires_at AS release_expires_at, r.accepted_at AS release_accepted_at,
      m.id::text AS message_id, m.created_at AS message_created_at, m.sender AS message_sender,
      m.operation_id::text AS message_operation_id,
      e.rough_id::text AS rough_id, e.client_ok_at AS rough_ok_at
    FROM public.natori_notification_jobs j JOIN authorized_case p ON j.project_id=p.id
    LEFT JOIN public.natori_delivery_releases r ON r.project_id=p.id AND
      ((j.purpose='delivery_issue_client' AND r.id::text=j.snapshot->>'releaseId')
        OR j.purpose IN ('delivery_accept_artist','delivery_accept_client'))
    LEFT JOIN public.natori_consultation_messages m ON m.project_id=p.id AND m.id::text=j.snapshot->>'messageId'
    LEFT JOIN public.natori_rough_ok_events e ON e.project_id=p.id AND e.rough_id::text=j.snapshot->>'roughId'),
financial_legacy_notices_rows AS MATERIALIZED (SELECT l.id::text, l.project_id::text, l.quote_id::text,
      l.kind, l.amount, l.status, l.sent_at, l.created_at, l.updated_at,
      a.id::text AS attempt_id
    FROM public.natori_order_mail_logs l JOIN authorized_case p ON l.project_id=p.id
    LEFT JOIN public.natori_payment_link_attempts a ON a.project_id=p.id AND a.owner_id=p.user_id
      AND l.kind='payment' AND a.link_url=l.link_url AND a.quote_id=l.quote_id AND a.amount=l.amount),
financial_quote_operations_rows AS MATERIALIZED (SELECT o.operation_id::text AS id, o.project_id::text,
      o.quote_id::text, o.notification_id::text, o.created_at
    FROM public.natori_quote_issue_operations o JOIN authorized_case p ON o.project_id=p.id),
financial_link_operations_rows AS MATERIALIZED (SELECT o.operation_id::text AS id, o.project_id::text,
      o.attempt_id::text, o.action, o.status, o.proposed_deadline, o.expected_revision,
      o.notification_id::text, o.created_at,
      (SELECT jsonb_build_object('id',r.id,'kind',r.kind,'at',r.created_at) FROM public.natori_case_reconciliation_resolutions r
       WHERE r.id=o.reconciliation_id AND r.project_id=o.project_id AND r.target_id=o.operation_id) AS reconciliation
    FROM public.natori_payment_link_operations o JOIN authorized_case p ON o.project_id=p.id),
financial_link_stops_rows AS MATERIALIZED (SELECT s.id::text, s.project_id::text, s.owner_id::text,
      s.attempt_id::text, s.deadline_revision, s.status, s.created_at, s.updated_at
    FROM public.natori_payment_link_stops s JOIN authorized_case p ON s.project_id=p.id AND s.owner_id=p.user_id),
financial_delivery_operations_rows AS MATERIALIZED (SELECT o.operation_id::text AS id, o.project_id::text,
      o.release_id::text, o.notification_id::text, o.created_at,
      r.expires_at AS original_expires_at, x.new_expires_at AS extension_expires_at,
      md5(j.notification_key) AS notification_key
    FROM public.natori_delivery_operations o JOIN authorized_case p ON o.project_id=p.id
    LEFT JOIN public.natori_delivery_releases r ON r.id=o.release_id AND r.project_id=p.id
    LEFT JOIN public.natori_delivery_extensions x ON x.project_id=p.id AND x.release_id=r.id AND x.operation_id=o.operation_id
    LEFT JOIN public.natori_notification_jobs j ON j.id=o.notification_id AND j.project_id=p.id AND j.purpose='delivery_issue_client'),
financial_consultation_operations_rows AS MATERIALIZED (SELECT
      o.sender||'/'||o.operation_id::text AS id, o.project_id::text, o.operation_id::text,
      o.sender, o.status, o.message_id::text, o.notification_id::text, o.created_at,
      m.created_at AS message_created_at
    FROM public.natori_consultation_operations o JOIN authorized_case p ON o.project_id=p.id
    LEFT JOIN public.natori_consultation_messages m ON m.id=o.message_id AND m.project_id=p.id
      AND m.sender=o.sender AND m.operation_id=o.operation_id),
lifecycle_tasks_rows AS MATERIALIZED (
    select t.id::text, t.project_id::text, t.task_key, t.stage, t.done, t.sort_order
    from public.natori_project_tasks t join authorized_case p on p.id=t.project_id),
lifecycle_files_rows AS MATERIALIZED (
    select f.id::text, f.project_id::text, f.folder, f.state, f.size_bytes,
      f.storage_version, f.verified_at, f.deleted_at, f.created_at,
      coalesce(length(f.content_type)>0,false) as content_type_valid
    from public.natori_delivery_files f join authorized_case p on p.id=f.project_id),
lifecycle_roughs_rows AS MATERIALIZED (
    select r.id::text, r.project_id::text, r.message_id::text, r.before_quote,
      r.created_at, r.client_ok_at,
      exists(select 1 from public.natori_case_work_records w where w.project_id=p.id and w.kind='revision_open' and w.data->>'roughId'=r.id::text
        and not exists(select 1 from public.natori_case_work_records h where h.project_id=p.id and h.kind='revision_handled' and h.data->>'requestId'=w.id::text)) as revision_pending,
      (select h.data->>'nextRoughId' from public.natori_case_work_records h join public.natori_case_work_records o on o.id::text=h.data->>'requestId'
        where h.project_id=p.id and o.project_id=p.id and h.kind='revision_handled' and o.kind='revision_open'
        and o.data->>'roughId'=r.id::text and h.data->>'nextRoughId' is not null limit 1) as superseded_by,
      exists(select 1 from public.natori_consultation_messages m
        where m.id=r.message_id and m.project_id=p.id and m.sender='staff') as message_bound
    from public.natori_talk_roughs r join authorized_case p on p.id=r.project_id),
lifecycle_rough_acknowledgements_rows AS MATERIALIZED (
    select a.rough_id::text as id, a.project_id::text, a.owner_id::text,
      a.client_ok_at, a.acknowledged_at
    from public.natori_rough_ok_acknowledgements a join authorized_case p
      on p.id=a.project_id and p.user_id=a.owner_id),
lifecycle_releases_rows AS MATERIALIZED (
    select r.id::text, r.project_id::text, r.revision, r.published_at, r.expires_at,
      r.accepted_at, r.legacy,
      exists(select 1 from public.natori_notification_jobs j where j.project_id=p.id and j.purpose='delivery_issue_client'
        and j.snapshot->>'releaseId'=r.id::text and j.case_work_guard is not null) as case_work,
      case when jsonb_typeof(r.manifest)='array' then
        (select jsonb_agg(jsonb_build_object('id',m->'id','size_bytes',m->'sizeBytes',
          'storage_version',m->'storageVersion')) from jsonb_array_elements(r.manifest) m)
        else null end as manifest_files,
      case when jsonb_typeof(r.manifest)='array' then
        jsonb_array_length(r.manifest) between 1 and 10 and not exists(
          select 1 from jsonb_array_elements(r.manifest) m where
            jsonb_typeof(m) is distinct from 'object'
            or jsonb_typeof(m->'id') is distinct from 'string'
            or jsonb_typeof(m->'path') is distinct from 'string'
            or jsonb_typeof(m->'fileName') is distinct from 'string'
            or jsonb_typeof(m->'sizeBytes') is distinct from 'number'
            or jsonb_typeof(m->'contentType') is distinct from 'string'
            or coalesce(length(m->>'contentType'),0)=0
            or jsonb_typeof(m->'storageVersion') is distinct from 'string'
            or coalesce(length(m->>'storageVersion'),0)=0)
        else false end as manifest_shape_valid,
      case when jsonb_typeof(r.manifest)='array' then not exists(
        select 1 from jsonb_array_elements(r.manifest) m where not exists(
          select 1 from public.natori_delivery_files f where f.project_id=p.id
            and f.id::text=m->>'id' and f.folder='final' and f.deleted_at is null
            and f.storage_path=m->>'path' and f.file_name=m->>'fileName'
            and f.size_bytes::text=m->>'sizeBytes' and f.content_type=m->>'contentType'
            and f.storage_version=m->>'storageVersion'))
        else false end as manifest_bindings_valid
    from public.natori_delivery_releases r join authorized_case p on p.id=r.project_id),
lifecycle_extensions_rows AS MATERIALIZED (
    select x.id::text, x.project_id::text, x.release_id::text, x.operation_id::text,
      x.previous_expires_at, x.new_expires_at, x.created_at
    from public.natori_delivery_extensions x join authorized_case p on p.id=x.project_id),
lifecycle_consultation_rows AS MATERIALIZED (
    select m.id::text, m.project_id::text, m.sender, m.created_at
    from public.natori_consultation_messages m join authorized_case p on p.id=m.project_id)
SELECT md5(pg_current_snapshot()::text || '/' || statement_timestamp()::text) AS snapshot_id,
  (to_jsonb(statement_timestamp()) #>> '{}') AS observed_at,
  jsonb_build_object(
    'id', p.id, 'user_id', p.user_id, 'title', p.title, 'client_name', p.client_name, 'due_date', p.due_date,
    'status', p.status, 'type', p.type, 'amount', p.amount,
    'active_quote_id', p.active_quote_id, 'quote_accepted_at', p.quote_accepted_at,
    'quote_accepted_amount', p.quote_accepted_amount, 'payment_confirmed_at', p.payment_confirmed_at,
    'paid_amount', p.paid_amount, 'paid_at', p.paid_at, 'delivery_accepted_at', p.delivery_accepted_at,
    'completed_at', p.completed_at, 'delivered_mail_at', p.delivered_mail_at,
    'has_legacy_payment_link', (p.payment_link_id IS NOT NULL OR p.payment_link_url IS NOT NULL),
    'payment_link_status', p.payment_link_status, 'deleted_at', p.deleted_at,
    'created_at', p.created_at, 'updated_at', p.updated_at
  ) AS project,
  jsonb_build_object(
    'project_intake', jsonb_build_object(
      'total', (SELECT count(*) FROM project_intake_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM project_intake_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'project_registration', jsonb_build_object(
      'total', (SELECT count(*) FROM project_registration_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM project_registration_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'financial_quotes', jsonb_build_object(
      'total', (SELECT count(*) FROM financial_quotes_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM financial_quotes_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'financial_drafts', jsonb_build_object(
      'total', (SELECT count(*) FROM financial_drafts_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM financial_drafts_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'financial_links', jsonb_build_object(
      'total', (SELECT count(*) FROM financial_links_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM financial_links_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'financial_payments', jsonb_build_object(
      'total', (SELECT count(*) FROM financial_payments_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM financial_payments_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'financial_inbox', jsonb_build_object(
      'total', (SELECT count(*) FROM financial_inbox_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM financial_inbox_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'financial_refunds', jsonb_build_object(
      'total', (SELECT count(*) FROM financial_refunds_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM financial_refunds_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'financial_notifications', jsonb_build_object(
      'total', (SELECT count(*) FROM financial_notifications_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM financial_notifications_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'financial_legacy_notices', jsonb_build_object(
      'total', (SELECT count(*) FROM financial_legacy_notices_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM financial_legacy_notices_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'financial_quote_operations', jsonb_build_object(
      'total', (SELECT count(*) FROM financial_quote_operations_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM financial_quote_operations_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'financial_link_operations', jsonb_build_object(
      'total', (SELECT count(*) FROM financial_link_operations_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM financial_link_operations_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'financial_link_stops', jsonb_build_object(
      'total', (SELECT count(*) FROM financial_link_stops_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM financial_link_stops_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'financial_delivery_operations', jsonb_build_object(
      'total', (SELECT count(*) FROM financial_delivery_operations_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM financial_delivery_operations_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'financial_consultation_operations', jsonb_build_object(
      'total', (SELECT count(*) FROM financial_consultation_operations_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM financial_consultation_operations_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'lifecycle_tasks', jsonb_build_object(
      'total', (SELECT count(*) FROM lifecycle_tasks_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM lifecycle_tasks_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'lifecycle_files', jsonb_build_object(
      'total', (SELECT count(*) FROM lifecycle_files_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM lifecycle_files_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'lifecycle_roughs', jsonb_build_object(
      'total', (SELECT count(*) FROM lifecycle_roughs_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM lifecycle_roughs_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'lifecycle_rough_acknowledgements', jsonb_build_object(
      'total', (SELECT count(*) FROM lifecycle_rough_acknowledgements_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM lifecycle_rough_acknowledgements_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'lifecycle_releases', jsonb_build_object(
      'total', (SELECT count(*) FROM lifecycle_releases_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM lifecycle_releases_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'lifecycle_extensions', jsonb_build_object(
      'total', (SELECT count(*) FROM lifecycle_extensions_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM lifecycle_extensions_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    ),
    'lifecycle_consultation', jsonb_build_object(
      'total', (SELECT count(*) FROM lifecycle_consultation_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM lifecycle_consultation_rows ORDER BY id LIMIT 201) bounded), '[]'::jsonb)
    )
  ) AS sections
FROM authorized_case p) envelope
$case_snapshot$;
REVOKE ALL ON FUNCTION public.natori_case_snapshot_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.natori_case_snapshot_v1(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.natori_case_workspace_v1(p_owner_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $case_workspace$
WITH owned AS MATERIALIZED (
 SELECT p.id FROM public.natori_projects p WHERE p.user_id=p_owner_id ORDER BY p.id LIMIT 51
), bounded AS MATERIALIZED (
 SELECT id FROM owned WHERE (SELECT count(*) FROM owned)<=50
)
SELECT jsonb_build_object('complete',(SELECT count(*) FROM owned)<=50,
 'rows',COALESCE((SELECT jsonb_agg(s.snapshot ORDER BY b.id)
 FROM bounded b CROSS JOIN LATERAL public.natori_case_snapshot_v1(b.id,p_owner_id) AS s(snapshot)),'[]'::jsonb))
$case_workspace$;
REVOKE ALL ON FUNCTION public.natori_case_workspace_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.natori_case_workspace_v1(uuid) TO service_role;

-- Unexpected defaults or inherited browser execution rights abort atomically.
-- The function owner retains PostgreSQL's intrinsic owner rights. Explicit
-- EXECUTE grants are limited to that owner and service_role; service_role must
-- not have a delegated grant option.
DO $case_read_security$
DECLARE target oid;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'public.natori_case_snapshot_v1(uuid,uuid)'::regprocedure::oid,
    'public.natori_case_workspace_v1(uuid)'::regprocedure::oid
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc f WHERE f.oid=target
        AND f.provolatile='s' AND NOT f.prosecdef AND f.prokind='f'
        AND f.proconfig=ARRAY['search_path=""']::text[]
    ) OR pg_catalog.has_function_privilege('anon',target,'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated',target,'EXECUTE')
      OR NOT pg_catalog.has_function_privilege('service_role',target,'EXECUTE')
      OR EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc f
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          COALESCE(f.proacl,pg_catalog.acldefault('f',f.proowner))) a
        WHERE f.oid=target AND a.privilege_type='EXECUTE'
          AND ((a.grantee<>f.proowner AND a.grantee<>'service_role'::regrole::oid)
            OR (a.grantee<>f.proowner AND a.is_grantable))
      ) THEN
      RAISE EXCEPTION 'NATORI_CASE_READ_SECURITY_CONTRACT_REQUIRED';
    END IF;
  END LOOP;
END
$case_read_security$;
COMMIT;
