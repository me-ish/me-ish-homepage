-- Phase 3B expand/cutover. Preserve every existing message/access/file/path.
begin;
alter table public.natori_consultation_messages add column operation_id uuid, add column request_hash text,
 add column attachment_count integer check(attachment_count between 0 and 10), add column notification_id uuid references public.natori_notification_jobs(id);
create unique index natori_consultation_message_operation on public.natori_consultation_messages(project_id,sender,operation_id) where operation_id is not null;
alter table public.natori_consultation_uploads add column operation_id uuid, add column file_id uuid,
 add column content_sha256 text, add column message_id uuid references public.natori_consultation_messages(id),
 add column credential_issuer uuid, add column credential_started_at timestamptz, add column credential_expires_at timestamptz,
 add constraint natori_consultation_upload_issuer_check check((credential_issuer is null)=(credential_started_at is null));
create unique index natori_consultation_upload_operation on public.natori_consultation_uploads(project_id,sender,operation_id,file_id) where operation_id is not null;
create table public.natori_consultation_operations(
 project_id uuid not null references public.natori_projects(id),sender text not null check(sender in('staff','client')),
 operation_id uuid not null,request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 body text not null check(char_length(body)<=4000),manifest jsonb not null check(jsonb_typeof(manifest)='array' and jsonb_array_length(manifest)<=10),
 status text not null check(status in('reserved','verifying','committed','cancelled','cleanup','cleaned')),
 claim_token uuid,lease_expires_at timestamptz,signed_expires_at timestamptz,
 message_id uuid references public.natori_consultation_messages(id),notification_id uuid references public.natori_notification_jobs(id),
 notice_payload jsonb,access_hash text,access_expires_at timestamptz,created_at timestamptz not null default clock_timestamp(),
 primary key(project_id,sender,operation_id),check(status<>'committed' or(message_id is not null and notification_id is not null))
);
alter table public.natori_consultation_operations enable row level security;
revoke all on public.natori_consultation_operations from public,anon,authenticated,service_role;
grant select,insert,update on public.natori_consultation_operations to service_role;
-- Add purposes without assuming another phase's exact existing purpose set.
do $$declare definition text;begin
 select pg_get_constraintdef(oid) into strict definition from pg_constraint where conrelid='public.natori_notification_jobs'::regclass and conname='natori_notification_jobs_purpose_check';
 execute 'alter table public.natori_notification_jobs drop constraint natori_notification_jobs_purpose_check';
 execute 'alter table public.natori_notification_jobs add constraint natori_notification_jobs_purpose_check check ('||
 substring(definition from 8 for char_length(definition)-8)||' OR purpose IN (''consultation_staff'',''consultation_client''))';
end$$;

