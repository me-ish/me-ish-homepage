-- Phase 3A expand/cutover: new public intake only. No old project backfill or mail send.
begin;
create table public.natori_intake_operations (
  owner_id uuid not null references auth.users(id),
  operation_id uuid not null,
  request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'),
  project_id uuid not null default gen_random_uuid() unique,
  manifest jsonb not null check(jsonb_typeof(manifest)='array' and jsonb_array_length(manifest)<=5),
  reference_paths jsonb not null check(jsonb_typeof(reference_paths)='array' and jsonb_array_length(reference_paths)<=5),
  status text not null default 'processing' check(status in ('processing','completed','failed','needs_review')),
  claim_token uuid,
  lease_expires_at timestamptz,
  replay_result jsonb,
  notification_ids uuid[] not null default array[]::uuid[],
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(owner_id,operation_id),
  check(status<>'completed' or (replay_result is not null and cardinality(notification_ids)=2)),
  check(status<>'processing' or (claim_token is not null and lease_expires_at is not null))
);
alter table public.natori_intake_operations enable row level security;
revoke all on public.natori_intake_operations from public,anon,authenticated,service_role;
grant select,insert,update on public.natori_intake_operations to service_role;

alter table public.natori_notification_jobs drop constraint natori_notification_jobs_purpose_check;
alter table public.natori_notification_jobs add constraint natori_notification_jobs_purpose_check check
 (purpose in ('quote_accept_artist','delivery_accept_artist','delivery_accept_client','delivery_issue_client','quote_issue_client',
 'payment_received_artist','payment_received_client','payment_review_artist','payment_link_client','refund_confirmed_artist','refund_review_artist','intake_artist','intake_client'));

create function public.natori_intake_immutable_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if (new.owner_id,new.operation_id,new.request_hash,new.project_id,new.manifest,new.reference_paths,new.created_at)
   is distinct from (old.owner_id,old.operation_id,old.request_hash,old.project_id,old.manifest,old.reference_paths,old.created_at)
   or (old.status='completed' and new is distinct from old) then
   raise exception 'immutable_intake_operation' using errcode='23514';
 end if;
 return new;
end; $$;
create trigger natori_intake_immutable before update on public.natori_intake_operations
 for each row execute function public.natori_intake_immutable_v1();

-- Server-only capability lookup. HTTP exposes only result/replay_result, never project/PII/storage/claim.
create function public.natori_intake_lookup_v1(p_owner_id uuid,p_operation_id uuid,p_request_hash text)
returns table(result text,replay_result jsonb,project_id uuid,reference_paths jsonb,notification_ids uuid[])
language plpgsql security invoker set search_path='' as $$
declare op public.natori_intake_operations%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text||'/intake/'||p_operation_id::text,0));
 select * into op from public.natori_intake_operations o where o.owner_id=p_owner_id and o.operation_id=p_operation_id for share;
 if not found then return query select 'not_found'::text,null::jsonb,null::uuid,null::jsonb,array[]::uuid[]; return; end if;
 if op.request_hash<>p_request_hash then return query select 'conflict'::text,null::jsonb,null::uuid,null::jsonb,array[]::uuid[]; return; end if;
 return query select op.status,op.replay_result,op.project_id,op.reference_paths,op.notification_ids;
end; $$;

