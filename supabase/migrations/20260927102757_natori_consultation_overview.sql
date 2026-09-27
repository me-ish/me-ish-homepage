-- Phase 4: read-only projection. No status/token/message backfill or new sender.
begin;
create function public.natori_consultation_overview_v1(p_owner_id uuid, p_project_ids uuid[])
returns table(project_id uuid, latest_message_id uuid, latest_sender text, latest_message_at timestamptz,
  notification_failed integer, notification_pending integer)
language sql stable security invoker set search_path = '' as $$
  select p.id, latest.id, latest.sender, latest.created_at,
    (legacy.failed + jobs.failed)::integer, (legacy.pending + jobs.pending)::integer
  from public.natori_projects p
  left join lateral (
    select m.id, m.sender, m.created_at from public.natori_consultation_messages m
    where m.project_id=p.id order by m.created_at desc, m.id desc limit 1
  ) latest on true
  cross join lateral (
    select count(*) filter (where m.notification_status='failed') as failed,
      count(*) filter (where m.notification_status='pending') as pending
    from public.natori_consultation_messages m where m.project_id=p.id
  ) legacy
  cross join lateral (
    select count(*) filter (where j.status in ('failed','unknown')) as failed,
      count(*) filter (where j.status in ('pending','sending')) as pending
    from (select distinct on (n.notification_key) n.status
      from public.natori_notification_jobs n where n.project_id=p.id
      order by n.notification_key, n.attempt_no desc) j
  ) jobs
  where p.user_id=p_owner_id and p.id=any(p_project_ids)
    and cardinality(p_project_ids) between 1 and 100;
$$;
revoke all on function public.natori_consultation_overview_v1(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.natori_consultation_overview_v1(uuid,uuid[]) to service_role;
-- Existing (project_id,created_at,id) and notification project indexes suffice.
commit;
