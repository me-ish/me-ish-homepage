-- Workspace-only receipt retirement. No failure inference, new provider key, or resend.
begin;

create function public.natori_case_payment_receipt_reason_v1(p_owner_id uuid,p_project_id uuid,p_operation_id uuid)
returns text language sql volatile security invoker set search_path='' as $$
 select case
  when o.workspace_guard->'receiptRetention'->>'state'='retired' then o.workspace_guard->'receiptRetention'->>'reason'
  when a.price_id is null and a.price_started_at<clock_timestamp()-interval '23 hours' then 'price_creation_unresolved'
  when a.link_id is null and a.link_started_at<clock_timestamp()-interval '23 hours' then 'link_creation_unresolved'
  when least(a.deadline,coalesce((o.workspace_request->>'expiresAt')::timestamptz,a.deadline))<=clock_timestamp() then 'payment_deadline_elapsed'
  when o.workspace_request is null then 'receipt_missing'
 end
 from public.natori_payment_link_operations o
 join public.natori_projects p on p.id=o.project_id and p.user_id=p_owner_id
 join public.natori_payment_link_attempts a on a.id=o.attempt_id and a.project_id=p.id and a.owner_id=p.user_id
 where o.project_id=p_project_id and o.operation_id=p_operation_id and o.status='pending' and o.workspace_guard is not null
$$;
revoke all on function public.natori_case_payment_receipt_reason_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.natori_case_payment_receipt_reason_v1(uuid,uuid,uuid) to service_role;

create function public.natori_case_payment_receipts_retire_v1(p_owner_id uuid,p_project_id uuid default null,p_limit integer default 100)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p record; o public.natori_payment_link_operations%rowtype; a public.natori_payment_link_attempts%rowtype;
 reason text; retired integer:=0; deferred integer:=0; remaining bigint; oldest timestamptz;
begin
 if p_owner_id is null or p_limit is null or p_limit<1 or p_limit>100 then raise exception 'invalid_retirement_scope'; end if;
 -- Project lock is shared with every workspace writer. Skip a live command rather than wait.
 for p in select x.id from public.natori_projects x where x.user_id=p_owner_id
   and (p_project_id is null or x.id=p_project_id) and exists(
    select 1 from public.natori_payment_link_operations op where op.project_id=x.id and op.status='pending'
     and op.workspace_guard is not null and coalesce(op.workspace_guard->'receiptRetention'->>'state','')<>'retired'
     and public.natori_case_payment_receipt_reason_v1(p_owner_id,x.id,op.operation_id) is not null)
   order by x.id limit p_limit for update of x skip locked loop
  for o in select * from public.natori_payment_link_operations op where op.project_id=p.id and op.status='pending'
   and op.workspace_guard is not null and coalesce(op.workspace_guard->'receiptRetention'->>'state','')<>'retired' for update loop
   select * into a from public.natori_payment_link_attempts where id=o.attempt_id for update;
   reason:=public.natori_case_payment_receipt_reason_v1(p_owner_id,p.id,o.operation_id);
   if reason is null then continue; end if;
   if a.lease_until>clock_timestamp() or a.mail_until>clock_timestamp() or exists(
     select 1 from public.natori_notification_jobs j where j.id=o.notification_id and j.lease_expires_at>clock_timestamp()) then
    deferred:=deferred+1; continue;
   end if;
   update public.natori_payment_link_operations set workspace_request=null,workspace_guard=jsonb_build_object(
    'receiptRetention',jsonb_build_object('state','retired','reason',reason,'retiredAt',clock_timestamp(),
      'guardHash',encode(sha256(convert_to(o.workspace_guard::text,'UTF8')),'hex')),
    'quote',jsonb_build_object('id',o.workspace_guard->'quote'->'id','version',o.workspace_guard->'quote'->'version',
      'amount',o.workspace_guard->'quote'->'amount','acceptedAt',o.workspace_guard->'quote'->'acceptedAt'),
    'identity',jsonb_build_object('id',p.id,'owner',p_owner_id,'metadataHash',o.workspace_guard->'identity'->'metadataHash'))
    where project_id=p.id and operation_id=o.operation_id;
   -- Same safety fact as the existing writer's 23h gate. Keep operation pending and all provider references.
   if reason in ('price_creation_unresolved','link_creation_unresolved') and a.state='creating' then
    update public.natori_payment_link_attempts set state='needs_review',review_reason='idempotency_retention_elapsed',updated_at=clock_timestamp() where id=a.id;
   end if;
   retired:=retired+1;
  end loop;
 end loop;
 select count(*),min(least(at.deadline,(op.workspace_request->>'expiresAt')::timestamptz,
   case when at.price_id is null then at.price_started_at+interval '23 hours' end,
   case when at.link_id is null then at.link_started_at+interval '23 hours' end,
   case when op.workspace_request is null then op.created_at end))
 into remaining,oldest from public.natori_payment_link_operations op
 join public.natori_projects pr on pr.id=op.project_id and pr.user_id=p_owner_id
 join public.natori_payment_link_attempts at on at.id=op.attempt_id
 where (p_project_id is null or op.project_id=p_project_id) and op.status='pending' and op.workspace_guard is not null
  and coalesce(op.workspace_guard->'receiptRetention'->>'state','')<>'retired'
  and public.natori_case_payment_receipt_reason_v1(p_owner_id,op.project_id,op.operation_id) is not null;
 return jsonb_build_object('retired',retired,'deferred',deferred,'remaining',remaining,'oldestEligibleAt',oldest);