create function public.natori_consultation_operation_v1(
 p_project_id uuid,p_sender text,p_operation_id uuid,p_request_hash text,p_command text,
 p_owner_id uuid default null,p_access_hash text default null,p_input jsonb default '{}'::jsonb,p_claim_token uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype;o public.natori_consultation_operations%rowtype;f jsonb;
 t timestamptz;mid uuid;nid uuid;cnt integer;recent integer;path text;ext text;limit_bytes bigint;unread jsonb;
 upload_row public.natori_consultation_uploads%rowtype;credential_expiry timestamptz;
begin
 if p_sender not in('staff','client') or p_operation_id is null or p_request_hash!~'^[a-f0-9]{64}$' then return jsonb_build_object('result','invalid');end if;
 -- One project lock serializes reservation quota and finalize, while preserving production status.
 select * into p from public.natori_projects where id=p_project_id for update;
 t:=clock_timestamp();
 if not found or(p_sender='staff' and(p_owner_id is null or p.user_id is distinct from p_owner_id))
  or(p_sender='client' and not exists(select 1 from public.natori_consultation_access where project_id=p.id and token_hash=p_access_hash and expires_at>t))
 then return jsonb_build_object('result','not_found');end if;
 select * into o from public.natori_consultation_operations where project_id=p.id and sender=p_sender and operation_id=p_operation_id for update;
 t:=clock_timestamp();
 if p_sender='client' and not exists(select 1 from public.natori_consultation_access where project_id=p.id and token_hash=p_access_hash and expires_at>t) then return jsonb_build_object('result','not_found');end if;
 if o.operation_id is not null and o.request_hash<>p_request_hash then return jsonb_build_object('result','conflict');end if;
 -- Complete only this private issuer. A cancelled sender still records the actual
 -- expiry, but never receives the credential. Unknown issuer state blocks cleanup.
 if p_command='credential_finish' then
  if o.operation_id is null or p_claim_token is null then return jsonb_build_object('result','stale');end if;
  select * into upload_row from public.natori_consultation_uploads where project_id=p.id and sender=p_sender
   and operation_id=p_operation_id and file_id=(p_input->>'fileId')::uuid for update;
  t:=clock_timestamp();
  if not found or upload_row.credential_issuer is distinct from p_claim_token then return jsonb_build_object('result','stale');end if;
  if p_sender='client' and not exists(select 1 from public.natori_consultation_access where project_id=p.id and token_hash=p_access_hash and expires_at>t) then return jsonb_build_object('result','not_found');end if;
  credential_expiry:=(p_input->>'expiresAt')::timestamptz;
  if credential_expiry is null or not isfinite(credential_expiry) or credential_expiry<=upload_row.credential_started_at then return jsonb_build_object('result','invalid');end if;
  -- Preserve every previously issued credential's lifetime; clear only matching issuer.
  update public.natori_consultation_uploads set credential_expires_at=greatest(credential_expires_at,credential_expiry),credential_issuer=null,credential_started_at=null where id=upload_row.id;
  update public.natori_consultation_operations set signed_expires_at=greatest(signed_expires_at,credential_expiry+interval '5 minutes') where project_id=p.id and sender=p_sender and operation_id=p_operation_id;
  return jsonb_build_object('result','credential_registered','fileId',upload_row.file_id,'issuer',p_claim_token,
   'expose',o.status='reserved' and credential_expiry>t and p.deleted_at is null and p.status<>'closed');
 end if;
 if o.operation_id is not null and o.status='committed' then return jsonb_build_object('result','committed','messageId',o.message_id,'notificationId',o.notification_id,'operationId',p_operation_id,'requestHash',p_request_hash);end if;
 if p_command='lookup' then
  return jsonb_build_object('result',coalesce(o.status,'not_found'));
 end if;
 if p_command='cancel' then
  if o.status='verifying' and o.lease_expires_at>t then return jsonb_build_object('result','busy');end if;
  -- A tombstone also fences a delayed reserve when no row has arrived yet.
  insert into public.natori_consultation_operations(project_id,sender,operation_id,request_hash,body,manifest,status)
   values(p.id,p_sender,p_operation_id,p_request_hash,'','[]','cancelled')
   on conflict(project_id,sender,operation_id) do update set status='cancelled',claim_token=null,lease_expires_at=null;
  return jsonb_build_object('result','cancelled');
 end if;
 -- Expiry only fences new requests, not already-admitted provider completion.
 -- A saved credential expiry is also a durable ever-issued marker; never auto-clear it.
 if p_command='cleanup_scope' then
  if o.operation_id is null or o.status not in('cancelled','cleanup') or o.lease_expires_at>t or o.signed_expires_at>t or o.message_id is not null
   or exists(select 1 from public.natori_consultation_messages where project_id=p.id and sender=p_sender and operation_id=p_operation_id)
   or exists(select 1 from public.natori_consultation_files cf join public.natori_consultation_uploads u on u.storage_path=cf.storage_path where u.project_id=p.id and u.sender=p_sender and u.operation_id=p_operation_id)
   or exists(select 1 from public.natori_consultation_uploads where project_id=p.id and sender=p_sender and operation_id=p_operation_id and (finalized_at is not null or credential_issuer is not null or credential_expires_at is not null))
  then return jsonb_build_object('result','protected');end if;
  update public.natori_consultation_operations set status='cleanup',claim_token=null,lease_expires_at=null where project_id=p.id and sender=p_sender and operation_id=p_operation_id;
  select coalesce(jsonb_agg(storage_path),'[]') into unread from public.natori_consultation_uploads where project_id=p.id and sender=p_sender and operation_id=p_operation_id and finalized_at is null and message_id is null;
  return jsonb_build_object('result','cleanup','paths',unread);
 end if;
 if p_command='cleanup_done' then
  if o.status<>'cleanup' or exists(select 1 from public.natori_consultation_uploads where project_id=p.id and sender=p_sender and operation_id=p_operation_id and (finalized_at is not null or message_id is not null or credential_issuer is not null or credential_expires_at is not null)) then return jsonb_build_object('result','protected');end if;
  select coalesce(jsonb_agg(storage_path order by storage_path),'[]') into unread from public.natori_consultation_uploads where project_id=p.id and sender=p_sender and operation_id=p_operation_id;
  if unread is distinct from(select coalesce(jsonb_agg(value order by value),'[]') from jsonb_array_elements_text(p_input->'paths')) then return jsonb_build_object('result','protected');end if;
  update public.natori_consultation_operations set status='cleaned' where project_id=p.id and sender=p_sender and operation_id=p_operation_id;
  return jsonb_build_object('result','cleaned');
 end if;
 if o.status in('cancelled','cleanup','cleaned') then return jsonb_build_object('result','cancelled');end if;
 if p.deleted_at is not null or p.status='closed' then return jsonb_build_object('result','not_found');end if;
 if p_command='credential_begin' then
  if o.status is distinct from 'reserved' or p_claim_token is null then return jsonb_build_object('result','busy');end if;
  select * into upload_row from public.natori_consultation_uploads where project_id=p.id and sender=p_sender
   and operation_id=p_operation_id and file_id=(p_input->>'fileId')::uuid for update;
  t:=clock_timestamp();
  if not found or upload_row.finalized_at is not null or upload_row.message_id is not null then return jsonb_build_object('result','invalid');end if;
  if p_sender='client' and not exists(select 1 from public.natori_consultation_access where project_id=p.id and token_hash=p_access_hash and expires_at>t) then return jsonb_build_object('result','not_found');end if;
  if upload_row.credential_issuer is not null then return jsonb_build_object('result','busy');end if;
  update public.natori_consultation_uploads set credential_issuer=p_claim_token,credential_started_at=t where id=upload_row.id;
  return jsonb_build_object('result','credential_started','fileId',upload_row.file_id,'issuer',p_claim_token);
 end if;
 if p_command='reserve' then
  if o.status='verifying' and o.lease_expires_at>t then return jsonb_build_object('result','busy');end if;
  if o.operation_id is null then
   if jsonb_typeof(p_input->'files')<>'array' or jsonb_array_length(p_input->'files')>10 or char_length(p_input->>'body')>4000
    or(char_length(trim(p_input->>'body'))=0 and jsonb_array_length(p_input->'files')=0)
   then return jsonb_build_object('result','invalid');end if;
   select count(*) into cnt from public.natori_consultation_files where project_id=p.id;
   select count(*) into recent from public.natori_consultation_uploads where project_id=p.id and created_at>=t-interval '1 hour';
   if recent+jsonb_array_length(p_input->'files')>10 or cnt+(select count(*) from public.natori_consultation_uploads where project_id=p.id and finalized_at is null and (operation_id is null or exists(select 1 from public.natori_consultation_operations co where co.project_id=p.id and co.sender=public.natori_consultation_uploads.sender and co.operation_id=public.natori_consultation_uploads.operation_id and co.status<>'cleaned')))+jsonb_array_length(p_input->'files')>60
   then return jsonb_build_object('result','too_many');end if;
   if jsonb_array_length(p_input->'files')<>(select count(distinct x->>'id') from jsonb_array_elements(p_input->'files') x) then return jsonb_build_object('result','invalid');end if;
   for f in select value from jsonb_array_elements(p_input->'files') loop
    ext:=lower(substring(f->>'fileName' from '\.([a-zA-Z0-9]+)$'));
    limit_bytes:=case when ext in('mp3','m4a','wav') then 52428800 else 10485760 end;
    if char_length(f->>'fileName') not between 1 and 200 or f->>'sha256'!~'^[a-f0-9]{64}$'
     or(f->>'sizeBytes')::bigint not between 1 and limit_bytes
     or not((ext in('jpg','jpeg') and f->>'mimeType'='image/jpeg') or(ext='png' and f->>'mimeType'='image/png') or(ext='webp' and f->>'mimeType'='image/webp') or(ext='pdf' and f->>'mimeType'='application/pdf') or(ext='mp3' and f->>'mimeType'='audio/mpeg') or(ext='m4a' and f->>'mimeType' in('audio/mp4','audio/x-m4a')) or(ext='wav' and f->>'mimeType' in('audio/wav','audio/x-wav')))
    then return jsonb_build_object('result','invalid');end if;
    perform(f->>'id')::uuid;
   end loop;
   insert into public.natori_consultation_operations(project_id,sender,operation_id,request_hash,body,manifest,status,notice_payload,access_hash,access_expires_at)
    values(p.id,p_sender,p_operation_id,p_request_hash,trim(p_input->>'body'),p_input->'files','reserved',p_input->'noticePayload',p_input->>'noticeAccessHash',(p_input->>'noticeExpiresAt')::timestamptz);
   for f in select value from jsonb_array_elements(p_input->'files') loop
    -- Reserved exact path is stable for this operation; no Storage upsert.
    path:=p.id::text||'/'||md5(p_operation_id::text||'/'||(f->>'id')||'/'||(f->>'sha256'))::uuid::text||'.'||lower(substring(f->>'fileName' from '\.([a-zA-Z0-9]+)$'));
    insert into public.natori_consultation_uploads(project_id,sender,storage_path,file_name,mime_type,size_bytes,operation_id,file_id,content_sha256)
     values(p.id,p_sender,path,f->>'fileName',f->>'mimeType',(f->>'sizeBytes')::bigint,p_operation_id,(f->>'id')::uuid,f->>'sha256');
   end loop;
  end if;
  -- Reservation is separate from the actual credential expiry. Keep prior deadlines monotonic.
  update public.natori_consultation_operations set status='reserved',lease_expires_at=t+interval '130 minutes',signed_expires_at=greatest(signed_expires_at,t+interval '125 minutes'),claim_token=null where project_id=p.id and sender=p_sender and operation_id=p_operation_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',file_id,'path',storage_path)),'[]') into unread from public.natori_consultation_uploads where project_id=p.id and sender=p_sender and operation_id=p_operation_id;
  return jsonb_build_object('result','reserved','files',unread);
 end if;
 if o.operation_id is null then return jsonb_build_object('result','not_found');end if;
 if p_command='claim' then
  if exists(select 1 from public.natori_consultation_uploads where project_id=p.id and sender=p_sender and operation_id=p_operation_id and credential_issuer is not null) then return jsonb_build_object('result','busy');end if;
  if p_claim_token is null or(o.status='verifying' and o.lease_expires_at>t) then return jsonb_build_object('result','busy');end if;
  update public.natori_consultation_operations set status='verifying',claim_token=p_claim_token,lease_expires_at=t+interval '3 minutes' where project_id=p.id and sender=p_sender and operation_id=p_operation_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',file_id,'path',storage_path,'fileName',file_name,'mimeType',mime_type,'sizeBytes',size_bytes,'sha256',content_sha256)),'[]') into unread from public.natori_consultation_uploads where project_id=p.id and sender=p_sender and operation_id=p_operation_id;
  return jsonb_build_object('result','claimed','files',unread);
 end if;
 if o.status<>'verifying' or o.claim_token is distinct from p_claim_token or o.lease_expires_at<=t then return jsonb_build_object('result','stale');end if;
 if p_command='renew' then
  update public.natori_consultation_operations set lease_expires_at=t+interval '3 minutes' where project_id=p.id and sender=p_sender and operation_id=p_operation_id;
  return jsonb_build_object('result','renewed');
 end if;
 if p_command='release' then
  update public.natori_consultation_operations set status='reserved',claim_token=null,lease_expires_at=greatest(t,signed_expires_at) where project_id=p.id and sender=p_sender and operation_id=p_operation_id;
  return jsonb_build_object('result','reserved');
 end if;
 if p_command<>'commit' or p_input->>'verified'<>'true' or o.notice_payload is null then return jsonb_build_object('result','invalid');end if;
 -- Acquire all target relation locks before refreshing the commit fence.
 lock table public.natori_consultation_messages,public.natori_consultation_files,public.natori_consultation_access,public.natori_notification_jobs in row exclusive mode;
 -- Lock dependent reservations before refreshing the commit fence.
 perform 1 from public.natori_consultation_uploads where project_id=p.id and sender=p_sender and operation_id=p_operation_id for update;
 t:=clock_timestamp();
 if o.lease_expires_at<=t then return jsonb_build_object('result','stale');end if;
 if p_sender='client' and not exists(select 1 from public.natori_consultation_access where project_id=p.id and token_hash=p_access_hash and expires_at>t) then return jsonb_build_object('result','not_found');end if;
 if exists(select 1 from public.natori_consultation_uploads where project_id=p.id and sender=p_sender and operation_id=p_operation_id and(finalized_at is not null or message_id is not null)) then return jsonb_build_object('result','conflict');end if;
 insert into public.natori_consultation_messages(project_id,sender,body,operation_id,request_hash,attachment_count)
  values(p.id,p_sender,coalesce(nullif(o.body,''),'ファイルを共有しました'),p_operation_id,p_request_hash,jsonb_array_length(o.manifest)) returning id into mid;
 insert into public.natori_consultation_files(project_id,message_id,storage_path,file_name,mime_type,size_bytes)
  select project_id,mid,storage_path,file_name,mime_type,size_bytes from public.natori_consultation_uploads where project_id=p.id and sender=p_sender and operation_id=p_operation_id;
 update public.natori_consultation_uploads set finalized_at=t,message_id=mid where project_id=p.id and sender=p_sender and operation_id=p_operation_id;
 if o.access_hash is not null then insert into public.natori_consultation_access(project_id,token_hash,expires_at) values(p.id,o.access_hash,o.access_expires_at);end if;
 insert into public.natori_notification_jobs(notification_key,project_id,purpose,snapshot,payload)
  values('consultation/'||p.id||'/'||p_sender||'/'||p_operation_id,p.id,case when p_sender='staff' then 'consultation_client' else 'consultation_staff' end,jsonb_build_object('messageId',mid,'operationId',p_operation_id),o.notice_payload) returning id into nid;
 -- Finish business/FK/trigger updates before the final fresh fence.
 update public.natori_consultation_messages set notification_id=nid where id=mid;
 update public.natori_consultation_operations set status='committed',message_id=mid,notification_id=nid where project_id=p.id and sender=p_sender and operation_id=p_operation_id;
 t:=clock_timestamp();
 if o.lease_expires_at<=t or(p_sender='client' and not exists(select 1 from public.natori_consultation_access where project_id=p.id and token_hash=p_access_hash and expires_at>t)) then raise exception 'consultation_finalize_fence_expired' using errcode='40001';end if;
 -- This final update touches an already-owned row and no FK identity or business field.
 update public.natori_consultation_operations set claim_token=null,lease_expires_at=null where project_id=p.id and sender=p_sender and operation_id=p_operation_id and claim_token=p_claim_token;
 return jsonb_build_object('result','committed','messageId',mid,'notificationId',nid,'operationId',p_operation_id,'requestHash',p_request_hash);
end$$;
revoke all on function public.natori_consultation_operation_v1(uuid,text,uuid,text,text,uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.natori_consultation_operation_v1(uuid,text,uuid,text,text,uuid,text,jsonb,uuid) to service_role;

create or replace function public.natori_finalize_consultation_file(p_project_id uuid,p_sender text,p_storage_path text,p_file_name text,p_mime_type text,p_size_bytes bigint)
returns uuid language plpgsql security invoker set search_path='' as $$
declare mid uuid;begin
 select cf.message_id into mid from public.natori_consultation_files cf join public.natori_consultation_messages m on m.id=cf.message_id where cf.project_id=p_project_id and m.sender=p_sender and cf.storage_path=p_storage_path and cf.file_name=p_file_name and cf.mime_type=p_mime_type and cf.size_bytes=p_size_bytes;
 if mid is not null then return mid;end if;
 raise exception 'consultation_client_update_required' using errcode='23514';
end$$;
create function public.natori_consultation_notice_projection_v1() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.purpose in('consultation_staff','consultation_client') and new.status in('sent','failed') then
  update public.natori_consultation_messages set notification_status=new.status where id=(new.snapshot->>'messageId')::uuid and project_id=new.project_id
   and not exists(select 1 from public.natori_notification_jobs j where j.notification_key=new.notification_key and j.attempt_no>new.attempt_no);
 end if;return new;
end$$;
create trigger natori_consultation_notice_projection after update on public.natori_notification_jobs for each row execute function public.natori_consultation_notice_projection_v1();
create function public.natori_consultation_legacy_notice_v1(p_owner_id uuid,p_project_id uuid,p_message_id uuid,p_payload jsonb,p_access_hash text,p_expires_at timestamptz)
returns uuid language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype;m public.natori_consultation_messages%rowtype;nid uuid;begin
 select * into p from public.natori_projects where id=p_project_id and user_id=p_owner_id and deleted_at is null and status<>'closed' for update;
 if not found then return null;end if;
 select * into m from public.natori_consultation_messages where id=p_message_id and project_id=p.id and sender='staff' for update;
 if not found then return null;end if;
 if m.notification_id is not null then return m.notification_id;end if;
 if p_access_hash!~'^[a-f0-9]{64}$' or p_expires_at<=clock_timestamp() or p_payload is null then return null;end if;
 insert into public.natori_consultation_access(project_id,token_hash,expires_at) values(p.id,p_access_hash,p_expires_at);
 insert into public.natori_notification_jobs(notification_key,project_id,purpose,snapshot,payload) values('consultation-legacy/'||m.id,p.id,'consultation_client',jsonb_build_object('messageId',m.id),p_payload) returning id into nid;
 update public.natori_consultation_messages set notification_id=nid,notification_status='pending' where id=m.id;
 return nid;
end$$;
revoke all on function public.natori_consultation_legacy_notice_v1(uuid,uuid,uuid,jsonb,text,timestamptz) from public,anon,authenticated;
grant execute on function public.natori_consultation_legacy_notice_v1(uuid,uuid,uuid,jsonb,text,timestamptz) to service_role;
-- Phase3B compatibility only: a linked message mirrors its outbox state.
-- Count that notice from its latest job, retaining every unlinked legacy message
-- and all existing PhaseN/4 job purposes. Preserve the rest of the installed view.
do $notice_count_compat$
declare
 function_sql text;
 legacy_clause constant text := $legacy_clause$from public.natori_consultation_messages m where m.project_id=p.id
  ) legacy$legacy_clause$;
begin
 function_sql := pg_catalog.pg_get_functiondef('public.natori_consultation_overview_v1(uuid,uuid[])'::regprocedure);
 if (pg_catalog.length(function_sql)-pg_catalog.length(pg_catalog.replace(function_sql,legacy_clause,'')))
    / pg_catalog.length(legacy_clause) <> 1 then
  raise exception 'consultation_overview_legacy_clause_drift' using errcode='23514';
 end if;
 execute pg_catalog.replace(function_sql,legacy_clause,
  $linked_clause$from public.natori_consultation_messages m where m.project_id=p.id and m.notification_id is null
  ) legacy$linked_clause$);
end
$notice_count_compat$;
commit;
