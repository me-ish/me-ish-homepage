-- Workspace-only confirmation and response-loss recovery. Existing engines and callers remain intact.
begin;
create table public.natori_case_admin_operations (
 owner_id uuid not null references auth.users(id), id uuid not null,
 project_id uuid not null references public.natori_projects(id), command text not null,
 request_hash text not null, operator jsonb not null, response jsonb not null,
 created_at timestamptz not null default clock_timestamp(), primary key(owner_id,id)
);
alter table public.natori_case_admin_operations enable row level security;
revoke all on public.natori_case_admin_operations from public,anon,authenticated,service_role;
grant select,insert on public.natori_case_admin_operations to service_role;
create trigger natori_case_admin_immutable before update or delete on public.natori_case_admin_operations
 for each row execute function public.natori_case_reconciliation_immutable_v1();

-- Purpose-specific positive target facts. Index rows and similar names are never authority.
create function public.natori_case_admin_notice_target_v1(p public.natori_projects,j public.natori_notification_jobs)
returns boolean language plpgsql volatile security invoker set search_path='' as $$
begin
 if j.project_id is distinct from p.id then return false;end if;
 if j.purpose='quote_issue_client' then return p.deleted_at is null and p.status<>'closed' and exists(select 1 from public.natori_quotes q
  where q.id=j.quote_id and q.id=p.active_quote_id and q.project_id=p.id and q.superseded_at is null and (
   (q.accepted_at is null and q.expires_at=(j.payload->>'expiresAt')::timestamptz and q.expires_at>clock_timestamp())
   or (j.payload->>'caseQuoteAccessHash' is not null and exists(select 1 from public.natori_quote_access a where a.quote_id=q.id and a.token_hash=j.payload->>'caseQuoteAccessHash' and a.expires_at=(j.payload->>'expiresAt')::timestamptz and a.expires_at>clock_timestamp()))
  ));
 elsif j.purpose='quote_accept_artist' then return exists(select 1 from public.natori_quotes q where q.id=j.quote_id and q.project_id=p.id
  and q.accepted_at=(j.snapshot->>'acceptedAt')::timestamptz and q.amount=(j.snapshot->>'amount')::integer);
 elsif j.purpose='payment_link_client' then return p.deleted_at is null and p.status<>'closed' and p.payment_confirmed_at is null and exists(select 1 from public.natori_payment_link_attempts a
  where a.id=(j.snapshot->>'attemptId')::uuid and a.project_id=p.id and a.quote_id=p.active_quote_id and a.state='active'
  and a.deadline=(j.snapshot->>'deadline')::timestamptz and a.deadline>clock_timestamp()+interval '45 seconds');
 elsif j.purpose='delivery_issue_client' then return p.deleted_at is null and p.status<>'closed' and p.delivery_accepted_at is null and exists(select 1 from public.natori_delivery_releases r
  where r.id=(j.snapshot->>'releaseId')::uuid and r.project_id=p.id and (j.payload->>'expiresAt')::timestamptz=p.delivery_token_expires_at and p.delivery_token_expires_at>clock_timestamp());
 elsif j.purpose in ('delivery_accept_artist','delivery_accept_client') then return p.delivery_accepted_at is not null and p.delivery_accepted_at=(j.snapshot->>'acceptedAt')::timestamptz;
 elsif j.purpose='rough_ok_artist' then return exists(select 1 from public.natori_talk_roughs r where r.project_id=p.id and r.id=(j.snapshot->>'roughId')::uuid and r.client_ok_at=(j.snapshot->>'clientOkAt')::timestamptz);
 elsif j.purpose in ('consultation_staff','consultation_client') then return p.deleted_at is null and p.status<>'closed' and exists(select 1 from public.natori_consultation_messages m where m.project_id=p.id and m.id=(j.snapshot->>'messageId')::uuid);
 elsif j.purpose in ('intake_artist','intake_client') then return exists(select 1 from public.natori_intake_operations o where o.project_id=p.id and o.owner_id=p.user_id and o.operation_id=(j.snapshot->>'receipt')::uuid and o.status='completed' and exists(select 1 from public.natori_notification_jobs root where root.id=any(o.notification_ids) and root.notification_key=j.notification_key));
 elsif j.purpose in ('payment_received_artist','payment_received_client') then return p.payment_confirmed_at is not null and p.paid_amount=(j.snapshot->>'amount')::integer and exists(select 1 from public.natori_payment_transactions t where t.project_id=p.id and t.status='received' and t.amount=p.paid_amount and t.stripe_session_id=j.snapshot->>'sessionId' and t.quote_id is not distinct from j.quote_id and j.notification_key='payment/'||t.stripe_account_scope||'/'||t.stripe_livemode::text||'/'||t.stripe_session_id||'/'||j.purpose);
 elsif j.purpose='payment_review_artist' then return exists(select 1 from public.natori_stripe_event_inbox e where e.project_id=p.id and e.owner_id=p.user_id and e.status='needs_review'
  and e.request->>'sessionId' is not distinct from j.snapshot->>'sessionId' and e.result=j.snapshot->>'reviewReason'
  and e.request->'amount' is not distinct from j.snapshot->'amount'
  and j.notification_key='payment/'||e.account_scope||'/'||e.livemode::text||'/'||coalesce(e.request->>'sessionId','event-'||e.event_id)||'/payment_review_artist'
  and exists(select 1 from public.natori_notification_jobs root where root.id=any(e.notification_ids) and root.notification_key=j.notification_key));
 elsif j.purpose in ('refund_confirmed_artist','refund_review_artist') then return exists(select 1 from public.natori_refund_ledger r where r.project_id=p.id and r.owner_id=p.user_id and r.refund_id=j.snapshot->>'refundId'
  and j.notification_key='refund/'||r.account_scope||'/'||r.livemode::text||'/'||r.refund_id||'/'||j.purpose
  and r.provider_status=j.snapshot->>'providerStatus' and r.amount is not distinct from (j.snapshot->>'amount')::bigint and r.currency is not distinct from j.snapshot->>'currency'
  and coalesce(r.review_reason,r.provider_status)=j.snapshot->>'reviewReason'
  and ((j.purpose='refund_review_artist' and (r.resolution='needs_review' or r.provider_status in ('failed','canceled'))) or (j.purpose='refund_confirmed_artist' and r.provider_status='succeeded' and r.resolution='resolved')));
 end if;
 return false;
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then return false;
end $$;

