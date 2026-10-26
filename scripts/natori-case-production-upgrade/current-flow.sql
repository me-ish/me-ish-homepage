-- Forward candidate after the workspace/L7 dependencies, without migration 54.
-- No historical migration is edited. Apply only after separate target approval.
begin;
select pg_catalog.pg_advisory_xact_lock(7261549321761::bigint);
do $$ begin perform natori_case_guard.check_contract('natori_notification_finish_v1'); end $$;

create table public.natori_case_current_operations (
 owner_id uuid not null references auth.users(id), project_id uuid not null references public.natori_projects(id),
 id text not null check(length(id) between 8 and 200), kind text not null check(kind in ('payment','quote_issue','quote_renotify','expiry')),
 request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'), revision text not null,
 expected jsonb not null, status text not null default 'running' check(status in ('running','completed','unknown')),
 effects jsonb not null default '{}', evidence jsonb not null default '{}', response jsonb, quote_id uuid, log_id uuid not null default gen_random_uuid(),
 provider_id text, sent_at timestamptz, created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(), primary key(owner_id,id), unique(log_id)
);
create unique index natori_case_current_one_unresolved on public.natori_case_current_operations(project_id)
 where status in ('running','unknown');
alter table public.natori_case_current_operations enable row level security;
revoke all on public.natori_case_current_operations from public,anon,authenticated,service_role;
grant select on public.natori_case_current_operations to service_role;
create trigger natori_000_system_lock before insert or update or delete or truncate on public.natori_case_current_operations
 for each statement execute function natori_case_guard.statement_guard();
create trigger zzzz_natori_system_row before insert or update or delete on public.natori_case_current_operations
 for each row execute function natori_case_guard.row_guard();

create function natori_case_guard.current_identity(p public.natori_projects) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('title',p.title,'clientName',p.client_name,'email',p.client_email,'dueDate',p.due_date,'type',p.type)
$$;
create function public.natori_case_current_read_v1(p_owner uuid,p_project uuid,p_id text default null,p_kind text default null) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',o.id,'kind',o.kind,'status',o.status,'response',o.response,'quote_id',recovered_quote.id,
  'sent_at',o.sent_at,'created_at',o.created_at,'version',recovered_quote.version)
 from public.natori_case_current_operations o join public.natori_projects p on p.id=o.project_id and p.user_id=o.owner_id
 left join public.natori_quotes recovered_quote on recovered_quote.project_id=p_project and recovered_quote.user_id=p_owner and (recovered_quote.id=o.quote_id or (o.kind='quote_issue' and o.quote_id is null and recovered_quote.idempotency_key=o.id))
 where o.owner_id=p_owner and o.project_id=p_project and (p_id is null or o.id=p_id) and (p_kind is null or o.kind=p_kind)
 order by o.created_at desc,o.id limit 1