end $$;
revoke all on function public.natori_case_payment_receipts_retire_v1(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.natori_case_payment_receipts_retire_v1(uuid,uuid,integer) to service_role;

create or replace function public.natori_case_payment_snapshot_v1(p_owner_id uuid,p_project_id uuid,p_operation_id uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('project',jsonb_build_object('id',p.id,'owner',p.user_id,'title',p.title,'clientName',p.client_name,'email',p.client_email,
  'status',p.status,'acceptedAmount',p.quote_accepted_amount,'acceptedAt',p.quote_accepted_at,'paidAt',p.payment_confirmed_at,'deletedAt',p.deleted_at,'legacyLink',p.payment_link_id),
  'quote',(select jsonb_build_object('id',q.id,'version',q.version,'amount',q.amount,'acceptedAt',q.accepted_at,'supersededAt',q.superseded_at)
   from public.natori_quotes q where q.id=p.active_quote_id and q.project_id=p.id and q.user_id=p.user_id),
  'link',(select jsonb_build_object('id',a.id,'quoteId',a.quote_id,'generation',a.generation,'revision',a.deadline_revision,'deadline',a.deadline,'state',a.state,'url',a.link_url,'amount',a.amount)
   from public.natori_payment_link_attempts a where a.project_id=p.id and a.owner_id=p.user_id order by a.generation desc limit 1),
  'jobs',coalesce((select jsonb_agg(to_jsonb(j) order by j.created_at,j.id) from
   (select distinct on (notification_key) id,notification_key,attempt_no,status,sent_at,created_at,send_started_at,lease_expires_at,quote_id,snapshot,payload from public.natori_notification_jobs
    where project_id=p.id and purpose='payment_link_client' order by notification_key,attempt_no desc limit 101) j),'[]'::jsonb),
  'noticeGuards',coalesce((select jsonb_object_agg(g.notification_key,g.workspace_guard) from
   (select original.notification_key,x.workspace_guard from public.natori_payment_link_operations x
    join public.natori_notification_jobs original on original.id=x.notification_id
    where x.project_id=p.id and x.workspace_guard is not null order by x.created_at desc,x.operation_id limit 101) g),'{}'::jsonb),
  'legacyCount',(select count(*) from public.natori_order_mail_logs where project_id=p.id and kind='payment'),
  'review',exists(select 1 from public.natori_stripe_event_inbox where project_id=p.id and status<>'completed'),
  'operation',(select jsonb_build_object('id',operation_id,'status',status,'request',case when public.natori_case_payment_receipt_reason_v1(p_owner_id,p.id,operation_id) is null then workspace_request else null end,'retirementReason',public.natori_case_payment_receipt_reason_v1(p_owner_id,p.id,operation_id),'guard',workspace_guard,'notificationId',notification_id)
    from public.natori_payment_link_operations where project_id=p.id and workspace_guard is not null
    and (case when p_operation_id is not null then operation_id=p_operation_id else true end)
    order by (status='pending') desc,created_at desc,operation_id limit 1),
  'pending',exists(select 1 from public.natori_payment_link_operations where project_id=p.id and status='pending'),
  'rejection',(select reason from public.natori_payment_link_rejections where project_id=p.id and operation_id=p_operation_id))
 from public.natori_projects p where p.id=p_project_id and p.user_id=p_owner_id
$$;

-- Calls the existing fenced generation writer under its project lock, with the
-- exact reviewed quote/link/notification baseline. No authorization comes from UI.
create or replace function public.natori_case_payment_command_v1(p_owner_id uuid,p_project_id uuid,p_command text,p_input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v jsonb; g jsonb; o public.natori_payment_link_operations%rowtype; r jsonb; j public.natori_notification_jobs%rowtype; n uuid;
begin
 perform 1 from public.natori_projects where id=p_project_id and user_id=p_owner_id for update;
 if not found then return jsonb_build_object('result','not_found'); end if;
 v:=public.natori_case_payment_snapshot_v1(p_owner_id,p_project_id,(p_input->>'operationId')::uuid);
 g:=jsonb_build_object('quote',v->'quote','identity',((v->'project')-array['status','paidAt','deletedAt','legacyLink','title','clientName','email'])||jsonb_build_object('metadataHash',
  encode(sha256(convert_to(octet_length(v->'project'->>'title')::text||':'||(v->'project'->>'title')||
   octet_length(v->'project'->>'clientName')::text||':'||(v->'project'->>'clientName')||
   octet_length(coalesce(v->'project'->>'email',''))::text||':'||coalesce(v->'project'->>'email',''),'UTF8')),'hex')),
  'link',v->'link','notices',(select coalesce(jsonb_agg(jsonb_build_object('id',x->'id','status',x->'status') order by x->>'id'),'[]'::jsonb) from jsonb_array_elements(v->'jobs') x),
  'legacyCount',v->'legacyCount');
 if p_command in ('begin','stage','finish') then
  select * into o from public.natori_payment_link_operations where project_id=p_project_id and operation_id=(p_input->>'operationId')::uuid;
  if o.operation_id is not null and o.status='pending' and (
    o.workspace_guard->'receiptRetention'->>'state'='retired' or o.workspace_request is null
    or (p_command='begin' and public.natori_case_payment_receipt_reason_v1(p_owner_id,p_project_id,o.operation_id) is not null)
  ) then return jsonb_build_object('result','receipt_retired','operationState','pending','operationId',o.operation_id); end if;
  if o.operation_id is null then
   if p_command<>'begin' then return jsonb_build_object('result','not_found'); end if;
   if p_input->'guard' is distinct from g or jsonb_array_length(v->'jobs')>100 or (v->>'pending')::boolean
    or exists(select 1 from jsonb_array_elements(v->'jobs') x where x->>'status'<>'sent')
    or (v->>'legacyCount')::integer>0 or p_input->>'action' not in ('issue','renotify') then
    return public.natori_payment_link_reject_v1(p_project_id,(p_input->>'operationId')::uuid,p_input->>'hash','confirmation_stale'); end if;
   if jsonb_typeof(p_input->'receipt') is distinct from 'object' then return jsonb_build_object('result','invalid_request'); end if;
  elsif o.workspace_guard is null or o.workspace_guard is distinct from p_input->'guard' then return jsonb_build_object('result','conflict');
  end if;
  -- Re-notification must still refer to the exact reviewed link/deadline revision.
  -- An issue operation starts without a link, then records its generated ID normally.
  if o.action='renotify' and p_input->'guard'->'link' is distinct from g->'link' then
   return jsonb_build_object('result','confirmation_stale'); end if;
  -- Link changes are expected during creation; the accepted quote and recipient are not.
  if p_input->'guard'->'quote' is distinct from g->'quote' or p_input->'guard'->'identity' is distinct from g->'identity'
    or (v->'project'->>'paidAt') is not null or (v->'project'->>'deletedAt') is not null
    or v->'project'->>'status' not in ('quoted','awaiting_payment') or (v->>'review')::boolean then
   if o.operation_id is null then return public.natori_payment_link_reject_v1(p_project_id,(p_input->>'operationId')::uuid,p_input->>'hash','confirmation_stale'); end if;
   return jsonb_build_object('result','confirmation_stale'); end if;
  r:=public.natori_payment_links_v1(p_owner_id,p_project_id,p_command,p_input);
  if p_command='begin' and o.operation_id is null and r->>'result'='claimed' then
   update public.natori_payment_link_operations set workspace_guard=p_input->'guard',workspace_request=p_input->'receipt'
    where project_id=p_project_id and operation_id=(p_input->>'operationId')::uuid;
  end if;
  if p_command='finish' and r->>'result'='completed' then
   update public.natori_payment_link_operations set workspace_request=null where project_id=p_project_id and operation_id=(p_input->>'operationId')::uuid;
  end if;
  return r;
 elsif p_command='mail_gate' then
  select * into j from public.natori_notification_jobs where id=(p_input->>'jobId')::uuid and project_id=p_project_id and purpose='payment_link_client';
  -- Retry jobs retain their notification_key and frozen payload, not the original id.
  select x.* into o from public.natori_payment_link_operations x join public.natori_notification_jobs original on original.id=x.notification_id
   where x.project_id=p_project_id and original.notification_key=j.notification_key;
  if p_input->>'action'='release' then return public.natori_payment_links_v1(p_owner_id,p_project_id,p_command,p_input); end if;
  if o.workspace_guard is null or o.workspace_guard->'quote' is distinct from g->'quote' or o.workspace_guard->'identity' is distinct from g->'identity'
   or v->'project'->>'status' not in ('quoted','awaiting_payment') or j.quote_id is distinct from (v->'quote'->>'id')::uuid or (v->>'review')::boolean then return jsonb_build_object('result','blocked'); end if;
  return public.natori_payment_links_v1(p_owner_id,p_project_id,p_command,p_input);
 elsif p_command in ('retry','resume') then
  if p_input->'guard' is distinct from g or (v->>'pending')::boolean or (v->>'review')::boolean or jsonb_array_length(v->'jobs')>100
   or v->'project'->>'paidAt' is not null or v->'project'->>'deletedAt' is not null or v->'project'->>'status' not in ('quoted','awaiting_payment')
   then return jsonb_build_object('result','confirmation_stale'); end if;
  select * into j from public.natori_notification_jobs where id=(p_input->>'jobId')::uuid and project_id=p_project_id and purpose='payment_link_client'
   and (case when p_command='retry' then status='failed' else status in ('pending','sending') and send_started_at is null and (lease_expires_at is null or lease_expires_at<=clock_timestamp()) end);
  if j.id is null or exists(select 1 from jsonb_array_elements(v->'jobs') x where x->>'status'<>'sent' and x->>'id'<>j.id::text)
   then return jsonb_build_object('result','confirmation_stale'); end if;
  -- This also verifies current quote/attempt/deadline at the eventual mail gate.
  if not exists(select 1 from public.natori_payment_link_operations x join public.natori_notification_jobs original on original.id=x.notification_id
   where x.project_id=p_project_id and original.notification_key=j.notification_key and x.workspace_guard->'quote'=g->'quote' and x.workspace_guard->'identity'=g->'identity')
   then return jsonb_build_object('result','needs_review'); end if;
  if p_command='resume' then n:=j.id;else select public.natori_notification_retry_v1(j.id,p_owner_id) into n;end if;
  return jsonb_build_object('result',case when n is null then 'needs_review' else 'queued' end,'notificationId',n);
 elsif p_command in ('operation','context') then
  return public.natori_payment_links_v1(p_owner_id,p_project_id,p_command,p_input);
 end if;
 return jsonb_build_object('result','invalid_command');
end $$;
revoke all on function public.natori_case_payment_snapshot_v1(uuid,uuid,uuid), public.natori_case_payment_command_v1(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.natori_case_payment_snapshot_v1(uuid,uuid,uuid), public.natori_case_payment_command_v1(uuid,uuid,text,jsonb) to service_role;

commit;