create function public.natori_case_admin_lookup_v1(p_owner uuid,p_operation uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select response||jsonb_build_object('operationId',id,'command',command,'projectId',project_id)
 from public.natori_case_admin_operations where owner_id=p_owner and id=p_operation
$$;
create function public.natori_case_admin_read_v1(p_owner uuid,p_project uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$
 select jsonb_build_object('project',public.natori_task_projection_v1(p),
 'revision',public.natori_case_work_revision_v1(p.id),'acceptance',jsonb_build_object('at',p.quote_accepted_at,'amount',p.quote_accepted_amount),
 'quote',(select jsonb_build_object('id',q.id,'version',q.version,'amount',q.amount,'acceptedAt',q.accepted_at,'to',q.to_email,'subject',q.subject,'body',q.body_snapshot,'expiresAt',q.expires_at) from public.natori_quotes q where q.id=p.active_quote_id and q.project_id=p.id and q.user_id=p_owner),
 'complete',(select count(distinct j.notification_key)<=200 from public.natori_notification_jobs j where j.project_id=p.id),
 'notices',coalesce((select jsonb_agg(to_jsonb(n) order by (n.status in ('pending','sending','unknown')) desc,(n.status='failed') desc,n.created_at desc,n.id) from
  (select j.id,j.purpose,j.status,j.attempt_no,j.quote_id,j.created_at,j.sent_at,
    j.snapshot->>'deadline' as deadline,
    (j.status in ('failed','pending') and (j.payload is not null or (j.send_started_at is null and j.purpose not in ('quote_issue_client','delivery_issue_client','payment_link_client','consultation_staff','consultation_client'))) and j.claim_count<8 and j.attempt_no<5
     and not exists(select 1 from public.natori_notification_jobs newer where newer.notification_key=j.notification_key and newer.attempt_no>j.attempt_no)
     and coalesce(j.lease_expires_at,'-infinity')<=clock_timestamp() and coalesce(j.retry_after,'-infinity')<=clock_timestamp()
     and (j.status='failed' or j.send_started_at is null) and public.natori_case_admin_notice_target_v1(p,j)) as retry_candidate
   from public.natori_notification_jobs j where j.project_id=p.id and not exists(select 1 from public.natori_notification_jobs newer where newer.notification_key=j.notification_key and newer.attempt_no>j.attempt_no)
   order by (j.status in ('pending','sending','unknown')) desc,(j.status='failed') desc,j.created_at desc,j.id limit 200) n),'[]'::jsonb))
 from public.natori_projects p where p.id=p_project and p.user_id=p_owner
$$;

-- A replay is checked before reconstructing or decrypting any retired message.
-- Derived payload and current operator are not part of the frozen business request.
create function public.natori_case_admin_replay_v1(p_owner uuid,p_operation uuid,p_project uuid,p_command text,p_revision text,p_input jsonb) returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when request_hash=encode(sha256(convert_to(jsonb_build_array(p_project,p_command,p_revision,p_input-'payload')::text,'UTF8')),'hex')
 then response||jsonb_build_object('replayed',true) else jsonb_build_object('result','conflict') end
 from public.natori_case_admin_operations where owner_id=p_owner and id=p_operation
$$;

create function public.natori_case_admin_command_v1(p_owner uuid,p_operation uuid,p_project uuid,p_command text,p_revision text,p_input jsonb,p_operator jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; old public.natori_case_admin_operations%rowtype;
 q public.natori_quotes%rowtype; j public.natori_notification_jobs%rowtype;
 h text; v_project uuid; v_notice uuid; d jsonb; r jsonb;
begin
 if p_owner is null or p_operation is null or p_command is null or p_command not in ('create','details','manual-payment','close','reopen','archive','restore','retry-notice')
  or jsonb_typeof(p_input) is distinct from 'object' or length(p_input::text)>30000
  or coalesce(p_operator->>'kind','') not in ('auth-user','shared-key') then raise exception 'case_admin_invalid';end if;
 -- Every command has one owner/operation lock; a lost response never creates another effect.
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||'/'||p_operation::text,0));
 h:=encode(sha256(convert_to(jsonb_build_array(p_project,p_command,p_revision,p_input-'payload')::text,'UTF8')),'hex');
 select * into old from public.natori_case_admin_operations where owner_id=p_owner and id=p_operation;
 if found then return case when old.request_hash=h then old.response||jsonb_build_object('replayed',true) else jsonb_build_object('result','conflict') end;end if;
 if p_command='create' then
  if p_project is not null then return jsonb_build_object('result','invalid');end if;
  d:=p_input->'project';
  if p_input->>'mode'='external' then
   insert into public.natori_projects(user_id,title,client_name,client_email,type,status,amount,due_date,next_action,note)
   values(p_owner,d->>'title',d->>'client_name',nullif(d->>'client_email',''),'undecided','inquiry',null,null,'相談内容を確認する',nullif(d->>'note','')) returning id into v_project;
  elsif p_input->>'mode'='manual' and d->>'status' in ('inquiry','estimating','quoted','awaiting_payment') then
   v_project:=public.natori_create_project_with_tasks(p_owner,d,p_input->'tasks','[]'::jsonb);
  else return jsonb_build_object('result','invalid');end if;
  insert into public.natori_case_work_records(id,owner_id,project_id,kind,data,request_hash,operator)
   values(gen_random_uuid(),p_owner,v_project,'origin',jsonb_build_object('origin',case when p_input->>'mode'='external' then 'external' else 'manual' end,'note','担当者が新画面から明示登録'),h,p_operator);
  r:=jsonb_build_object('result','applied','projectId',v_project);
 else
  select * into p from public.natori_projects where id=p_project and user_id=p_owner for update;
  if not found then return jsonb_build_object('result','not_found');end if;
  if p_revision is distinct from public.natori_case_work_revision_v1(p.id) then return jsonb_build_object('result','stale');end if;
  v_project:=p.id;
  select * into q from public.natori_quotes where id=p.active_quote_id and project_id=p.id;
  if p_command='restore' then
   if p.deleted_at is null then return jsonb_build_object('result','invalid_state');end if;
   update public.natori_projects set deleted_at=null where id=p.id;
  elsif p.deleted_at is not null then return jsonb_build_object('result','inactive');
  elsif p_command='details' then
   d:=p_input->'patch';
   if p.status='closed' or jsonb_typeof(d) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(d) k where k not in ('title','client_name','amount','delivery_plan','start_date','due_date','note'))
    or length(trim(coalesce(d->>'title','')))=0 or length(d->>'title')>500
    or length(trim(coalesce(d->>'client_name','')))=0 or length(d->>'client_name')>500
    or d->>'delivery_plan' not in ('normal','rush_14_days','rush_7_days')
    or (d->>'amount' is not null and ((d->>'amount')::numeric<0 or (d->>'amount')::numeric<>trunc((d->>'amount')::numeric)))
    or length(coalesce(d->>'note',''))>10000 then return jsonb_build_object('result','invalid');end if;
   if (q.accepted_at is not null or p.quote_accepted_at is not null or p.payment_confirmed_at is not null or p.paid_at is not null or p.paid_amount is not null) and (d->>'amount')::integer is distinct from p.amount then return jsonb_build_object('result','agreement_locked');end if;
   update public.natori_projects set title=d->>'title',client_name=d->>'client_name',amount=(d->>'amount')::integer,
    delivery_plan=d->>'delivery_plan',start_date=(d->>'start_date')::date,due_date=(d->>'due_date')::date,note=d->>'note' where id=p.id;
  elsif p_command='manual-payment' then
   if p.type not in ('icon','sd','standing','illustration') or p.amount is null or p.payment_confirmed_at is not null or p.paid_at is not null or p.paid_amount is not null
    or p.stripe_payment_session_id is not null or (q.accepted_at is not null and q.amount is distinct from p.amount)
    or (p.quote_accepted_at is not null and (p.quote_accepted_amount is null or p.quote_accepted_amount is distinct from p.amount or q.id is null or q.accepted_at is distinct from p.quote_accepted_at or q.amount is distinct from p.quote_accepted_amount))
    or public.natori_case_outbound_blocked_v1(p.id)
    or exists(select 1 from public.natori_payment_link_attempts where project_id=p.id and state<>'inactive')
    or exists(select 1 from public.natori_payment_link_stops where project_id=p.id and status<>'completed')
    or exists(select 1 from public.natori_payment_transactions where project_id=p.id and status<>'manual')
    or exists(select 1 from public.natori_stripe_event_inbox where project_id=p.id and status<>'completed')
    or (p.payment_link_id is not null and coalesce(p.payment_link_status,'') not in ('void','paid'))
    then return jsonb_build_object('result','payment_review');end if;
   if not public.natori_confirm_manual_payment(p_owner,p.id,'ラフ作成') then return jsonb_build_object('result','invalid_state');end if;
  elsif p_command in ('close','archive') then
   if public.natori_case_outbound_blocked_v1(p.id) then return jsonb_build_object('result','review_required');end if;
   r:=public.natori_payment_links_v1(p_owner,p.id,p_command,p_input);
   if r->>'result'<>'completed' then return r;end if;
  elsif p_command='reopen' then
   if p.status<>'closed' then return jsonb_build_object('result','invalid_state');end if;
   update public.natori_projects set status='inquiry',next_action='相談内容を確認する' where id=p.id;
  elsif p_command='retry-notice' then
   select * into j from public.natori_notification_jobs where id=(p_input->>'notificationId')::uuid and project_id=p.id for update;
   if not found or j.status not in ('failed','pending') or j.claim_count>=8 or j.attempt_no>=5
    or coalesce(j.lease_expires_at,'-infinity')>clock_timestamp() or coalesce(j.retry_after,'-infinity')>clock_timestamp()
    or (j.status='pending' and j.send_started_at is not null)
    or exists(select 1 from public.natori_notification_jobs where notification_key=j.notification_key and attempt_no>j.attempt_no)
    or not public.natori_case_admin_notice_target_v1(p,j)
    or (j.purpose in ('quote_issue_client','payment_link_client','delivery_issue_client','consultation_client') and public.natori_case_outbound_blocked_v1(p.id,null,j.id))
    then return jsonb_build_object('result','notice_review');end if;
   if j.payload is null then
    if j.send_started_at is not null or j.purpose in ('quote_issue_client','delivery_issue_client','payment_link_client','consultation_staff','consultation_client')
     or jsonb_typeof(p_input->'payload') is distinct from 'object' then return jsonb_build_object('result','notice_review');end if;
    update public.natori_notification_jobs set payload=p_input->'payload' where id=j.id;
   elsif j.payload is distinct from p_input->'payload' then return jsonb_build_object('result','notice_review');end if;
   v_notice:=public.natori_notification_retry_v1(j.id,p_owner);
   if v_notice is null then return jsonb_build_object('result','notice_review');end if;
  else return jsonb_build_object('result','invalid');end if;
  r:=jsonb_build_object('result',case when v_notice is null then 'applied' else 'queued' end,'projectId',p.id,'notificationId',v_notice,'contextHash',public.natori_case_work_metadata_v1(p.id));
 end if;
 insert into public.natori_case_admin_operations(owner_id,id,project_id,command,request_hash,operator,response)
  values(p_owner,p_operation,v_project,p_command,h,p_operator,r);
 return r||jsonb_build_object('replayed',false);
