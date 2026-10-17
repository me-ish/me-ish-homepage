-- Q01: ordinary resend uses the effective extension expiry, without changing issued evidence.
-- Apply only after PAY-01 and PAY-04. Unexpected source/runtime drift requires review.
begin;

do $$ begin
  if to_regclass('public.natori_delivery_extensions') is null
    or not exists (select 1 from pg_catalog.pg_proc f join pg_catalog.pg_roles o on o.oid=f.proowner
      where f.oid=to_regprocedure('public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb)')
        and md5(f.prosrc)='961f11c3c1b6d06ff8a6a797ca72f5a9' and f.prosecdef and o.rolname='postgres'
        and f.proconfig=array['search_path=""']::text[])
    or not exists (select 1 from pg_catalog.pg_proc f join pg_catalog.pg_roles o on o.oid=f.proowner
      where f.oid=to_regprocedure('public.natori_delivery_extend_v1(uuid,uuid,uuid,text,timestamptz,text,text,jsonb,timestamptz,jsonb)')
        and md5(f.prosrc)='1b81ee25316828abcfd866881e6769e5' and f.prosecdef and o.rolname='postgres'
        and f.proconfig=array['search_path=""']::text[])
    or not exists (select 1 from pg_catalog.pg_trigger where tgrelid='public.natori_delivery_releases'::regclass
      and tgname='natori_delivery_release_guard' and tgenabled='O' and not tgisinternal)
    or not exists (select 1 from pg_catalog.pg_trigger where tgrelid='public.natori_projects'::regclass
      and tgname='natori_delivery_project_guard' and tgenabled='O' and not tgisinternal) then
    raise exception 'Q01_DELIVERY_EXTENSION_PREREQUISITE_REQUIRED';
  end if;
end $$;

create or replace function public.natori_delivery_issue_v1(p_owner_id uuid,p_project_id uuid,p_operation_id uuid,p_to_email text,
  p_request_hash text,p_manifest jsonb,p_verified_at timestamptz,p_token_hash text,p_expires_at timestamptz,p_payload jsonb)
returns table(result text,release_id uuid,notification_id uuid)
language plpgsql security definer set search_path='' as $$
declare p public.natori_projects%rowtype; r public.natori_delivery_releases%rowtype;
  op public.natori_delivery_operations%rowtype; notice uuid; exp timestamptz; cnt integer; notice_hash text;
