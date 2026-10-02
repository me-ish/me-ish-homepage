-- Disposable installation guard; no notification row or customer operation is written.
do $$
declare expression text; candidate text; accepted boolean;
begin
 if current_setting('phase_t.sandbox',true) is distinct from 'ephemeral'
    or to_regclass('public.natori_intake_operations') is null
    or to_regclass('public.natori_consultation_operations') is null then
  raise exception 'phase3b_purpose_fixture_required';
 end if;
 select pg_get_expr(conbin,conrelid) into strict expression from pg_constraint
  where conrelid='public.natori_notification_jobs'::regclass
   and conname='natori_notification_jobs_purpose_check' and convalidated;
 foreach candidate in array array[
  'quote_accept_artist','delivery_accept_artist','delivery_accept_client','delivery_issue_client','quote_issue_client',
  'payment_received_artist','payment_received_client','payment_review_artist','payment_link_client',
  'refund_confirmed_artist','refund_review_artist','intake_artist','intake_client','consultation_staff','consultation_client'] loop
  execute 'select ('||expression||') from (select $1::text as purpose) allowed' into accepted using candidate;
  if accepted is distinct from true then raise exception 'phase3b_prior_notification_purpose_rejected';end if;
 end loop;
 execute 'select ('||expression||') from (select $1::text as purpose) allowed' into accepted using 'phase3b_unknown_purpose';
 if accepted is distinct from false then raise exception 'phase3b_unknown_notification_purpose_allowed';end if;
end$$;
