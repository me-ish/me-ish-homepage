-- Expand only. Existing links, accepted quotes, payment and delivery facts are untouched.
begin;
create table public.natori_payment_link_attempts (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.natori_projects(id),
 owner_id uuid not null references auth.users(id), quote_id uuid not null references public.natori_quotes(id),
 generation integer not null check(generation>0), amount integer not null check(amount>=50), livemode boolean not null,
 state text not null check(state in ('creating','active','stop_required','deactivating','inactive','needs_review')),
 price_id text, link_id text, link_url text, deadline timestamptz not null, deadline_revision integer not null default 1,
 price_started_at timestamptz, link_started_at timestamptz,
 claim_token uuid, claim_generation integer not null default 0, lease_until timestamptz,
 mail_token uuid, mail_until timestamptz, review_reason text,
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 unique(project_id,generation), unique(link_id)
);
create table public.natori_payment_link_operations (
 project_id uuid not null references public.natori_projects(id), operation_id uuid not null,
 request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'),
 action text not null check(action in ('issue','renotify','extend','reissue','adopt')),
 attempt_id uuid not null references public.natori_payment_link_attempts(id),
 status text not null default 'pending' check(status in ('pending','completed')),
 proposed_deadline timestamptz, expected_revision integer, notification_id uuid references public.natori_notification_jobs(id),
 created_at timestamptz not null default clock_timestamp(), primary key(project_id,operation_id)
);
create table public.natori_payment_link_stops (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.natori_projects(id),
 owner_id uuid not null references auth.users(id), attempt_id uuid references public.natori_payment_link_attempts(id),
 link_id text not null, livemode boolean, reason text not null, deadline_revision integer,
 status text not null default 'pending' check(status in ('pending','processing','completed','needs_review')),
 claim_token uuid, claim_generation integer not null default 0, lease_until timestamptz,
 created_at timestamptz not null default clock_timestamp(), unique(project_id,link_id)
);
create index natori_payment_link_attempt_project on public.natori_payment_link_attempts(project_id,generation desc);
create index natori_payment_link_stop_pending on public.natori_payment_link_stops(owner_id,status,lease_until);
alter table public.natori_payment_link_attempts enable row level security;
alter table public.natori_payment_link_operations enable row level security;
alter table public.natori_payment_link_stops enable row level security;
revoke all on public.natori_payment_link_attempts,public.natori_payment_link_operations,public.natori_payment_link_stops from public,anon,authenticated,service_role;
grant select,insert,update on public.natori_payment_link_attempts,public.natori_payment_link_operations,public.natori_payment_link_stops to service_role;

alter table public.natori_notification_jobs drop constraint natori_notification_jobs_purpose_check;
alter table public.natori_notification_jobs add constraint natori_notification_jobs_purpose_check check
 (purpose in ('quote_accept_artist','delivery_accept_artist','delivery_accept_client','delivery_issue_client','quote_issue_client',
 'payment_received_artist','payment_received_client','payment_review_artist','payment_link_client'));

-- Invoked inside the project update transaction, including compatibility writers.
create function public.natori_payment_link_terminal_guard_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.deleted_at is not null and old.deleted_at is null then
  if old.status not in ('closed','completed') or exists(select 1 from public.natori_payment_link_attempts a
   where a.project_id=old.id and a.state<>'inactive') or exists(select 1 from public.natori_payment_link_stops s
   where s.project_id=old.id and s.status<>'completed')
   or (old.payment_link_id is not null and coalesce(old.payment_link_status,'') not in ('void','paid')) then
    raise exception 'unresolved_payment_link_archive'; end if;
 end if;
 if new.status='closed' and old.status is distinct from 'closed' then
  if old.status not in ('inquiry','consulting','estimating','quoted','awaiting_payment') then raise exception 'invalid_close_state'; end if;
  insert into public.natori_payment_link_stops(project_id,owner_id,attempt_id,link_id,livemode,reason,deadline_revision)
   select a.project_id,a.owner_id,a.id,a.link_id,a.livemode,'closed',a.deadline_revision
   from public.natori_payment_link_attempts a where a.project_id=old.id and a.state<>'inactive' and a.link_id is not null
   on conflict(project_id,link_id) do nothing;
  if old.payment_link_id is not null and not exists(select 1 from public.natori_payment_link_attempts where project_id=old.id and link_id=old.payment_link_id)
   and coalesce(old.payment_link_status,'') not in ('void','paid') then
   insert into public.natori_payment_link_stops(project_id,owner_id,link_id,reason)
    values(old.id,old.user_id,old.payment_link_id,'legacy_closed') on conflict(project_id,link_id) do nothing;
  end if;
  update public.natori_payment_link_attempts set state=case when link_id is null then 'needs_review' else 'stop_required' end,
   review_reason=case when link_id is null then 'closed_during_creation' else null end,updated_at=clock_timestamp()
   where project_id=old.id and state<>'inactive';
 end if;
 -- Old mail/Cron writers cannot overwrite a generation projection. A recorded payment
 -- may still stamp its immutable money facts and paid status through the existing RPC.
 if exists(select 1 from public.natori_payment_link_attempts where project_id=old.id)
  and current_setting('natori.payment_link_writer',true) is distinct from 'v1'
  and (new.payment_link_id is distinct from old.payment_link_id or new.payment_link_url is distinct from old.payment_link_url
    or (new.payment_link_status is distinct from old.payment_link_status and not(new.payment_confirmed_at is not null and new.payment_link_status='paid')))
  then raise exception 'generation_projection_writer_required'; end if;
 return new;