-- Linearize an edit/retry decision against a delayed original request. A plain missing-row
-- lookup cannot prove that an earlier HTTP request will never arrive at begin later.
create function public.natori_intake_settle_v1(p_owner_id uuid,p_operation_id uuid,p_request_hash text)
returns table(result text,replay_result jsonb,project_id uuid,reference_paths jsonb,notification_ids uuid[])
language plpgsql security invoker set search_path='' as $$
declare op public.natori_intake_operations%rowtype;
begin
 if p_owner_id is null or p_operation_id is null or p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
  raise exception 'invalid_intake_operation' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text||'/intake/'||p_operation_id::text,0));
 select * into op from public.natori_intake_operations o where o.owner_id=p_owner_id and o.operation_id=p_operation_id for update;
 if not found then
  insert into public.natori_intake_operations(owner_id,operation_id,request_hash,manifest,reference_paths,status)
   values(p_owner_id,p_operation_id,p_request_hash,'[]'::jsonb,'[]'::jsonb,'failed') returning * into op;
 elsif op.request_hash<>p_request_hash then
  return query select 'conflict'::text,null::jsonb,null::uuid,null::jsonb,array[]::uuid[]; return;
 elsif op.status='processing' and op.lease_expires_at<=clock_timestamp() then
  -- A finish in progress holds this row lock. Its transaction either completes first
  -- or rolls back before this failed fence can be installed.
  if exists(select 1 from public.natori_projects p where p.id=op.project_id) then
   update public.natori_intake_operations set status='needs_review',claim_token=null,lease_expires_at=null,updated_at=clock_timestamp()
    where owner_id=p_owner_id and operation_id=p_operation_id returning * into op;
  else
   update public.natori_intake_operations set status='failed',claim_token=null,lease_expires_at=null,updated_at=clock_timestamp()
    where owner_id=p_owner_id and operation_id=p_operation_id returning * into op;
  end if;
 end if;
 return query select op.status,op.replay_result,op.project_id,op.reference_paths,op.notification_ids;
end; $$;

-- Serialize against portfolio admission updates. Mass-production admission requires an explicit saved true.
create function public.natori_intake_admitted_v1(p_mass_production boolean) returns boolean
language plpgsql security invoker set search_path='' as $$
declare c jsonb;
begin
 select content into c from public.natori_portfolio_content where id='main' for share;
 if not found then return not p_mass_production; end if;
 if jsonb_typeof(c)<>'object' then return false; end if;
 if (c ? 'commissionOpen' and jsonb_typeof(c->'commissionOpen')<>'boolean')
  or (c ? 'massProductionIllustrationOpen' and jsonb_typeof(c->'massProductionIllustrationOpen')<>'boolean') then return false; end if;
 return coalesce((c->>'commissionOpen')::boolean,true)
   and (not p_mass_production or coalesce((c->>'massProductionIllustrationOpen')::boolean,false));
end; $$;