end $$;

create function public.natori_case_admin_notice_guard_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; context text;
begin
 if new.status='sending' or new.send_started_at is distinct from old.send_started_at then
  select o.response->>'contextHash' into context from public.natori_case_admin_operations o
   where o.project_id=new.project_id and o.command='retry-notice' and o.response->>'notificationId'=new.id::text order by o.created_at desc,o.id desc limit 1;
  if found then
   select * into p from public.natori_projects where id=new.project_id for update;
   if context is distinct from public.natori_case_work_metadata_v1(p.id) or not public.natori_case_admin_notice_target_v1(p,new)
    or (new.purpose in ('quote_issue_client','payment_link_client','delivery_issue_client','consultation_client') and public.natori_case_outbound_blocked_v1(p.id,null,new.id)) then raise exception 'case_admin_notice_stale';end if;
  end if;
  if new.purpose='quote_issue_client' and new.case_work_guard is not null then
   select * into p from public.natori_projects where id=new.project_id for update;
   if not public.natori_case_admin_notice_target_v1(p,new) then raise exception 'case_admin_quote_requires_review';end if;
  end if;
 end if;
 return new;
end $$;
create trigger natori_case_admin_notice_guard before update on public.natori_notification_jobs for each row execute function public.natori_case_admin_notice_guard_v1();