end; $$;
create trigger natori_payment_link_terminal_guard before update on public.natori_projects
for each row execute function public.natori_payment_link_terminal_guard_v1();
revoke all on function public.natori_payment_link_terminal_guard_v1() from public,anon,authenticated;

-- One owner-scoped internal RPC. Every mutation orders project -> attempt -> operation/job.
-- Commands and their result JSON are parsed by a server-only adapter; no public execute.
create function public.natori_payment_links_v1(p_owner_id uuid,p_project_id uuid,p_command text,p_input jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; q public.natori_quotes%rowtype;
 a public.natori_payment_link_attempts%rowtype; o public.natori_payment_link_operations%rowtype;
 s public.natori_payment_link_stops%rowtype; j public.natori_notification_jobs%rowtype;
 t timestamptz:=clock_timestamp(); op uuid; tok uuid; act text; v_deadline timestamptz; n uuid; v_stage text;
 v_live boolean; v_hash text; v_value jsonb; last_mail timestamptz;
begin
 if p_owner_id is null then return jsonb_build_object('result','not_found'); end if;
 if p_command='scan' then return jsonb_build_object('result','ok','projects',coalesce((select jsonb_agg(z.id) from
  (select distinct x.id from public.natori_projects x where x.user_id=p_owner_id and
   (exists(select 1 from public.natori_payment_link_stops st where st.project_id=x.id and st.status in ('pending','processing'))
   or exists(select 1 from public.natori_payment_link_attempts at where at.project_id=x.id and at.state in ('active','stop_required','deactivating')
    and (at.deadline<=t or x.status='closed' or x.deleted_at is not null or x.payment_confirmed_at is not null))) limit 100) z),'[]'::jsonb)); end if;
 select * into p from public.natori_projects where id=p_project_id and user_id=p_owner_id for update;
 if not found then return jsonb_build_object('result','not_found'); end if;
 select * into a from public.natori_payment_link_attempts where project_id=p.id order by generation desc limit 1 for update;
 if p_command='context' then return jsonb_build_object('result','ok','attempt',case when a.id is null then null else to_jsonb(a) end,
  'legacyLinkId',p.payment_link_id,'legacyUrl',p.payment_link_url,'quoteId',p.active_quote_id); end if;
 if p_command='operation' then
  select * into o from public.natori_payment_link_operations where project_id=p.id and operation_id=(p_input->>'operationId')::uuid;
  if o.operation_id is null then return jsonb_build_object('result','absent'); end if;
  if o.request_hash is distinct from p_input->>'hash' then return jsonb_build_object('result','conflict'); end if;
  return jsonb_build_object('result',o.status,'notificationId',o.notification_id);
 end if;
 if p_command='read' then
  select * into q from public.natori_quotes where id=p.active_quote_id and project_id=p.id;
  return jsonb_build_object('result','ok','state',coalesce(a.state,case when p.payment_link_id is null then 'absent' else 'legacy_review' end),
   'attemptId',a.id,'generation',a.generation,'revision',a.deadline_revision,'deadline',a.deadline,'url',a.link_url,
   'confirmedAt',p.payment_confirmed_at,'terminal',p.status='closed' or p.deleted_at is not null,
   'canIssue',q.accepted_at is not null and q.superseded_at is null and p.status in ('quoted','awaiting_payment') and p.payment_confirmed_at is null,
   'amount',q.amount,'notificationStatus',(select status from public.natori_notification_jobs where id in
     (select notification_id from public.natori_payment_link_operations where project_id=p.id and attempt_id=a.id) order by created_at desc limit 1));
 end if;
 if p_command='close' then
  if p.status<>'closed' and p.status not in ('inquiry','consulting','estimating','quoted','awaiting_payment') then return jsonb_build_object('result','invalid_state'); end if;
  update public.natori_projects set status='closed',next_action='',note=case when coalesce(p_input->>'reason','')='' then note
   else coalesce(note||E'\n\n','')||'[closed '||t::date||'] '||left(p_input->>'reason',2000) end where id=p.id;
  return jsonb_build_object('result','completed');
 end if;
 if p_command='archive' then
  if p.status not in ('closed','completed') or exists(select 1 from public.natori_payment_link_attempts where project_id=p.id and state<>'inactive')
   or exists(select 1 from public.natori_payment_link_stops where project_id=p.id and status<>'completed')
   or(p.payment_link_id is not null and coalesce(p.payment_link_status,'') not in ('void','paid')) then return jsonb_build_object('result','unresolved'); end if;
  update public.natori_projects set deleted_at=coalesce(deleted_at,t) where id=p.id; return jsonb_build_object('result','completed');
 end if;
 if p_command='queue_stop' then
  if a.id is null then return jsonb_build_object('result','absent'); end if;
  if a.state='inactive' then return jsonb_build_object('result','completed'); end if;
  if a.state='active' and a.deadline>t and p.status<>'closed' and p.deleted_at is null and p.payment_confirmed_at is null then return jsonb_build_object('result','not_due'); end if;
  if (a.lease_until>t or a.mail_until>t) and p.status<>'closed' and p.deleted_at is null then return jsonb_build_object('result','busy'); end if;
  if a.link_id is null then return jsonb_build_object('result','needs_review'); end if;
  update public.natori_payment_link_attempts set state='stop_required',updated_at=t where id=a.id and state not in ('deactivating','inactive');
  insert into public.natori_payment_link_stops(project_id,owner_id,attempt_id,link_id,livemode,reason,deadline_revision)
   values(p.id,p.user_id,a.id,a.link_id,a.livemode,case when p.payment_confirmed_at is not null then 'paid' when p.status='closed' or p.deleted_at is not null then 'terminal' else 'deadline' end,a.deadline_revision)
   on conflict(project_id,link_id) do nothing; return jsonb_build_object('result','queued');
 end if;
 if p_command in ('claim_stop','finish_stop') then
  tok=(p_input->>'token')::uuid;
  if p_command='claim_stop' then
   select * into s from public.natori_payment_link_stops where project_id=p.id and status in ('pending','processing') order by created_at,id limit 1 for update;
   if s.id is null then return jsonb_build_object('result','absent'); end if;
   if s.status='processing' and s.lease_until>t or a.mail_until>t or a.lease_until>t then return jsonb_build_object('result','busy'); end if;
   if s.attempt_id is not null then
    select * into a from public.natori_payment_link_attempts where id=s.attempt_id for update;
    if a.state='inactive' then update public.natori_payment_link_stops set status='completed' where id=s.id; return jsonb_build_object('result','completed'); end if;
    if s.reason='deadline' and a.deadline_revision is distinct from s.deadline_revision then return jsonb_build_object('result','needs_review'); end if;
    update public.natori_payment_link_attempts set state='deactivating' where id=a.id;
   end if;
   update public.natori_payment_link_stops set status='processing',claim_token=tok,claim_generation=claim_generation+1,lease_until=t+interval '60 seconds'
    where id=s.id returning * into s;
   return jsonb_build_object('result','claimed','job',to_jsonb(s));
  end if;
  select * into s from public.natori_payment_link_stops where id=(p_input->>'jobId')::uuid and project_id=p.id for update;
  if s.id is null or s.claim_token is distinct from tok or s.claim_generation<>(p_input->>'generation')::integer or s.lease_until<=t then return jsonb_build_object('result','stale'); end if;
  if p_input->>'outcome'<>'inactive' then
   update public.natori_payment_link_stops set status=case when p_input->>'outcome'='review' then 'needs_review' else 'pending' end,lease_until=null where id=s.id;
   if s.attempt_id is not null then update public.natori_payment_link_attempts set state=case when p_input->>'outcome'='review' then 'needs_review' else 'stop_required' end,review_reason='provider_stop_unconfirmed' where id=s.attempt_id; end if;
   return jsonb_build_object('result','needs_review');
  end if;
  update public.natori_payment_link_stops set status='completed',lease_until=null where id=s.id;
  update public.natori_payment_link_attempts set state='inactive',lease_until=null,updated_at=t where id=s.attempt_id;
  perform set_config('natori.payment_link_writer','v1',true);
  update public.natori_projects set payment_link_status='void' where id=p.id and payment_link_id=s.link_id and payment_confirmed_at is null;
  return jsonb_build_object('result','completed');
 end if;
 if p_command='mail_gate' then
  select * into j from public.natori_notification_jobs where id=(p_input->>'jobId')::uuid and project_id=p.id;
  select * into a from public.natori_payment_link_attempts where id=(j.snapshot->>'attemptId')::uuid and project_id=p.id for update;
  tok=(p_input->>'token')::uuid;
  if p_input->>'action'='release' then update public.natori_payment_link_attempts set mail_token=null,mail_until=null where id=a.id and mail_token=tok; return jsonb_build_object('result','released'); end if;
  if p_input->>'action'='review' then update public.natori_payment_link_attempts set state='needs_review',review_reason='provider_mail_link_unverified',mail_token=null,mail_until=null where id=a.id and mail_token=tok; return jsonb_build_object('result','blocked'); end if;
  if a.id is null or a.state<>'active' or a.deadline is distinct from (j.snapshot->>'deadline')::timestamptz or a.deadline<=t+interval '45 seconds' or p.status='closed' or p.deleted_at is not null or p.payment_confirmed_at is not null then return jsonb_build_object('result','blocked'); end if;
  if a.lease_until>t or(a.mail_until>t and a.mail_token is distinct from tok) then return jsonb_build_object('result','busy'); end if;
  update public.natori_payment_link_attempts set mail_token=tok,mail_until=t+interval '30 seconds' where id=a.id;
  return jsonb_build_object('result','allowed');
 end if;
 op=(p_input->>'operationId')::uuid; tok=(p_input->>'token')::uuid;
 select * into o from public.natori_payment_link_operations where project_id=p.id and operation_id=op for update;
 if p_command='begin' then
  v_hash=p_input->>'hash'; act=p_input->>'action'; v_live=(p_input->>'livemode')::boolean;
  if v_hash is null or v_hash!~'^[0-9a-f]{64}$' or act not in ('issue','renotify','extend','reissue','adopt') then return jsonb_build_object('result','invalid_request'); end if;
  if o.operation_id is not null then
   if o.request_hash<>v_hash or o.action<>act then return jsonb_build_object('result','conflict'); end if;
   select * into a from public.natori_payment_link_attempts where id=o.attempt_id for update;
   if o.status='completed' then return jsonb_build_object('result','completed','attempt',to_jsonb(a),'notificationId',o.notification_id); end if;
  else
   if p.payment_confirmed_at is not null or p.deleted_at is not null or p.status not in ('quoted','awaiting_payment') then return jsonb_build_object('result','invalid_state'); end if;
   select * into q from public.natori_quotes where id=p.active_quote_id and project_id=p.id and user_id=p.user_id for update;
   if q.accepted_at is null or q.superseded_at is not null or q.amount<50 or p.quote_accepted_amount is distinct from q.amount then return jsonb_build_object('result','quote_not_accepted'); end if;
   if exists(select 1 from public.natori_stripe_event_inbox where project_id=p.id and status<>'completed') then return jsonb_build_object('result','payment_review'); end if;
   v_deadline=(p_input->>'deadline')::timestamptz;
   if act in ('issue','reissue','extend') and (v_deadline is null or v_deadline<=t or v_deadline>t+interval '366 days') then return jsonb_build_object('result','invalid_deadline'); end if;
   if act='adopt' then
    if a.id is not null or p.payment_link_id is null or p.payment_link_url is null or p.payment_link_status not in ('sent','ready','send_failed','void')
     or p.payment_quote_id is distinct from q.id or p.quoted_amount is distinct from q.amount
     or (p.payment_link_status='void' and p_input->>'active'='true') or p_input->>'linkId' is distinct from p.payment_link_id or p_input->>'url' is distinct from p.payment_link_url or p_input->>'reconciled' is distinct from 'true' then return jsonb_build_object('result','legacy_review'); end if;
    select max(sent_at) into last_mail from public.natori_order_mail_logs where project_id=p.id and kind='payment' and status='sent' and link_url=p.payment_link_url;
    if last_mail is null then return jsonb_build_object('result','legacy_review'); end if;
    v_deadline=last_mail+interval '7 days';
    insert into public.natori_payment_link_attempts(project_id,owner_id,quote_id,generation,amount,livemode,state,link_id,link_url,deadline)
     values(p.id,p.user_id,q.id,1,q.amount,v_live,case when (p_input->>'active')::boolean then 'active' else 'inactive' end,p.payment_link_id,p.payment_link_url,v_deadline) returning * into a;
   elsif act in ('issue','reissue') then
    if act='issue' and(a.id is not null or p.payment_link_id is not null) then return jsonb_build_object('result','legacy_review'); end if;
    if act='reissue' and (a.id is null or a.state<>'inactive' or p_input->>'confirmed' is distinct from 'true') then return jsonb_build_object('result','stop_required'); end if;
    insert into public.natori_payment_link_attempts(project_id,owner_id,quote_id,generation,amount,livemode,state,deadline)
     values(p.id,p.user_id,q.id,coalesce(a.generation,0)+1,q.amount,v_live,'creating',v_deadline) returning * into a;
   else
    if a.id is null or a.state<>'active' or a.livemode is distinct from v_live or a.quote_id is distinct from q.id or a.deadline<=t
     or a.deadline_revision is distinct from (p_input->>'revision')::integer then return jsonb_build_object('result','conflict'); end if;
    if a.lease_until>t or a.mail_until>t then return jsonb_build_object('result','busy'); end if;
    if act='extend' and (v_deadline<=a.deadline or p_input->>'confirmed' is distinct from 'true') then return jsonb_build_object('result','invalid_deadline'); end if;
   end if;
   insert into public.natori_payment_link_operations(project_id,operation_id,request_hash,action,attempt_id,proposed_deadline,expected_revision,status)
    values(p.id,op,v_hash,act,a.id,v_deadline,a.deadline_revision,case when act='adopt' then 'completed' else 'pending' end) returning * into o;
   if act='adopt' then return jsonb_build_object('result','completed','attempt',to_jsonb(a)); end if;
  end if;
  if p.payment_confirmed_at is not null or p.deleted_at is not null or p.status='closed' then return jsonb_build_object('result','invalid_state'); end if;
  if a.state not in ('creating','active') or a.deadline<=t or a.livemode is distinct from v_live then return jsonb_build_object('result','needs_review'); end if;
  if a.lease_until>t then return jsonb_build_object('result','busy'); end if;
  if(a.price_id is null and a.price_started_at<t-interval '23 hours') or(a.link_id is null and a.link_started_at<t-interval '23 hours') then
   update public.natori_payment_link_attempts set state='needs_review',review_reason='idempotency_retention_elapsed' where id=a.id; return jsonb_build_object('result','needs_review'); end if;
  update public.natori_payment_link_attempts set claim_token=tok,claim_generation=claim_generation+1,lease_until=t+interval '60 seconds',updated_at=t where id=a.id returning * into a;
  return jsonb_build_object('result','claimed','attempt',to_jsonb(a),'action',o.action,'proposedDeadline',o.proposed_deadline);
 end if;
 if o.operation_id is null then return jsonb_build_object('result','not_found'); end if;
 select * into a from public.natori_payment_link_attempts where id=o.attempt_id for update;
 if a.claim_token is distinct from tok or a.claim_generation is distinct from (p_input->>'generation')::integer or a.lease_until<=t then return jsonb_build_object('result','stale'); end if;
 if p_command='stage' then
  v_stage=p_input->>'stage'; v_value=p_input->'value';
  if v_stage='price_start' then update public.natori_payment_link_attempts set price_started_at=coalesce(price_started_at,t) where id=a.id;
  elsif v_stage='link_start' then update public.natori_payment_link_attempts set link_started_at=coalesce(link_started_at,t) where id=a.id;
  elsif v_stage='price' then
   if coalesce(v_value->>'id','')!~'^price_[A-Za-z0-9]+$' or(a.price_id is not null and a.price_id<>v_value->>'id') then return jsonb_build_object('result','conflict'); end if;
   update public.natori_payment_link_attempts set price_id=v_value->>'id' where id=a.id;
  elsif v_stage='link' then
   if coalesce(v_value->>'id','')!~'^plink_[A-Za-z0-9]+$' or coalesce(v_value->>'url','')!~'^https://buy[.]stripe[.]com/'
    or(a.link_id is not null and(a.link_id<>v_value->>'id' or a.link_url<>v_value->>'url')) then return jsonb_build_object('result','conflict'); end if;
   update public.natori_payment_link_attempts set link_id=v_value->>'id',link_url=v_value->>'url' where id=a.id;
   if p.status='closed' or p.deleted_at is not null or p.payment_confirmed_at is not null then
    update public.natori_payment_link_attempts set state='stop_required' where id=a.id;
    insert into public.natori_payment_link_stops(project_id,owner_id,attempt_id,link_id,livemode,reason,deadline_revision)
     values(p.id,p.user_id,a.id,v_value->>'id',a.livemode,'terminal_during_creation',a.deadline_revision) on conflict(project_id,link_id) do nothing;
   end if;
  elsif v_stage='review' then update public.natori_payment_link_attempts set state='needs_review',review_reason=left(p_input->>'reason',100),lease_until=null where id=a.id;
  else return jsonb_build_object('result','invalid_request'); end if;
  update public.natori_payment_link_attempts set lease_until=case when state='needs_review' then null else t+interval '60 seconds' end,updated_at=t where id=a.id returning * into a;
  return jsonb_build_object('result','saved','attempt',to_jsonb(a));
 end if;
 if p_command='finish' then
  if o.status='completed' then return jsonb_build_object('result','completed','attempt',to_jsonb(a),'notificationId',o.notification_id); end if;
  if p.status='closed' or p.deleted_at is not null or p.payment_confirmed_at is not null or a.state not in ('creating','active') or a.deadline<=t
   or a.link_id is null or a.link_url is null or p_input->>'verified' is distinct from 'true' then return jsonb_build_object('result','invalid_state'); end if;
  if o.action='extend' then
   if a.deadline_revision is distinct from o.expected_revision then return jsonb_build_object('result','conflict'); end if;
   update public.natori_payment_link_attempts set deadline=o.proposed_deadline,deadline_revision=deadline_revision+1 where id=a.id;
  else
   if jsonb_typeof(p_input->'payload') is distinct from 'object' or p_input->'payload'->>'format' is distinct from 'natori-delivery-aes256gcm-v1' then return jsonb_build_object('result','invalid_payload'); end if;
   insert into public.natori_notification_jobs(notification_key,project_id,quote_id,purpose,snapshot,payload)
    values('payment-link/'||a.id||'/'||op,p.id,a.quote_id,'payment_link_client',jsonb_build_object('attemptId',a.id,'generation',a.generation,'deadline',a.deadline),p_input->'payload') returning id into n;
  end if;
  update public.natori_payment_link_attempts set state='active',lease_until=null,updated_at=t where id=a.id returning * into a;
  update public.natori_payment_link_operations set status='completed',notification_id=n where project_id=p.id and operation_id=op;
  perform set_config('natori.payment_link_writer','v1',true);
  update public.natori_projects set payment_link_id=a.link_id,payment_link_url=a.link_url,payment_link_status='ready',payment_quote_id=a.quote_id,
   quoted_amount=a.amount,status='awaiting_payment',next_action='支払いの確認待ち' where id=p.id;
  return jsonb_build_object('result','completed','attempt',to_jsonb(a),'notificationId',n);
 end if;
 return jsonb_build_object('result','invalid_command');
end; $$;
revoke all on function public.natori_payment_links_v1(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.natori_payment_links_v1(uuid,uuid,text,jsonb) to service_role;
commit;
