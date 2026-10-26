-- R2 additive owner-only work records. No inferred backfill or lifecycle corrections.
begin;
-- Durable fence survives encrypted notification-body erasure; no existing row is backfilled.
alter table public.natori_notification_jobs add column case_work_guard text;
create table public.natori_case_work_records (
 id uuid primary key, project_id uuid not null references public.natori_projects(id),
 owner_id uuid not null references auth.users(id),
 kind text not null check(kind in ('origin','revision_open','revision_handled','manual_agreement','manual_delivery','manual_receipt','manual_completion')),
 data jsonb not null, request_hash text not null, operator jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.natori_case_work_records enable row level security;
revoke all on public.natori_case_work_records from public,anon,authenticated,service_role;
grant select,insert on public.natori_case_work_records to service_role;
create index natori_case_work_project on public.natori_case_work_records(project_id,created_at,id);
create trigger natori_case_work_immutable before update or delete on public.natori_case_work_records
 for each row execute function public.natori_case_reconciliation_immutable_v1();

create function public.natori_case_work_outbound_blocked_v1(p_project uuid) returns boolean
language sql volatile security invoker set search_path='' as $$
 select public.natori_case_outbound_blocked_v1(p_project) or exists(select 1 from public.natori_notification_jobs
 where project_id=p_project and purpose='delivery_issue_client' and status in ('pending','sending','unknown'))
$$;
create function public.natori_case_rough_reference_guard_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.natori_projects where id=old.project_id for update;
 if exists(select 1 from public.natori_case_work_records where project_id=old.project_id and
  (data->>'roughId'=old.id::text or data->>'nextRoughId'=old.id::text)) then raise exception 'rough_work_record_protected'; end if;
 return old;
end $$;
create trigger natori_case_rough_reference_guard before delete on public.natori_talk_roughs
 for each row execute function public.natori_case_rough_reference_guard_v1();
revoke all on function public.natori_case_rough_reference_guard_v1() from public,anon,authenticated;

create function public.natori_case_work_metadata_v1(p_project uuid) returns text
language sql stable security invoker set search_path='' as $$
 select encode(sha256(convert_to(octet_length(p.title)::text||':'||p.title||octet_length(p.client_name)::text||':'||p.client_name||octet_length(coalesce(p.client_email,''))::text||':'||coalesce(p.client_email,''),'UTF8')),'hex') from public.natori_projects p where p.id=p_project
$$;
revoke all on function public.natori_case_work_metadata_v1(uuid) from public,anon,authenticated;
grant execute on function public.natori_case_work_metadata_v1(uuid) to service_role;

create function public.natori_case_consultation_operation_v1(p_project_id uuid,p_sender text,p_operation_id uuid,p_request_hash text,p_command text,
 p_owner_id uuid,p_access_hash text,p_input jsonb,p_claim_token uuid,p_workspace_guard jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype;o public.natori_consultation_operations%rowtype;
begin
 select * into p from public.natori_projects where id=p_project_id and user_id=p_owner_id for update;
 if not found or p_sender<>'staff' then return jsonb_build_object('result','not_found');end if;
 select * into o from public.natori_consultation_operations where project_id=p.id and sender='staff' and operation_id=p_operation_id;
 if p_command not in ('lookup','cancel') and o.status is distinct from 'committed' then
  if p_workspace_guard->>'email' is null or p_workspace_guard is distinct from jsonb_build_object('title',p.title,'clientName',p.client_name,'email',p.client_email)
   or public.natori_case_outbound_blocked_v1(p.id)
   or (o.operation_id is not null and o.notice_payload->>'caseWorkGuard' is distinct from public.natori_case_work_metadata_v1(p.id))
   then return jsonb_build_object('result','conflict');end if;
  if p_command='reserve' and p_input->'noticePayload' is not null then p_input:=jsonb_set(p_input,'{noticePayload}',(p_input->'noticePayload')||jsonb_build_object('caseWorkGuard',public.natori_case_work_metadata_v1(p.id)));end if;
 end if;
 return public.natori_consultation_operation_v1(p_project_id,p_sender,p_operation_id,p_request_hash,p_command,p_owner_id,p_access_hash,p_input,p_claim_token);
end $$;

-- Every sender (including existing retry/Cron paths) respects the frozen R2 context.
create function public.natori_case_work_notice_guard_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype;
begin
 if tg_op='INSERT' then new.case_work_guard:=new.payload->>'caseWorkGuard';return new;end if;
 if old.case_work_guard is not null and new.case_work_guard is distinct from old.case_work_guard then raise exception 'case_work_notice_guard_immutable';end if;
 if new.case_work_guard is not null and
  (new.status='sending' or new.send_started_at is distinct from old.send_started_at) then
  select * into p from public.natori_projects where id=new.project_id for update;
  if old.status='unknown' or (old.status='sending' and old.send_started_at is not null and coalesce(old.lease_expires_at,'-infinity')<=clock_timestamp()
    and new.claim_token is distinct from old.claim_token)
   or new.case_work_guard is distinct from public.natori_case_work_metadata_v1(p.id)
   or public.natori_case_outbound_blocked_v1(p.id,null,new.id)
   or p.deleted_at is not null or p.status='closed' then raise exception 'case_work_notice_requires_review';end if;
 end if;
 return new;
end $$;
create trigger natori_case_work_notice_guard before insert or update on public.natori_notification_jobs
 for each row execute function public.natori_case_work_notice_guard_v1();
create function public.natori_case_work_consultation_guard_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype;
begin
 if new.notice_payload->'caseWorkGuard' is not null and new.status='committed' and old.status<>'committed' then
  select * into p from public.natori_projects where id=new.project_id for update;
  if new.notice_payload->>'caseWorkGuard' is distinct from public.natori_case_work_metadata_v1(p.id)
   or public.natori_case_outbound_blocked_v1(p.id) then raise exception 'case_work_consultation_stale';end if;
 end if;
 return new;
end $$;
create trigger natori_case_work_consultation_guard before update on public.natori_consultation_operations
 for each row execute function public.natori_case_work_consultation_guard_v1();
revoke all on function public.natori_case_work_notice_guard_v1(),public.natori_case_work_consultation_guard_v1() from public,anon,authenticated;
revoke all on function public.natori_case_consultation_operation_v1(uuid,text,uuid,text,text,uuid,text,jsonb,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.natori_case_consultation_operation_v1(uuid,text,uuid,text,text,uuid,text,jsonb,uuid,jsonb) to service_role;

create function public.natori_case_work_revision_v1(p_project uuid) returns text
language sql stable security invoker set search_path='' as $$
 select encode(sha256(convert_to(jsonb_build_array(public.natori_case_reconciliation_revision_v1(p_project),
 (select jsonb_agg(to_jsonb(w) order by w.id) from public.natori_case_work_records w where w.project_id=p_project),
 (select jsonb_agg(to_jsonb(t) order by t.id) from public.natori_project_tasks t where t.project_id=p_project),
 (select jsonb_agg(to_jsonb(r) order by r.id) from public.natori_talk_roughs r where r.project_id=p_project),
 (select jsonb_agg(to_jsonb(m) order by m.id) from public.natori_consultation_messages m where m.project_id=p_project),
 (select jsonb_agg(to_jsonb(f) order by f.id) from public.natori_delivery_files f where f.project_id=p_project),
 (select jsonb_agg(to_jsonb(r) order by r.id) from public.natori_delivery_releases r where r.project_id=p_project),
 (select jsonb_agg(to_jsonb(x) order by x.id) from public.natori_delivery_extensions x where x.project_id=p_project)
 )::text,'UTF8')),'hex')
$$;

create function public.natori_case_work_read_v1(p_owner uuid,p_project uuid,p_operation uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('project',public.natori_task_projection_v1(p),'revision',public.natori_case_work_revision_v1(p.id),
 'complete',(select count(*)<=200 from public.natori_case_work_records w where w.project_id=p.id),
 'records',coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at,w.id) from
  (select id,kind,data,operator,created_at from public.natori_case_work_records where project_id=p.id order by created_at,id limit 201) w),'[]'::jsonb),
 'files',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'fileName',f.file_name,'sizeBytes',f.size_bytes,
  'version',f.storage_version,'verifiedAt',f.verified_at,'state',f.state) order by f.id) from public.natori_delivery_files f where f.project_id=p.id and f.folder='final' and f.deleted_at is null),'[]'::jsonb),
 'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at,m.id) from
  (select m.id,m.sender,left(m.body,200) as body,m.created_at,r.id as rough_id,r.client_ok_at
   from public.natori_consultation_messages m left join public.natori_talk_roughs r on r.message_id=m.id and r.project_id=m.project_id
   where m.project_id=p.id order by m.created_at desc,m.id desc limit 200) m),'[]'::jsonb),
 'release',(select jsonb_build_object('id',r.id,'expiresAt',coalesce((select max(x.new_expires_at) from public.natori_delivery_extensions x where x.release_id=r.id),r.expires_at),
   'acceptedAt',r.accepted_at,'publishedAt',r.published_at) from public.natori_delivery_releases r where r.project_id=p.id),
 'operation',(select jsonb_build_object('id',o.operation_id,'releaseId',o.release_id,'notificationId',o.notification_id,'status',j.status)
  from public.natori_delivery_operations o join public.natori_notification_jobs j on j.id=o.notification_id and j.project_id=o.project_id
  where o.project_id=p.id and o.operation_id=p_operation),
 'outboundBlocked',public.natori_case_work_outbound_blocked_v1(p.id))
 from public.natori_projects p where p.id=p_project and p.user_id=p_owner