-- Reuse formal quote issue, but reject a workspace confirmation whose case changed.
create function public.natori_case_issue_quote_v1(p_owner_id uuid,p_input jsonb,p_payload jsonb,p_revision text)
returns table(quote_id uuid,version integer,reused boolean,notification_id uuid)
language plpgsql security invoker set search_path='' as $$
declare v_project uuid:=(p_input->>'projectId')::uuid;
begin
 perform 1 from public.natori_projects where id=v_project and user_id=p_owner_id for update;
 if not found then raise exception 'project_not_found';end if;
 -- Existing idempotency identity wins over a later revision for a pure replay.
 if not exists(select 1 from public.natori_quote_issue_operations where project_id=v_project and operation_id=p_input->>'idempotencyKey')
  and exists(select 1 from public.natori_projects where id=v_project and (paid_at is not null or paid_amount is not null)) then raise exception 'project_already_paid';end if;
 if not exists(select 1 from public.natori_quote_issue_operations where project_id=v_project and operation_id=p_input->>'idempotencyKey')
  and (p_revision is distinct from public.natori_case_work_revision_v1(v_project) or public.natori_case_outbound_blocked_v1(v_project))
  then raise exception 'workspace_confirmation_stale';end if;
 if not exists(select 1 from public.natori_quote_issue_operations where project_id=v_project and operation_id=p_input->>'idempotencyKey') and exists(select 1 from public.natori_notification_jobs where project_id=v_project and purpose='quote_issue_client' and status in ('pending','sending','unknown')) then raise exception 'notification_recovery_required';end if;
 return query select * from public.natori_issue_quote_with_notification_v1(p_owner_id,p_input,p_payload||jsonb_build_object('caseWorkGuard',public.natori_case_work_metadata_v1(v_project)));