begin
  select * into p from public.natori_projects where id=p_project_id and user_id=p_owner_id for update;
  if not found then return query select 'not-found',null::uuid,null::uuid; return; end if;
  select * into op from public.natori_delivery_operations where project_id=p.id and operation_id=p_operation_id;
  if found then
    if op.request_hash<>p_request_hash then return query select 'conflict',null::uuid,null::uuid;
    else return query select 'issued',op.release_id,op.notification_id; end if;
    return;
  end if;
  if p.deleted_at is not null or p.status not in ('delivery_prep','delivered','completed') or p.payment_confirmed_at is null then
    return query select 'invalid-state',null::uuid,null::uuid; return; end if;
  if p_operation_id is null or p_request_hash !~ '^[0-9a-f]{64}$' or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_payload->>'format' is distinct from 'natori-delivery-aes256gcm-v1' then
    return query select 'invalid-input',null::uuid,null::uuid; return; end if;
  select * into r from public.natori_delivery_releases where project_id=p.id for update;
  if r.id is not null then
    if r.manifest is distinct from p_manifest then return query select 'conflict',null::uuid,null::uuid; return; end if;
    -- The project -> release locks serialize issuance with extend_v1.
    -- Never rewrite the immutable release expiry or an existing access row.
    select greatest(r.expires_at, coalesce(max(x.new_expires_at), r.expires_at)) into exp
      from public.natori_delivery_extensions x where x.release_id=r.id;
    -- A still unresolved notification is recovered with its original provider key and access.
    select j.id,j.snapshot->>'requestHash' into notice,notice_hash from public.natori_notification_jobs j where j.project_id=p.id
      and j.purpose='delivery_issue_client' and j.status in ('pending','sending','unknown') order by j.created_at desc limit 1;
    if notice is not null then
      if notice_hash is distinct from p_request_hash then
        -- A concurrent extension may itself have queued this unresolved notice.
        if p_expires_at is distinct from exp then
          return query select 'expiry-changed',null::uuid,null::uuid;
        else return query select 'conflict',null::uuid,null::uuid; end if;
        return;
      end if;
      insert into public.natori_delivery_operations(project_id,operation_id,request_hash,release_id,notification_id)
        values(p.id,p_operation_id,p_request_hash,r.id,notice);
      return query select 'issued',r.id,notice; return;
    end if;
  else
    if p.status='completed' and p.delivery_accepted_at is null then
      return query select 'invalid-state',null::uuid,null::uuid; return; end if;
    exp:=case when p.delivery_token_hash is not null then p.delivery_token_expires_at else p_expires_at end;
  end if;
  if exp is null or exp<=clock_timestamp() then
    return query select 'expired',null::uuid,null::uuid; return; end if;
  -- The encrypted email was built before these locks. A concurrent extension
  -- must not commit an access/notice with that stale expiry or rewrite its payload.
  if p_expires_at is distinct from exp then
    return query select 'expiry-changed',null::uuid,null::uuid; return; end if;
  if p_verified_at is null or p_verified_at>clock_timestamp()+interval '5 seconds'
    or p_verified_at<clock_timestamp()-interval '60 seconds' or jsonb_typeof(p_manifest)<>'array' then
    return query select 'unavailable',null::uuid,null::uuid; return; end if;
  cnt:=jsonb_array_length(p_manifest);
  if cnt not between 1 and 10 or cnt<>(select count(*) from public.natori_delivery_files
    where project_id=p.id and folder='final' and deleted_at is null)
    or cnt<>(select count(distinct m->>'id') from jsonb_array_elements(p_manifest) m)
    or exists(select 1 from jsonb_array_elements(p_manifest) m left join public.natori_delivery_files f
      on f.id::text=m->>'id' and f.project_id=p.id and f.folder='final' and f.deleted_at is null
      where f.id is null or f.state<>'ready' or (m->>'path',m->>'fileName',m->>'sizeBytes',m->>'contentType',m->>'storageVersion')
      is distinct from (f.storage_path,f.file_name,f.size_bytes::text,f.content_type,f.storage_version)) then
    return query select 'unavailable',null::uuid,null::uuid; return; end if;
  if r.id is null then
    -- Set the original hash only for a brand-new release, before the immutable release exists.
    if p.delivery_token_hash is null then
      update public.natori_projects set delivery_token_hash=p_token_hash,delivery_token_expires_at=exp,client_email=p_to_email where id=p.id;
      p.client_email:=p_to_email;
    end if;
    insert into public.natori_delivery_releases(project_id,manifest,snapshot,expires_at,accepted_at,legacy)
      values(p.id,p_manifest,jsonb_build_object('title',p.title,'clientName',p.client_name,'clientEmail',p.client_email),exp,p.delivery_accepted_at,p.delivery_token_hash is not null)
      returning * into r;
    if p.delivery_token_hash is not null then
      insert into public.natori_delivery_access(token_hash,release_id,expires_at) values(p.delivery_token_hash,r.id,exp);
    end if;
  end if;
  insert into public.natori_delivery_access(token_hash,release_id,expires_at) values(p_token_hash,r.id,exp);
  insert into public.natori_notification_jobs(notification_key,project_id,purpose,snapshot,payload)
    values('delivery-issued/'||r.id||'/'||p_operation_id,p.id,'delivery_issue_client',
      jsonb_build_object('releaseId',r.id,'title',p.title,'clientName',p.client_name,'requestHash',p_request_hash),p_payload) returning id into notice;
  insert into public.natori_delivery_operations(project_id,operation_id,request_hash,release_id,notification_id)
    values(p.id,p_operation_id,p_request_hash,r.id,notice);
  if p.status='delivery_prep' then
    update public.natori_projects set status='delivered',next_action='依頼者の受け取り確認を待つ' where id=p.id;
  end if;
  return query select 'issued',r.id,notice;
end $$;

alter function public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb) owner to postgres;
revoke all on function public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamptz,text,timestamptz,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
