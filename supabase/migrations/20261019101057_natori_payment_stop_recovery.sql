-- O01: observability and exact-job recovery only. No links or money facts are rewritten.
begin;
create table public.natori_payment_stop_runs (
 id uuid primary key, owner_id uuid not null references auth.users(id),
 started_at timestamptz not null default clock_timestamp(), finished_at timestamptz,
 outcome text check(outcome in ('ok','partial','db-error','not-configured')),
 scanned integer check(scanned>=0), expired integer check(expired>=0),
 skipped integer check(skipped>=0), failed integer check(failed>=0),
 check ((finished_at is null and outcome is null) or (finished_at is not null and outcome is not null))
);
create index natori_payment_stop_runs_owner_started on public.natori_payment_stop_runs(owner_id,started_at desc);
alter table public.natori_payment_stop_runs enable row level security;
revoke all on public.natori_payment_stop_runs from public,anon,authenticated,service_role;
grant select,insert,update on public.natori_payment_stop_runs to service_role;

create function public.natori_payment_stop_run_v1(p_owner_id uuid,p_run_id uuid,p_result jsonb default null)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_owner_id is null or p_run_id is null then return false; end if;
 if p_result is null then
  insert into public.natori_payment_stop_runs(id,owner_id) values(p_run_id,p_owner_id) on conflict(id) do nothing;
  return found;
 end if;
 if p_result->>'kind' not in ('ok','db-error','not-configured') then return false; end if;
 update public.natori_payment_stop_runs set finished_at=clock_timestamp(),
  outcome=case when p_result->>'kind'='ok' and (p_result->>'failed')::integer>0 then 'partial' else p_result->>'kind' end,
  scanned=(p_result->>'scanned')::integer,expired=(p_result->>'expired')::integer,
  skipped=(p_result->>'skipped')::integer,failed=(p_result->>'failed')::integer
  where id=p_run_id and owner_id=p_owner_id and finished_at is null;
 return found;
end; $$;

-- Read-only owner-scoped snapshot. No provider identifiers or capability URLs leave this RPC.
create function public.natori_payment_stop_status_v1(p_owner_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 with unresolved as (
  select s.id,s.project_id,p.title,s.status,s.created_at,s.updated_at,s.lease_until
  from public.natori_payment_link_stops s join public.natori_projects p on p.id=s.project_id
  where s.owner_id=p_owner_id and p.user_id=p_owner_id and s.status<>'completed'
 ), page as (select * from unresolved order by created_at,id limit 50)
 select jsonb_build_object('enabled',true,'checkedAt',statement_timestamp(),
  'unresolved',(select count(*) from unresolved),'oldestAt',(select min(created_at) from unresolved),
  'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'projectId',project_id,'title',coalesce(title,''),
   'status',status,'createdAt',created_at,'leaseUntil',lease_until) order by created_at,id) from page),'[]'::jsonb),
  'lastRun',(select jsonb_build_object('startedAt',started_at,'finishedAt',finished_at,'outcome',outcome,'failed',failed)
   from public.natori_payment_stop_runs where owner_id=p_owner_id order by started_at desc,id desc limit 1),
  'lastCompletedAt',(select max(finished_at) from public.natori_payment_stop_runs where owner_id=p_owner_id));
$$;

-- Serialize with the same project-first lock and delegate the actual claim/fence to PAY-03.
create function public.natori_payment_stop_claim_v1(p_owner_id uuid,p_project_id uuid,p_job_id uuid,p_token uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; latest public.natori_payment_link_attempts%rowtype;
 a public.natori_payment_link_attempts%rowtype; s public.natori_payment_link_stops%rowtype; first_id uuid;
begin
 if p_owner_id is null or p_token is null then return jsonb_build_object('result','not_found'); end if;
 select * into p from public.natori_projects where id=p_project_id and user_id=p_owner_id for update;
 if not found then return jsonb_build_object('result','not_found'); end if;
 select * into latest from public.natori_payment_link_attempts where project_id=p.id order by generation desc limit 1 for update;
 select * into s from public.natori_payment_link_stops where id=p_job_id and project_id=p.id and owner_id=p_owner_id for update;
 if not found then return jsonb_build_object('result','not_found'); end if;
 if s.status='completed' then return jsonb_build_object('result','completed'); end if;
 if s.attempt_id is null then return jsonb_build_object('result','needs_review'); end if;
 select * into a from public.natori_payment_link_attempts where id=s.attempt_id and project_id=p.id and owner_id=p_owner_id for update;
 if not found or a.link_id is distinct from s.link_id or a.livemode is distinct from s.livemode then
  return jsonb_build_object('result','needs_review'); end if;
 if a.id=latest.id and a.state<>'inactive' and a.deadline>clock_timestamp()
  and p.status<>'closed' and p.deleted_at is null and p.payment_confirmed_at is null then
  return jsonb_build_object('result','not_due'); end if;
 if s.reason='deadline' and a.deadline_revision is distinct from s.deadline_revision then
  return jsonb_build_object('result','needs_review'); end if;
 -- Do not reset a live lease. needs_review is retried only for this explicitly selected job.
 if s.status='processing' and s.lease_until>clock_timestamp() then return jsonb_build_object('result','busy'); end if;
 select id into first_id from public.natori_payment_link_stops where project_id=p.id
  and (status in ('pending','processing') or id=s.id) order by created_at,id limit 1;
 if first_id is distinct from s.id then return jsonb_build_object('result','earlier_job_pending'); end if;
 if s.status='needs_review' then update public.natori_payment_link_stops set status='pending' where id=s.id; end if;
 return public.natori_payment_links_v1(p_owner_id,p_project_id,'claim_stop',jsonb_build_object('token',p_token));
end; $$;
revoke all on function public.natori_payment_stop_run_v1(uuid,uuid,jsonb),
 public.natori_payment_stop_status_v1(uuid),public.natori_payment_stop_claim_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.natori_payment_stop_run_v1(uuid,uuid,jsonb),
 public.natori_payment_stop_status_v1(uuid),public.natori_payment_stop_claim_v1(uuid,uuid,uuid,uuid) to service_role;
commit;