end $$;
create function public.natori_case_renotify_quote_v1(p_owner_id uuid,p_quote_id uuid,p_operation_id text,p_request jsonb,p_token_hash text,p_expires_at timestamptz,p_payload jsonb,p_revision text)
returns table(notification_id uuid,replayed boolean) language plpgsql security invoker set search_path='' as $$
declare v_project uuid; repeated boolean;
begin
 select q.project_id into v_project from public.natori_quotes q join public.natori_projects p on p.id=q.project_id
  where q.id=p_quote_id and p.user_id=p_owner_id;
 if not found then raise exception 'project_not_found';end if;
 perform 1 from public.natori_projects where id=v_project for update;
 repeated:=exists(select 1 from public.natori_quote_issue_operations where project_id=v_project and operation_id=p_operation_id);
 if not repeated then
  if p_revision is distinct from public.natori_case_work_revision_v1(v_project) or public.natori_case_outbound_blocked_v1(v_project) then raise exception 'workspace_confirmation_stale';end if;
  if exists(select 1 from public.natori_notification_jobs where quote_id=p_quote_id and purpose='quote_issue_client' and status in ('pending','sending','unknown')) then raise exception 'notification_recovery_required';end if;
 end if;
 return query select n.notification_id,repeated from public.natori_renotify_quote_v1(p_owner_id,p_quote_id,p_operation_id,p_request,p_token_hash,p_expires_at,p_payload||jsonb_build_object('caseWorkGuard',public.natori_case_work_metadata_v1(v_project),'caseQuoteAccessHash',p_token_hash)) n;
