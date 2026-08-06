-- P1-13 post-deploy release checks. Read-only; every result must be 0 unless noted.
-- Run the P1-03/P1-04/P1-05 verification scripts as part of the same release gate.

select count(*) as invalid_structured_request_count
from public.natori_projects
where request_data is not null
  and not public.natori_request_data_is_valid_v1(request_data);

-- Run immediately after each canary submission, before an administrator edits it.
select count(*) as recent_initial_state_anomaly_count
from public.natori_projects as projects
where projects.request_data is not null
  and projects.created_at >= current_timestamp - interval '30 minutes'
  and (
    projects.type <> 'undecided'
    or projects.status <> 'inquiry'
    or projects.amount is not null
    or projects.due_date is not null
    or projects.note is not null
    or exists (
      select 1
      from public.natori_project_tasks as tasks
      where tasks.project_id = projects.id
    )
  );

-- Immediately after canary submission, both results must be at least 1.
select
  count(*) filter (
    where request_data ->> 'inquiryMode' = 'consultation'
  ) as recent_consultation_canary_count,
  count(*) filter (
    where request_data ->> 'inquiryMode' = 'quote'
  ) as recent_quote_canary_count
from public.natori_projects
where request_data is not null
  and created_at >= current_timestamp - interval '30 minutes';

select count(*) as quote_snapshot_pair_anomaly_count
from public.natori_quotes
where (request_snapshot is null) <> (pricing_snapshot is null);

select count(*) as structured_quote_snapshot_anomaly_count
from public.natori_quotes
where pricing_snapshot is not null
  and (
    jsonb_typeof(pricing_snapshot) <> 'object'
    or pricing_snapshot ->> 'schemaVersion' <> '1'
    or pricing_snapshot ->> 'currency' <> 'JPY'
    or jsonb_typeof(pricing_snapshot -> 'items') <> 'array'
    or case
      when jsonb_typeof(pricing_snapshot -> 'total') = 'number'
       and pricing_snapshot ->> 'total' ~ '^[0-9]+$'
        then (pricing_snapshot ->> 'total')::numeric <> amount
      else true
    end
  );

select count(*) as active_quote_mirror_anomaly_count
from public.natori_projects as projects
join public.natori_quotes as quotes on quotes.id = projects.active_quote_id
where quotes.project_id <> projects.id
   or quotes.user_id <> projects.user_id
   or quotes.superseded_at is not null;

select count(*) as payment_quote_mirror_anomaly_count
from public.natori_projects as projects
join public.natori_quotes as quotes on quotes.id = projects.payment_quote_id
where quotes.project_id <> projects.id
   or quotes.user_id <> projects.user_id
   or projects.quoted_amount is distinct from quotes.amount;

select count(*) as client_role_rpc_execute_anomaly_count
from pg_proc as procedures
join pg_namespace as namespaces on namespaces.oid = procedures.pronamespace
where namespaces.nspname = 'public'
  and procedures.proname in (
    'natori_create_project_with_tasks_v2',
    'natori_confirm_project_type_v1',
    'natori_issue_quote_v2'
  )
  and (
    has_function_privilege('anon', procedures.oid, 'EXECUTE')
    or has_function_privilege('authenticated', procedures.oid, 'EXECUTE')
  );

select count(*) as private_storage_bucket_anomaly_count
from storage.buckets
where id in ('natori-inquiry-refs', 'natori-deliveries')
  and public is true;