create function public.natori_intake_begin_v1(p_owner_id uuid,p_operation_id uuid,p_request_hash text,p_manifest jsonb,p_file_ids jsonb,p_claim_token uuid,p_mass_production boolean)
returns table(result text,replay_result jsonb,project_id uuid,reference_paths jsonb,notification_ids uuid[])
language plpgsql security invoker set search_path='' as $$
declare op public.natori_intake_operations%rowtype; pid uuid:=gen_random_uuid(); paths jsonb; t timestamptz; admitted boolean; item jsonb;
begin
 if p_owner_id is null or p_operation_id is null or p_claim_token is null or p_mass_production is null
  or p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$'
  or p_manifest is null or jsonb_typeof(p_manifest)<>'array' or jsonb_array_length(p_manifest)>5
  or p_file_ids is null or jsonb_typeof(p_file_ids)<>'array' or jsonb_array_length(p_file_ids)<>jsonb_array_length(p_manifest)
  or (select count(*)<>count(distinct value) from jsonb_array_elements(p_file_ids))
  or exists(select 1 from jsonb_array_elements(p_file_ids) where jsonb_typeof(value)<>'string' or value#>>'{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
  raise exception 'invalid_intake_operation' using errcode='22023';
 end if;
 for item in select value from jsonb_array_elements(p_manifest) loop
  if not public.natori_jsonb_has_exact_keys_v1(item,array['digest','size','type'])
   or jsonb_typeof(item->'digest')<>'string' or jsonb_typeof(item->'type')<>'string' or item->>'digest' !~ '^[0-9a-f]{64}$'
   or jsonb_typeof(item->'size')<>'number' or (item->>'size')::numeric not between 1 and 4194304
   or mod((item->>'size')::numeric,1)<>0 or item->>'type' not in ('image/png','image/jpeg','image/webp','image/gif') then
   raise exception 'invalid_intake_manifest' using errcode='22023';
  end if;
 end loop;
 if (select coalesce(sum((value->>'size')::numeric),0)>4194304 from jsonb_array_elements(p_manifest)) then
  raise exception 'invalid_intake_manifest' using errcode='22023';
 end if;
 -- Same operation races serialize before admission/quota-independent replay.
 perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text||'/intake/'||p_operation_id::text,0));
 select * into op from public.natori_intake_operations o where o.owner_id=p_owner_id and o.operation_id=p_operation_id for update;
 -- Waiting for either lock must not resurrect a stale lease timestamp.
 t:=clock_timestamp();
 if found then
  if op.request_hash<>p_request_hash or op.manifest<>p_manifest then
   return query select 'conflict'::text,null::jsonb,null::uuid,null::jsonb,array[]::uuid[]; return;
  end if;
  if op.status='completed' then
   return query select op.status,op.replay_result,op.project_id,op.reference_paths,op.notification_ids; return;
  end if;
  if op.status<>'processing' or (op.lease_expires_at>t and op.claim_token<>p_claim_token) then
   return query select case when op.status='processing' then 'busy' else op.status end,null::jsonb,null::uuid,null::jsonb,array[]::uuid[]; return;
  end if;
  admitted:=public.natori_intake_admitted_v1(p_mass_production);
  t:=clock_timestamp();
  if not admitted then
   update public.natori_intake_operations set status='failed',claim_token=null,lease_expires_at=null,updated_at=t
    where owner_id=p_owner_id and operation_id=p_operation_id;
   return query select 'failed'::text,null::jsonb,null::uuid,null::jsonb,array[]::uuid[]; return;
  end if;
  update public.natori_intake_operations set claim_token=p_claim_token,lease_expires_at=t+interval '2 minutes',updated_at=t
   where owner_id=p_owner_id and operation_id=p_operation_id returning * into op;
 else
  admitted:=public.natori_intake_admitted_v1(p_mass_production);
  t:=clock_timestamp();
  select coalesce(jsonb_agg(pid::text||'/'||(f.value#>>'{}')||'.webp' order by f.ordinality),'[]'::jsonb) into paths
    from jsonb_array_elements(p_file_ids) with ordinality f;
  if not admitted then
   -- Definitive rejection is durable: a delayed copy cannot begin after reopening.
   insert into public.natori_intake_operations(owner_id,operation_id,request_hash,project_id,manifest,reference_paths,status)
    values(p_owner_id,p_operation_id,p_request_hash,pid,p_manifest,paths,'failed');
   return query select 'failed'::text,null::jsonb,null::uuid,null::jsonb,array[]::uuid[]; return;
  end if;
  insert into public.natori_intake_operations(owner_id,operation_id,request_hash,project_id,manifest,reference_paths,claim_token,lease_expires_at)
   values(p_owner_id,p_operation_id,p_request_hash,pid,p_manifest,paths,p_claim_token,t+interval '2 minutes') returning * into op;
 end if;
 return query select 'claimed'::text,null::jsonb,op.project_id,op.reference_paths,array[]::uuid[];
end; $$;

create function public.natori_intake_touch_v1(p_owner_id uuid,p_operation_id uuid,p_request_hash text,p_claim_token uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare op public.natori_intake_operations%rowtype; t timestamptz;
begin
 select * into op from public.natori_intake_operations o where o.owner_id=p_owner_id and o.operation_id=p_operation_id for update;
 t:=clock_timestamp();
 if not found or op.request_hash<>p_request_hash or op.status<>'processing' or op.claim_token<>p_claim_token or op.lease_expires_at<=t then return false; end if;
 update public.natori_intake_operations set lease_expires_at=t+interval '2 minutes',updated_at=t
  where owner_id=p_owner_id and operation_id=p_operation_id;
 return true;
end; $$;

create function public.natori_intake_finish_v1(p_owner_id uuid,p_operation_id uuid,p_request_hash text,p_claim_token uuid,p_client_name text,p_client_email text,p_request_data jsonb,p_reference_links jsonb,p_mass_production boolean)
returns table(result text,replay_result jsonb,project_id uuid,reference_paths jsonb,notification_ids uuid[])
language plpgsql security invoker set search_path='' as $$
declare op public.natori_intake_operations%rowtype; r record; ids uuid[]; receipt jsonb; p public.natori_projects%rowtype;
begin
 if p_mass_production is null then raise exception 'invalid_intake_operation' using errcode='22023'; end if;
 select * into op from public.natori_intake_operations o where o.owner_id=p_owner_id and o.operation_id=p_operation_id for update;
 if not found then return query select 'not_found'::text,null::jsonb,null::uuid,null::jsonb,array[]::uuid[]; return; end if;
 if op.request_hash<>p_request_hash then return query select 'conflict'::text,null::jsonb,null::uuid,null::jsonb,array[]::uuid[]; return; end if;
 if op.status='completed' then return query select op.status,op.replay_result,op.project_id,op.reference_paths,op.notification_ids; return; end if;
 if op.status<>'processing' or op.claim_token<>p_claim_token or op.lease_expires_at<=clock_timestamp() then
  return query select 'busy'::text,null::jsonb,null::uuid,null::jsonb,array[]::uuid[]; return;
 end if;
 if not public.natori_intake_admitted_v1(p_mass_production) then
  update public.natori_intake_operations set status='failed',claim_token=null,lease_expires_at=null,updated_at=clock_timestamp()
    where owner_id=p_owner_id and operation_id=p_operation_id;
  return query select 'failed'::text,null::jsonb,null::uuid,null::jsonb,array[]::uuid[]; return;
 end if;
 -- The content share lock can wait beyond the claim lease. Recheck immediately before writes.
 if op.status<>'processing' or op.claim_token<>p_claim_token or op.lease_expires_at<=clock_timestamp() then
  return query select 'busy'::text,null::jsonb,null::uuid,null::jsonb,array[]::uuid[]; return;
 end if;
 select * into strict r from public.natori_create_project_with_tasks_v2(p_owner_id,op.project_id,p_client_name,p_client_email,p_request_data,op.reference_paths,p_reference_links);
 -- The project/reference writer may wait on relation, unique-index or owner FK locks.
 -- An expired claim must roll back the entire transaction, including those writes.
 if op.lease_expires_at<=clock_timestamp() then
  raise exception 'intake_claim_expired' using errcode='40001';
 end if;
 select * into strict p from public.natori_projects where id=r.project_id and user_id=p_owner_id;
 -- Both notices persist together with request/project/reference records. Intake deliberately has zero tasks until type confirmation.
 with inserted as (
  insert into public.natori_notification_jobs(notification_key,project_id,purpose,snapshot)
   select 'intake/'||p_owner_id::text||'/'||p_operation_id::text||'/'||purpose,p.id,purpose,
    jsonb_build_object('title',p.title,'clientName',p.client_name,'clientEmail',p.client_email,'receipt',p_operation_id::text,'requestData',p_request_data,
     'referenceImageCount',jsonb_array_length(op.reference_paths),'referenceLinkUrls',coalesce((select jsonb_agg(value->>'url') from jsonb_array_elements(p_reference_links)),'[]'::jsonb))
   from unnest(array['intake_artist','intake_client']) purpose returning id
 ) select array_agg(id) into ids from inserted;
 -- Notification relation/unique-index waits must not turn an expired claim into acceptance.
 if op.lease_expires_at<=clock_timestamp() then
  raise exception 'intake_claim_expired' using errcode='40001';
 end if;
 receipt:=jsonb_build_object('ok',true,'success',true,'accepted',true,'receipt',p_operation_id::text,'notificationDelivery','pending');
 update public.natori_intake_operations set status='completed',claim_token=null,lease_expires_at=null,replay_result=receipt,notification_ids=ids,updated_at=clock_timestamp()
  where owner_id=p_owner_id and operation_id=p_operation_id;
 -- Last fence is after the completed receipt UPDATE and its triggers/constraints as well.
 -- Raising here also restores the original processing operation, so the client remains frozen.
 if op.lease_expires_at<=clock_timestamp() then
  raise exception 'intake_claim_expired' using errcode='40001';
 end if;
 return query select 'completed'::text,receipt,op.project_id,op.reference_paths,ids;
end; $$;

create function public.natori_intake_review_v1(p_owner_id uuid,p_operation_id uuid,p_request_hash text,p_claim_token uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.natori_intake_operations set status='needs_review',claim_token=null,lease_expires_at=null,updated_at=clock_timestamp()
  where owner_id=p_owner_id and operation_id=p_operation_id and request_hash=p_request_hash and status='processing' and claim_token=p_claim_token;
 return found;
end; $$;

-- Definitive precommit failure only. Unknown outcomes keep their object/operation evidence.
create function public.natori_intake_fail_v1(p_owner_id uuid,p_operation_id uuid,p_request_hash text,p_claim_token uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.natori_intake_operations o set status='failed',claim_token=null,lease_expires_at=null,updated_at=clock_timestamp()
  where o.owner_id=p_owner_id and o.operation_id=p_operation_id and o.request_hash=p_request_hash and o.status='processing' and o.claim_token=p_claim_token
   and not exists(select 1 from public.natori_projects p where p.id=o.project_id);
 return found;
end; $$;

create function public.natori_intake_cleanup_scope_v1(p_owner_id uuid,p_operation_id uuid,p_request_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare op public.natori_intake_operations%rowtype;
begin
 select * into op from public.natori_intake_operations o where o.owner_id=p_owner_id and o.operation_id=p_operation_id for update;
 if not found or op.request_hash<>p_request_hash or op.status<>'failed' or op.claim_token is not null
  or exists(select 1 from public.natori_projects p where p.id=op.project_id)
  or exists(select 1 from public.natori_inquiry_reference_files f where op.reference_paths ? f.storage_path) then return '[]'::jsonb; end if;
 return op.reference_paths;
end; $$;

revoke all on function public.natori_intake_immutable_v1(),public.natori_intake_admitted_v1(boolean) from public,anon,authenticated;
revoke all on function public.natori_intake_lookup_v1(uuid,uuid,text),public.natori_intake_settle_v1(uuid,uuid,text),public.natori_intake_begin_v1(uuid,uuid,text,jsonb,jsonb,uuid,boolean),
 public.natori_intake_touch_v1(uuid,uuid,text,uuid),public.natori_intake_finish_v1(uuid,uuid,text,uuid,text,text,jsonb,jsonb,boolean),
 public.natori_intake_fail_v1(uuid,uuid,text,uuid),public.natori_intake_review_v1(uuid,uuid,text,uuid),public.natori_intake_cleanup_scope_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.natori_intake_admitted_v1(boolean),public.natori_intake_lookup_v1(uuid,uuid,text),public.natori_intake_settle_v1(uuid,uuid,text),
 public.natori_intake_begin_v1(uuid,uuid,text,jsonb,jsonb,uuid,boolean),public.natori_intake_touch_v1(uuid,uuid,text,uuid),
 public.natori_intake_finish_v1(uuid,uuid,text,uuid,text,text,jsonb,jsonb,boolean),public.natori_intake_fail_v1(uuid,uuid,text,uuid),
 public.natori_intake_review_v1(uuid,uuid,text,uuid),public.natori_intake_cleanup_scope_v1(uuid,uuid,text) to service_role;
-- The shared validator helper was previously internal-only; the service-only begin function needs it.
grant execute on function public.natori_jsonb_has_exact_keys_v1(jsonb,text[]) to service_role;
commit;
