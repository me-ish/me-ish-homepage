-- Natori management RPCs are called exclusively by server-side API routes with
-- the service-role client. CREATE OR REPLACE FUNCTION preserves old ACLs, so
-- explicitly remove the grants that previously exposed these SECURITY DEFINER
-- functions through PostgREST.

revoke execute on function public.natori_create_project_with_tasks(uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
revoke execute on function public.natori_delete_project(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.natori_update_task_and_status(uuid, uuid, text, boolean, text, text)
  from public, anon, authenticated;
revoke execute on function public.natori_confirm_manual_payment(uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.natori_record_stripe_payment(uuid, text, integer, uuid)
  from public, anon, authenticated;
revoke execute on function public.natori_issue_quote(uuid, uuid, text, text, text, integer, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.natori_accept_quote(text)
  from public, anon, authenticated;

grant execute on function public.natori_create_project_with_tasks(uuid, jsonb, jsonb, jsonb)
  to service_role;
grant execute on function public.natori_delete_project(uuid, uuid)
  to service_role;
grant execute on function public.natori_update_task_and_status(uuid, uuid, text, boolean, text, text)
  to service_role;
grant execute on function public.natori_confirm_manual_payment(uuid, uuid, text)
  to service_role;
grant execute on function public.natori_record_stripe_payment(uuid, text, integer, uuid)
  to service_role;
grant execute on function public.natori_issue_quote(uuid, uuid, text, text, text, integer, text, text, text, timestamptz)
  to service_role;
grant execute on function public.natori_accept_quote(text)
  to service_role;