$$;

create function public.natori_case_work_command_v1(p_owner uuid,p_project uuid,p_command text,p_input jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; prior public.natori_case_work_records%rowtype; outcome text;
 v_id uuid; v_kind text; d jsonb; h text; v_target uuid; v_rough uuid;
begin
 select * into p from public.natori_projects where id=p_project and user_id=p_owner for update;
 if not found then return jsonb_build_object('result','not_found'); end if;
 if p_command='record' then
  v_id:=(p_input->>'id')::uuid; v_kind:=p_input->>'kind'; d:=p_input->'data';
  h:=encode(sha256(convert_to(jsonb_build_array(v_kind,d,p_input->'operator')::text,'UTF8')),'hex');
  select * into prior from public.natori_case_work_records where id=v_id;
  if found then return jsonb_build_object('result',case when prior.project_id=p.id and prior.owner_id=p_owner and prior.request_hash=h then 'applied' else 'conflict' end); end if;
 end if;
 if p_input->>'revision' is distinct from public.natori_case_work_revision_v1(p.id) then return jsonb_build_object('result','stale'); end if;
 if p.deleted_at is not null or p.status='closed' then return jsonb_build_object('result','inactive'); end if;
 if p_command='task' then
  return public.natori_update_task_v1(p_owner,p.id,p_input->>'taskKey',(p_input->>'done')::boolean);
 elsif p_command='confirm_type' then
  select result into outcome from public.natori_confirm_project_type_v1(p_owner,p.id,p_input->>'projectType');
  return jsonb_build_object('result',case when outcome in ('confirmed','already_confirmed') then 'applied' else outcome end);
 elsif p_command='metadata' then
  d:=p_input->'data';
  if jsonb_typeof(d)<>'object' or exists(select 1 from jsonb_object_keys(d) k where k not in ('note','dueDate','startDate'))
   or length(coalesce(d->>'note',''))>10000 then return jsonb_build_object('result','invalid'); end if;
  update public.natori_projects set note=d->>'note',due_date=(d->>'dueDate')::date,start_date=(d->>'startDate')::date where id=p.id;
  return jsonb_build_object('result','applied');
 elsif p_command<>'record' then return jsonb_build_object('result','invalid'); end if;
 if v_id is null or jsonb_typeof(d)<>'object' or length(d::text)>5000
  or coalesce(p_input->'operator'->>'kind','') not in ('auth-user','shared-key')
  or length(trim(coalesce(d->>'note','')))=0 or length(d->>'note')>2000 then return jsonb_build_object('result','invalid'); end if;
 if v_kind='origin' then
  if d->>'origin' is null or d->>'origin' not in ('internal','external','manual','historical','unknown')
   or exists(select 1 from public.natori_case_work_records where project_id=p.id and kind='origin')
   or (d->>'origin'<>'internal' and exists(select 1 from public.natori_intake_operations where project_id=p.id and status='completed')) then
   return jsonb_build_object('result','conflict'); end if;
 elsif v_kind='revision_open' then
  v_target:=(d->>'messageId')::uuid; v_rough:=(d->>'roughId')::uuid;
  if not exists(select 1 from public.natori_consultation_messages where id=v_target and project_id=p.id and sender='client')
   or not exists(select 1 from public.natori_talk_roughs where id=v_rough and project_id=p.id)
   or exists(select 1 from public.natori_case_work_records w where w.project_id=p.id and w.kind='revision_open'
    and w.data->>'messageId'=v_target::text and w.data->>'roughId'=v_rough::text) then return jsonb_build_object('result','conflict'); end if;
 elsif v_kind='revision_handled' then
  v_target:=(d->>'requestId')::uuid;
  select * into prior from public.natori_case_work_records where id=v_target and project_id=p.id and kind='revision_open';
  if not found or exists(select 1 from public.natori_case_work_records where project_id=p.id and kind='revision_handled' and data->>'requestId'=v_target::text)
   or not exists(select 1 from public.natori_consultation_messages where id=(d->>'responseMessageId')::uuid and project_id=p.id and sender='staff' and created_at>=prior.created_at)
   then return jsonb_build_object('result','conflict'); end if;
  if d->>'nextRoughId' is not null and (not exists(select 1 from public.natori_talk_roughs r join public.natori_consultation_messages m on m.id=r.message_id and m.project_id=r.project_id
   where r.id=(d->>'nextRoughId')::uuid and r.project_id=p.id and m.sender='staff' and r.id::text<>prior.data->>'roughId' and r.created_at>=prior.created_at)
   or exists(select 1 from public.natori_case_work_records w join public.natori_case_work_records o on o.id::text=w.data->>'requestId'
     where w.project_id=p.id and w.kind='revision_handled' and w.data->>'nextRoughId' is not null and o.data->>'roughId'=prior.data->>'roughId')) then
   return jsonb_build_object('result','conflict'); end if;
 elsif v_kind in ('manual_agreement','manual_delivery','manual_receipt','manual_completion') then
  if length(trim(coalesce(d->>'target','')))=0 or length(d->>'target')>500 or (d->>'occurredAt')::timestamptz>clock_timestamp()
   or d->>'occurredAt' is null then return jsonb_build_object('result','invalid'); end if;
 else return jsonb_build_object('result','invalid'); end if;
 insert into public.natori_case_work_records(id,owner_id,project_id,kind,data,request_hash,operator)
  values(v_id,p_owner,p.id,v_kind,d,h,p_input->'operator');
 return jsonb_build_object('result','applied');
end $$;

-- Final publication shares the existing engine's project lock and immutable manifest.
-- Revision/unknown fence is checked in the same transaction as publication.
create function public.natori_case_delivery_v1(p_owner uuid,p_project uuid,p_revision text,p_extension jsonb,
 p_operation_id uuid,p_to_email text,p_request_hash text,p_manifest jsonb,p_verified_at timestamptz,
 p_token_hash text,p_expires_at timestamptz,p_payload jsonb)
returns table(result text,release_id uuid,notification_id uuid)
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.natori_projects where id=p_project and user_id=p_owner for update;
 if not found then return query select 'not-found',null::uuid,null::uuid; return; end if;
 if exists(select 1 from public.natori_delivery_operations where project_id=p_project and operation_id=p_operation_id) then
  return query select case when o.request_hash=p_request_hash then 'recorded' else 'conflict' end,o.release_id,o.notification_id
   from public.natori_delivery_operations o where o.project_id=p_project and o.operation_id=p_operation_id;return;
 else
  if public.natori_case_work_outbound_blocked_v1(p_project) then return query select 'notice-pending',null::uuid,null::uuid; return; end if;
  if p_revision is distinct from public.natori_case_work_revision_v1(p_project) then return query select 'conflict',null::uuid,null::uuid; return; end if;
 end if;
 if p_extension is null then
  return query select * from public.natori_delivery_issue_v1(p_owner,p_project,p_operation_id,p_to_email,p_request_hash,p_manifest,p_verified_at,p_token_hash,p_expires_at,p_payload);
 else
  if exists(select 1 from public.natori_delivery_releases r where r.project_id=p_project and
   greatest(r.expires_at,coalesce((select max(x.new_expires_at) from public.natori_delivery_extensions x where x.release_id=r.id),r.expires_at))>clock_timestamp()) then
   return query select 'invalid-expiry',null::uuid,null::uuid;return;end if;
  return query select * from public.natori_delivery_extend_v1(p_owner,p_project,p_operation_id,p_request_hash,p_expires_at,p_extension->>'reason',p_token_hash,p_manifest,p_verified_at,p_payload);
 end if;
end $$;
revoke all on function public.natori_case_work_outbound_blocked_v1(uuid),public.natori_case_work_revision_v1(uuid),public.natori_case_work_read_v1(uuid,uuid,uuid),public.natori_case_work_command_v1(uuid,uuid,text,jsonb),public.natori_case_delivery_v1(uuid,uuid,text,jsonb,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.natori_case_work_outbound_blocked_v1(uuid),public.natori_case_work_revision_v1(uuid),public.natori_case_work_read_v1(uuid,uuid,uuid),public.natori_case_work_command_v1(uuid,uuid,text,jsonb),public.natori_case_delivery_v1(uuid,uuid,text,jsonb,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb) to service_role;
commit;