$$;
create function public.natori_case_current_claim_v1(p_owner uuid,p_project uuid,p_id text,p_kind text,p_revision text,p_hash text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare p public.natori_projects%rowtype;o public.natori_case_current_operations%rowtype;
begin
 perform natori_case_guard.shared_lock();perform natori_case_guard.check_contract('current_flow');
 select * into p from public.natori_projects where id=p_project and user_id=p_owner for update;
 if not found then return jsonb_build_object('result','not_found');end if;
 select * into o from public.natori_case_current_operations where owner_id=p_owner and id=p_id;
 if found then
  if o.project_id<>p_project or o.kind<>p_kind or o.request_hash<>p_hash then return jsonb_build_object('result','conflict');end if;
  return jsonb_build_object('result','existing','operation',public.natori_case_current_read_v1(p_owner,p_project,p_id,null));
 end if;
 if p_kind not in ('payment','quote_issue','quote_renotify') or p_hash !~ '^[a-f0-9]{64}$' or length(p_id) not between 8 and 200 then return jsonb_build_object('result','invalid_request');end if;
 if public.natori_case_system_admit_v1(p_owner,'command') is distinct from true then raise exception 'natori_system_held';end if;
 if p_revision is distinct from public.natori_case_work_revision_v1(p.id) then return jsonb_build_object('result','workspace_confirmation_stale');end if;
 if p.deleted_at is not null or p.status='closed' or (p.payment_confirmed_at is not null and p_kind<>'quote_renotify') or (p_kind='quote_issue' and p.quote_accepted_at is not null) or p.type='undecided' then return jsonb_build_object('result','invalid_state');end if;
 if exists(select 1 from public.natori_case_current_operations where project_id=p.id and status in ('running','unknown')) then return jsonb_build_object('result','busy');end if;
 -- Never route an adopted/generation project or unrelated unknown send back to this transport.
 if public.natori_case_outbound_blocked_v1(p.id,null,null)
  or exists(select 1 from public.natori_payment_link_attempts where project_id=p.id)
  or exists(select 1 from public.natori_order_mail_logs l where l.project_id=p.id and l.status<>'sent')
  or exists(select 1 from public.natori_notification_jobs j where j.project_id=p.id and j.status<>'sent')
  or exists(select 1 from public.natori_payment_transactions t where t.project_id=p.id and t.status not in ('received','manual'))
 then return jsonb_build_object('result','notification_recovery_required');end if;
 insert into public.natori_case_current_operations(owner_id,project_id,id,kind,request_hash,revision,expected,quote_id)
 values(p_owner,p_project,p_id,p_kind,p_hash,p_revision,natori_case_guard.current_identity(p),case when p_kind='quote_issue' then null else p.active_quote_id end);
 return jsonb_build_object('result','claimed');
end $$;

-- Results can be recorded while held, only for the exact claimed operation.
-- No retry/lease-expiry branch exists: uncertain effects remain unknown.
create function public.natori_case_current_step_v1(p_owner uuid,p_project uuid,p_id text,p_action text,p_input jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare p public.natori_projects%rowtype;o public.natori_case_current_operations%rowtype;q public.natori_quotes%rowtype;
 frame bigint;effect text;stamp timestamptz:=clock_timestamp();settled boolean;target_status text;issue_result jsonb;
begin
 perform natori_case_guard.shared_lock();perform natori_case_guard.check_contract('current_flow');
 select * into p from public.natori_projects where id=p_project and user_id=p_owner for update;
 if not found then raise exception 'current_scope_missing';end if;
 select * into o from public.natori_case_current_operations where owner_id=p_owner and project_id=p_project and id=p_id for update;
 if not found or o.status<>'running' then raise exception 'current_operation_not_running';end if;
 insert into natori_case_guard.frames(pid,tx,root,owner_id,project_id,fact)
 values(pg_backend_pid(),txid_current(),'current_flow',p_owner,p_project,p_action in ('record','mail_accepted','finish','unknown')) returning depth into frame;
 if p_action in ('start','mail_start','quote_access','issue_quote') then
  if public.natori_case_system_admit_v1(p_owner,'command') is distinct from true or public.natori_case_system_admit_v1(p_owner,'sender') is distinct from true then raise exception 'natori_system_held';end if;
  if exists(select 1 from public.natori_payment_link_attempts where project_id=p.id) then raise exception 'generation_payment_writer_required';end if;
  if p.deleted_at is not null or p.status='closed' or (p.payment_confirmed_at is not null and o.kind<>'quote_renotify') or natori_case_guard.current_identity(p) is distinct from o.expected then raise exception 'workspace_confirmation_stale';end if;
 end if;
 if p_action='issue_quote' then
  if o.kind<>'quote_issue' or o.effects->>'quote' is distinct from 'started' or p.quote_accepted_at is not null or p_input->>'p_idempotency_key' is distinct from p_id
   or (p_input->>'p_user_id')::uuid is distinct from p_owner or (p_input->>'p_project_id')::uuid is distinct from p_project then raise exception 'current_quote_identity_mismatch';end if;
  -- Reuse the existing issuance contract while holding the project lock. A
  -- concurrent acceptance cannot be reset between the fresh check and issuance.
  select jsonb_agg(to_jsonb(issued)) into issue_result from public.natori_issue_quote_from_draft_v1(
   p_owner,p_project,p_input->>'p_title',p_input->>'p_client_name',p_input->>'p_to_email',(p_input->>'p_amount')::integer,
   p_input->>'p_subject',p_input->>'p_body_snapshot',p_input->>'p_token_hash',(p_input->>'p_expires_at')::timestamptz,
   nullif(p_input->'p_request_snapshot','null'::jsonb),p_input->'p_pricing_snapshot',p_id,(p_input->>'p_expected_revision')::integer) issued;
  delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;
  return issue_result;
 elsif p_action='start' then
  effect:=p_input->>'effect';
  if not ((o.kind='payment' and effect in ('price','link','deactivate')) or (o.kind='quote_issue' and effect='quote')) or o.effects ? effect then raise exception 'current_effect_already_started';end if;
  if o.kind='payment' and (p.active_quote_id is distinct from o.quote_id or not exists(select 1 from public.natori_quotes where id=o.quote_id and project_id=p.id and user_id=p_owner and accepted_at is not null and superseded_at is null)) then raise exception 'workspace_confirmation_stale';end if;
  update public.natori_case_current_operations set effects=effects||jsonb_build_object(effect,'started'),updated_at=stamp where owner_id=p_owner and id=p_id;
 elsif p_action='record' then
  effect:=p_input->>'effect';if o.effects->>effect is distinct from 'started' then raise exception 'current_effect_not_started';end if;
  if effect='price' and nullif(p_input->'result'->>'id','') is null then raise exception 'current_price_result_required';end if;
  if effect='link' then
   if nullif(p_input->'result'->>'id','') is null or nullif(p_input->'result'->>'url','') is null
    or (p_input->'result'->>'quoteId')::uuid is distinct from o.quote_id then raise exception 'current_link_result_required';end if;
   -- Preserve evidence even if a concurrent payment/edit prevents projection.
   if p.active_quote_id=o.quote_id and p.payment_confirmed_at is null and p.deleted_at is null and p.payment_link_status='issuing'
    and exists(select 1 from public.natori_quotes link_quote where link_quote.id=o.quote_id and link_quote.amount=(p_input->'result'->>'amount')::integer and link_quote.accepted_at is not null and link_quote.superseded_at is null) then
    update public.natori_projects set payment_link_id=p_input->'result'->>'id',payment_link_url=p_input->'result'->>'url',payment_link_status='ready',payment_quote_id=o.quote_id,quoted_amount=(p_input->'result'->>'amount')::integer where id=p.id;
   end if;
  end if;
  if effect='quote' and p_input->'result'->>'outcome' is distinct from 'rejected' then
   select * into q from public.natori_quotes where id=p.active_quote_id and project_id=p.id and user_id=p_owner and idempotency_key=p_id and superseded_at is null;
   if not found or (natori_case_guard.current_identity(p)-'email'-'dueDate') is distinct from (o.expected-'email'-'dueDate') or p.client_email is distinct from q.to_email or p.due_date::text is distinct from q.quote_terms->>'dueDate' then raise exception 'current_quote_identity_mismatch';end if;
   update public.natori_case_current_operations set expected=natori_case_guard.current_identity(p),quote_id=q.id where owner_id=p_owner and id=p_id;
  end if;
  update public.natori_case_current_operations set effects=effects||jsonb_build_object(effect,'recorded'),evidence=evidence||jsonb_build_object(effect,coalesce(p_input->'result','{}'::jsonb)),updated_at=stamp where owner_id=p_owner and id=p_id;
 elsif p_action='quote_access' then
  if o.kind<>'quote_renotify' or o.effects ? 'quote_access' or o.quote_id is distinct from (p_input->>'quoteId')::uuid then raise exception 'current_quote_changed';end if;
  select * into q from public.natori_quotes where id=o.quote_id and id=p.active_quote_id and project_id=p.id and user_id=p_owner and superseded_at is null for update;
  if not found or p_input->>'tokenHash' !~ '^[a-f0-9]{64}$' or (p_input->>'expiresAt')::timestamptz<=stamp
    or (q.accepted_at is null and q.expires_at is distinct from (p_input->>'expiresAt')::timestamptz)
    or (p_input->>'expiresAt')::timestamptz>stamp+interval '14 days 1 minute' then raise exception 'current_quote_changed';end if;
  -- New capability for this same immutable version; never erase acceptance.
  insert into public.natori_quote_access(token_hash,quote_id,expires_at) values(p_input->>'tokenHash',q.id,(p_input->>'expiresAt')::timestamptz);
  update public.natori_case_current_operations set effects=effects||jsonb_build_object('quote_access','recorded'),updated_at=stamp where owner_id=p_owner and id=p_id;
 elsif p_action='mail_start' then
  if o.effects ? 'mail' or o.kind='expiry' then raise exception 'current_mail_already_started';end if;
  select * into q from public.natori_quotes where id=(p_input->>'quoteId')::uuid and project_id=p.id and user_id=p_owner and id=p.active_quote_id and superseded_at is null for update;
  if not found or q.amount is distinct from (p_input->>'amount')::integer or q.to_email is distinct from p_input->>'to' then raise exception 'current_quote_changed';end if;
  if o.kind='payment' and (q.id is distinct from o.quote_id or q.accepted_at is null or p.quote_accepted_amount is distinct from q.amount or p.payment_link_url is distinct from p_input->>'link' or p.payment_quote_id is distinct from q.id or p.payment_link_status not in ('ready','sent','send_failed')) then raise exception 'current_payment_changed';end if;
  if o.kind='quote_issue' and q.idempotency_key is distinct from p_id then raise exception 'current_quote_identity_mismatch';end if;
  if o.kind='quote_renotify' and q.id is distinct from o.quote_id then raise exception 'current_quote_changed';end if;
  if exists(select 1 from jsonb_each_text(o.effects) e where e.value<>'recorded') then raise exception 'current_prior_effect_unknown';end if;
  insert into public.natori_order_mail_logs(request_id,project_id,kind,to_email,amount,link_url,quote_id,subject,body_snapshot,status,sent_at)
  values(o.log_id,p.id,case when o.kind='payment' then 'payment' else 'estimate' end,p_input->>'to',q.amount,p_input->>'link',q.id,p_input->>'subject',p_input->>'body','pending',null);
  update public.natori_case_current_operations set quote_id=q.id,effects=effects||jsonb_build_object('mail','started'),updated_at=stamp where owner_id=p_owner and id=p_id;
 elsif p_action='mail_accepted' then
  if o.effects->>'mail' is distinct from 'started' or nullif(p_input->>'providerId','') is null then raise exception 'current_mail_not_started';end if;
  update public.natori_order_mail_logs set status='sent',sent_at=stamp,updated_at=stamp where request_id=o.log_id and project_id=p.id and status='pending';
  if not found then raise exception 'current_mail_log_missing';end if;
  -- Keep new payment facts; never rewind a paid/changed quote after an in-flight send.
  if p.active_quote_id=o.quote_id and p.payment_confirmed_at is null and p.deleted_at is null then
   if o.kind='payment' then
    update public.natori_projects set payment_link_status='sent',status=case when status='quoted' then 'awaiting_payment' else status end,
      next_action=case when status='quoted' then '入金確認後、ラフ開始' else next_action end where id=p.id;
   elsif p.quote_accepted_at is null and p.status in ('inquiry','consulting','estimating','quoted') then
    update public.natori_projects set status='quoted',next_action='案件化（入金待ちへ）' where id=p.id;
   end if;
  end if;
  update public.natori_case_current_operations set effects=effects||jsonb_build_object('mail','recorded'),provider_id=p_input->>'providerId',sent_at=stamp,updated_at=stamp where owner_id=p_owner and id=p_id;
 elsif p_action in ('finish','unknown') then
  settled:=p_action='finish' and not exists(select 1 from jsonb_each_text(o.effects) e where e.value<>'recorded');
  update public.natori_case_current_operations set status=case when settled then 'completed' else 'unknown' end,
   response=case when settled then p_input->'response' else null end,updated_at=stamp where owner_id=p_owner and id=p_id;
  delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;
  return jsonb_build_object('status',case when settled then 'completed' else 'unknown' end);
 else raise exception 'current_action_invalid';end if;
 delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;
 return 'true'::jsonb;
end $$;

create function public.natori_case_current_payment_v1(p_owner uuid,p_project uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('revision',public.natori_case_work_revision_v1(p.id),
 'complete',(select count(*)<=1000 from public.natori_order_mail_logs where project_id=p.id and kind='payment'),
 'blocked',exists(select 1 from public.natori_case_current_operations where project_id=p.id and status in ('running','unknown'))
   or exists(select 1 from public.natori_payment_link_attempts where project_id=p.id)
   or exists(select 1 from public.natori_notification_jobs where project_id=p.id and status<>'sent')
   or exists(select 1 from public.natori_payment_transactions where project_id=p.id and status not in ('received','manual')),
 'project',jsonb_build_object('id',p.id,'owner',p.user_id,'title',p.title,'clientName',p.client_name,'email',p.client_email,'status',p.status,'type',p.type,
   'deletedAt',p.deleted_at,'paidAt',p.payment_confirmed_at,'acceptedAt',p.quote_accepted_at,'acceptedAmount',p.quote_accepted_amount,'link',p.payment_link_url,'linkId',p.payment_link_id,'linkQuote',p.payment_quote_id,'linkAmount',p.quoted_amount,'linkStatus',p.payment_link_status),
 'quote',(select jsonb_build_object('id',q.id,'version',q.version,'amount',q.amount,'to',q.to_email,'acceptedAt',q.accepted_at,'supersededAt',q.superseded_at) from public.natori_quotes q where q.id=p.active_quote_id and q.project_id=p.id and q.user_id=p.user_id),
 'logs',coalesce((select jsonb_agg(jsonb_build_object('id',l.request_id,'status',l.status,'sentAt',l.sent_at,'sameLink',coalesce(l.link_url=p.payment_link_url,false),'quoteId',l.quote_id,'amount',l.amount) order by l.created_at,l.id)
  from (select * from public.natori_order_mail_logs where project_id=p.id and kind='payment' order by created_at,id limit 1001) l),'[]'::jsonb))
 from public.natori_projects p where p.id=p_project and p.user_id=p_owner
$$;
create function public.natori_case_current_expiry_v1(p_owner uuid,p_project uuid,p_id text,p_action text,p_link text,p_sent_at timestamptz,p_now timestamptz) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare p public.natori_projects%rowtype;o public.natori_case_current_operations%rowtype;latest timestamptz;frame bigint;
begin
 perform natori_case_guard.shared_lock();perform natori_case_guard.check_contract('current_flow');
 select * into p from public.natori_projects where id=p_project and user_id=p_owner for update;
 if not found then return false;end if;
 select * into o from public.natori_case_current_operations where owner_id=p_owner and id=p_id for update;
 if p_action='claim' then
  if o.id is not null or p.payment_link_id is distinct from p_link or p.payment_link_status is distinct from 'sent' or p.payment_confirmed_at is not null then return false;end if;
  if public.natori_case_system_admit_v1(p_owner,'command') is distinct from true or public.natori_case_system_admit_v1(p_owner,'sender') is distinct from true then raise exception 'natori_system_held';end if;
  if exists(select 1 from public.natori_case_current_operations where project_id=p.id and status in ('running','unknown'))
   or exists(select 1 from public.natori_payment_link_attempts where project_id=p.id)
   or exists(select 1 from public.natori_order_mail_logs where project_id=p.id and kind='payment' and status<>'sent') then return false;end if;
  select max(sent_at) into latest from public.natori_order_mail_logs where project_id=p.id and kind='payment' and status='sent' and link_url=p.payment_link_url;
  if latest is null or latest is distinct from p_sent_at or latest+interval '7 days'>least(p_now,clock_timestamp()) then return false;end if;
  insert into public.natori_case_current_operations(owner_id,project_id,id,kind,request_hash,revision,expected,effects)
  values(p_owner,p.id,p_id,'expiry',encode(sha256(convert_to(p_link||latest::text,'UTF8')),'hex'),public.natori_case_work_revision_v1(p.id),jsonb_build_object('link',p_link,'sentAt',latest),'{"stop":"started"}');
 elsif p_action='record' then
  if o.project_id is distinct from p_project or o.kind is distinct from 'expiry' or o.status is distinct from 'running' or o.expected->>'link' is distinct from p_link then return false;end if;
  insert into natori_case_guard.frames(pid,tx,root,owner_id,project_id,fact) values(pg_backend_pid(),txid_current(),'current_flow',p_owner,p_project,true) returning depth into frame;
  update public.natori_projects set payment_link_status='void' where id=p.id and payment_link_id=p_link and payment_confirmed_at is null and payment_link_status='sent';
  update public.natori_case_current_operations set status='completed',effects='{"stop":"recorded"}',response='{"kind":"ok"}',updated_at=clock_timestamp() where owner_id=p_owner and id=p_id;
  delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;
 else return false;end if;
 return true;
end $$;

-- The existing signed webhook and its atomic payment functions remain the
-- authority. This envelope grants only their existing, owner/project-bound facts.
create function public.natori_case_current_payment_fact_v1(p_project uuid,p_session text,p_amount integer,p_quote uuid,p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare owner_id uuid;frame bigint;result jsonb;
begin
 perform natori_case_guard.shared_lock();perform natori_case_guard.check_contract('current_payment_fact');
 select p.user_id into owner_id from public.natori_projects p where p.id=p_project;
 if owner_id is null or nullif(trim(p_session),'') is null then raise exception 'payment_fact_identity_required';end if;
 insert into natori_case_guard.frames(pid,tx,root,owner_id,project_id,fact) values(pg_backend_pid(),txid_current(),'current_payment_fact',owner_id,p_project,true) returning depth into frame;
 if p_reason is null then select jsonb_agg(to_jsonb(r)) into result from public.natori_record_stripe_payment(p_project,p_session,p_amount,p_quote) r;
 else select jsonb_agg(to_jsonb(r)) into result from public.natori_record_unresolved_stripe_payment_v1(p_project,p_session,p_amount,p_reason) r;end if;
 delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;
 return result;
end $$;
revoke all on function public.natori_case_current_expiry_v1(uuid,uuid,text,text,text,timestamptz,timestamptz),public.natori_case_current_payment_fact_v1(uuid,text,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.natori_case_current_expiry_v1(uuid,uuid,text,text,text,timestamptz,timestamptz),public.natori_case_current_payment_fact_v1(uuid,text,integer,uuid,text) to service_role;
insert into natori_case_guard.effects values('current_payment_fact','public.natori_projects'),('current_payment_fact','public.natori_payment_transactions'),('current_payment_fact','public.natori_project_activity'),('current_payment_fact','public.natori_project_tasks');
insert into natori_case_guard.permissions values('current_payment_fact','function','public.natori_record_stripe_payment(uuid,text,integer,uuid)'::regprocedure::oid::text,'EXECUTE'),('current_payment_fact','function','public.natori_record_unresolved_stripe_payment_v1(uuid,text,integer,text)'::regprocedure::oid::text,'EXECUTE');
revoke all on function public.natori_case_current_payment_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.natori_case_current_payment_v1(uuid,uuid) to service_role;
revoke all on function public.natori_case_current_read_v1(uuid,uuid,text,text),public.natori_case_current_claim_v1(uuid,uuid,text,text,text,text),public.natori_case_current_step_v1(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.natori_case_current_read_v1(uuid,uuid,text,text),public.natori_case_current_claim_v1(uuid,uuid,text,text,text,text),public.natori_case_current_step_v1(uuid,uuid,text,text,jsonb) to service_role;
insert into natori_case_guard.effects values ('current_flow','public.natori_case_current_operations'),('current_flow','public.natori_order_mail_logs'),('current_flow','public.natori_projects'),('current_flow','public.natori_project_activity'),('current_flow','public.natori_project_tasks');
revoke all on all functions in schema natori_case_guard from public,anon,authenticated,service_role;
-- Read-only extra association evidence. Provider URLs/IDs never leave the reader.
do $read_upgrade$
declare f record;old text:='a.id::text AS attempt_id';replacement text:='a.id::text AS attempt_id, md5(l.link_url) AS link_identity, coalesce(l.link_url=p.payment_link_url AND l.quote_id=p.payment_quote_id,false) AS is_project_link';
begin
 select p.prosrc,pg_get_functiondef(p.oid) as definition into f from pg_proc p where p.oid='public.natori_case_snapshot_v1(uuid,uuid)'::regprocedure;
 if (length(f.prosrc)-length(replace(f.prosrc,old,'')))/length(old)<>1 then raise exception 'current_read_predecessor_changed';end if;
 if (length(f.prosrc)-length(replace(f.prosrc,'p.payment_link_url, p.payment_link_status,','')))/length('p.payment_link_url, p.payment_link_status,')<>1 then raise exception 'current_read_scope_changed';end if;
 execute replace(f.definition,f.prosrc,replace(replace(f.prosrc,old,replacement),'p.payment_link_url, p.payment_link_status,','p.payment_link_url, p.payment_link_status, p.payment_quote_id,'));
end $read_upgrade$;

-- Unknown direct operations participate in the existing global outbound fence
-- and fresh stop/resume review; do not lose a pre-mail Stripe effect there.
do $current_fences$
declare f record;body text;anchor text;
begin
 select p.prosrc,pg_get_functiondef(p.oid) definition into f from pg_proc p where p.oid='public.natori_case_outbound_blocked_v1(uuid,uuid,uuid)'::regprocedure;
 anchor:=' select exists(';
 if (length(f.prosrc)-length(replace(f.prosrc,anchor,'')))/length(anchor)<>1 then raise exception 'current_outbound_predecessor_changed';end if;
 body:=replace(f.prosrc,anchor,' select exists(select 1 from public.natori_case_current_operations where project_id=p_project and status in (''running'',''unknown'')) or exists(');
 execute replace(f.definition,f.prosrc,body);
 select p.prosrc,pg_get_functiondef(p.oid) definition into f from pg_proc p where p.oid='public.natori_case_system_review_v1(uuid)'::regprocedure;
 anchor:=' ) pending;';
 if (length(f.prosrc)-length(replace(f.prosrc,anchor,'')))/length(anchor)<>1 then raise exception 'current_review_predecessor_changed';end if;
 body:=replace(f.prosrc,anchor,' union all select ''current-operation'',o.id,o.project_id,o.kind||''/''||o.status,null::timestamptz,true,o.status=''running'' from public.natori_case_current_operations o where o.owner_id=p_owner and o.status in (''running'',''unknown'')'||chr(10)||anchor);
 execute replace(f.definition,f.prosrc,body);
end $current_fences$;
delete from natori_case_guard.dependencies;
insert into natori_case_guard.dependencies select * from natori_case_guard.images();
commit;