end $$;
revoke all on function public.natori_case_admin_replay_v1(uuid,uuid,uuid,text,text,jsonb),public.natori_case_admin_lookup_v1(uuid,uuid),public.natori_case_admin_read_v1(uuid,uuid),
 public.natori_case_admin_command_v1(uuid,uuid,uuid,text,text,jsonb,jsonb),public.natori_case_issue_quote_v1(uuid,jsonb,jsonb,text),public.natori_case_renotify_quote_v1(uuid,uuid,text,jsonb,text,timestamptz,jsonb,text),public.natori_case_admin_notice_target_v1(public.natori_projects,public.natori_notification_jobs),public.natori_case_admin_notice_guard_v1()
 from public,anon,authenticated,service_role;
grant execute on function public.natori_case_admin_replay_v1(uuid,uuid,uuid,text,text,jsonb),public.natori_case_admin_lookup_v1(uuid,uuid),public.natori_case_admin_read_v1(uuid,uuid),
 public.natori_case_admin_command_v1(uuid,uuid,uuid,text,text,jsonb,jsonb),public.natori_case_issue_quote_v1(uuid,jsonb,jsonb,text),public.natori_case_renotify_quote_v1(uuid,uuid,text,jsonb,text,timestamptz,jsonb,text),public.natori_case_admin_notice_target_v1(public.natori_projects,public.natori_notification_jobs) to service_role;
commit;
