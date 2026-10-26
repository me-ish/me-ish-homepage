-- L7 fresh local-state review. No business-row changes, retries or provider calls.
-- A revision binds ALL local Natori business rows conservatively; another owner's
-- change can invalidate a review but never exposes their rows. Counts are owner-only.
-- The revision is not evidence that an external request never ran.
alter table public.natori_case_system_hold_events add column reviewed_revision text
 check (reviewed_revision is null or reviewed_revision ~ '^[0-9a-f]{32}$');

create or replace function public.natori_case_system_review_v1(p_owner uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $review$
declare state jsonb; table_entry record; part text; digest text:=''; unknowns bigint; inflight bigint; targets jsonb;
begin
 if p_owner is null then return null; end if;
 state:=public.natori_case_system_status_v1(p_owner);
 -- Each table is a deterministic digest, including lease live/expired classification.
 -- READ ONLY-compatible: no frame, GUC, ledger or row/advisory lock is written here.
 for table_entry in select c.oid,c.relname from pg_catalog.pg_class c
  where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relname like 'natori_%'
   and c.relname not in ('natori_case_system_holds','natori_case_system_hold_events') order by c.relname loop
  execute format($q$select md5(coalesce(string_agg(image,'|' order by image),'')) from
   (select to_jsonb(t)::text||coalesce((select string_agg(e.key||':'||(case when e.value #>> '{}' ~ '^\d{4}-\d{2}-\d{2}T' then ((e.value #>> '{}')::timestamptz+case when e.key in ('price_started_at','link_started_at') then interval '23 hours' else interval '0' end)>clock_timestamp() else false end)::text,',' order by e.key)
    from jsonb_each(to_jsonb(t)) e where (e.key in ('lease_until','mail_until','deadline','price_started_at','link_started_at') or e.key like '%%expires_at') and e.value<>'null'::jsonb),'') image from public.%I t) rows$q$,table_entry.relname) into part;
  digest:=md5(digest||table_entry.relname||part);
 end loop;
 select count(*) filter(where j.status in ('unknown','needs_review')),
  count(*) filter(where j.status='sending' or j.lease_expires_at>clock_timestamp())
 into unknowns,inflight from public.natori_notification_jobs j join public.natori_projects p on p.id=j.project_id where p.user_id=p_owner;
 select unknowns+count(*) filter(where a.state='needs_review' or (a.state='creating' and (a.price_started_at is not null or a.link_started_at is not null))),
  inflight+count(*) filter(where a.lease_until>clock_timestamp() or a.mail_until>clock_timestamp())
 into unknowns,inflight from public.natori_payment_link_attempts a where a.owner_id=p_owner;
 select unknowns+count(*) filter(where e.status='needs_review'),inflight+count(*) filter(where e.lease_until>clock_timestamp())
 into unknowns,inflight from public.natori_stripe_event_inbox e where e.owner_id=p_owner;
 select coalesce(jsonb_agg(jsonb_build_object('kind',pending.kind,'id',pending.id,'projectId',pending.project_id,'status',pending.status,'leaseUntil',pending.lease_until,'unresolved',coalesce(pending.unresolved,false),'inFlight',coalesce(pending.inflight,false)) order by pending.kind,pending.project_id,pending.id),'[]'::jsonb) into targets from (
  select 'notification' kind,j.id::text id,j.project_id,j.status,j.lease_expires_at lease_until,j.status in ('unknown','needs_review') unresolved,j.status='sending' or j.lease_expires_at>clock_timestamp() inflight
   from public.natori_notification_jobs j join public.natori_projects p on p.id=j.project_id where p.user_id=p_owner and j.status<>'sent'
  union all select 'legacy-mail',l.id::text,l.project_id,l.status,null::timestamptz,true,false from public.natori_order_mail_logs l join public.natori_projects p on p.id=l.project_id where p.user_id=p_owner and l.status<>'sent'
  union all select 'legacy-consultation',m.id::text,m.project_id,m.notification_status,null::timestamptz,true,false from public.natori_consultation_messages m join public.natori_projects p on p.id=m.project_id where p.user_id=p_owner and m.notification_id is null and m.notification_status<>'sent'
  union all select 'payment-ledger',t.id::text,t.project_id,t.status,null::timestamptz,true,false from public.natori_payment_transactions t join public.natori_projects p on p.id=t.project_id where p.user_id=p_owner and t.status not in ('received','manual')
  union all select 'link-attempt',a.id::text,a.project_id,a.state,a.lease_until,a.state='needs_review' or (a.state='creating' and (a.price_started_at is not null or a.link_started_at is not null)),a.lease_until>clock_timestamp() or a.mail_until>clock_timestamp()
   from public.natori_payment_link_attempts a where a.owner_id=p_owner and (a.state in ('creating','needs_review','stop_required','deactivating') or a.lease_until>clock_timestamp() or a.mail_until>clock_timestamp())
  union all select 'payment-operation',o.operation_id::text,o.project_id,o.status,null::timestamptz,o.reconciliation_id is null,false from public.natori_payment_link_operations o join public.natori_projects p on p.id=o.project_id where p.user_id=p_owner and o.status='pending'
  union all select 'link-stop',s.id::text,s.project_id,s.status,s.lease_until,s.status='needs_review',s.lease_until>clock_timestamp() from public.natori_payment_link_stops s where s.owner_id=p_owner and s.status<>'completed'
  union all select 'reconciliation',j.id::text,j.project_id,j.state,j.lease_until,true,j.state='inspecting' and j.lease_until>clock_timestamp() from public.natori_case_reconciliation_jobs j where j.owner_id=p_owner and not exists(select 1 from public.natori_case_reconciliation_resolutions r where r.job_id=j.id)
  union all select 'stripe-event',e.account_scope||'/'||e.livemode::text||'/'||e.event_id,case when p.user_id=p_owner then e.project_id else null end,e.status,e.lease_until,e.status='needs_review',e.lease_until>clock_timestamp() from public.natori_stripe_event_inbox e left join public.natori_projects p on p.id=e.project_id where e.owner_id=p_owner and e.status<>'completed'
  union all select 'refund',r.id::text,case when p.user_id=p_owner then r.project_id else null end,r.resolution||'/'||r.provider_status,null::timestamptz,r.resolution<>'resolved' or r.provider_status='unknown',r.provider_status in ('pending','requires_action') from public.natori_refund_ledger r left join public.natori_projects p on p.id=r.project_id where r.owner_id=p_owner and (r.resolution<>'resolved' or r.provider_status in ('pending','requires_action','unknown'))
  union all select 'intake',o.operation_id::text,case when p.user_id=p_owner then o.project_id else null end,o.status,o.lease_expires_at,o.status='needs_review',o.lease_expires_at>clock_timestamp() from public.natori_intake_operations o left join public.natori_projects p on p.id=o.project_id where o.owner_id=p_owner and o.status in ('processing','needs_review')
  union all select 'consultation',o.operation_id::text,o.project_id,o.status,o.lease_expires_at,o.status='verifying' and (o.lease_expires_at is null or o.lease_expires_at<=clock_timestamp()),o.lease_expires_at>clock_timestamp() from public.natori_consultation_operations o join public.natori_projects p on p.id=o.project_id where p.user_id=p_owner and o.status in ('reserved','verifying','cleanup')
  union all select 'upload-credential',u.id::text,u.project_id,case when u.credential_issuer is not null then 'credential_unknown' else 'credential_issued' end,u.credential_expires_at,u.credential_issuer is not null,u.credential_issuer is not null or u.credential_expires_at>clock_timestamp() from public.natori_consultation_uploads u join public.natori_projects p on p.id=u.project_id where p.user_id=p_owner and u.finalized_at is null and (u.credential_issuer is not null or u.credential_expires_at is not null)
  union all select 'delivery-file',f.id::text,f.project_id,f.state,null::timestamptz,f.state='deleting',false from public.natori_delivery_files f join public.natori_projects p on p.id=f.project_id where p.user_id=p_owner and f.state in ('pending','deleting') and f.deleted_at is null
 ) pending;
 select count(*) filter(where (x->>'unresolved')::boolean),count(*) filter(where (x->>'inFlight')::boolean) into unknowns,inflight from jsonb_array_elements(targets) x;
 return state||jsonb_build_object('revision',md5(state::text||digest),'localUnknownRecords',unknowns,'localInFlightRecords',inflight,'records',targets,'recordsComplete',true,
  'externalAbsenceProven',false,'priorRequestsMayComplete',true,'scope','local-ledgers-only');
end $review$;
revoke all on function public.natori_case_system_review_v1(uuid) from public,anon,authenticated;
grant execute on function public.natori_case_system_review_v1(uuid) to service_role;

create or replace function public.natori_case_system_control_v2(p_owner uuid,p_action text,p_generation bigint,p_actor jsonb,p_review text,p_acknowledge_prior boolean)
returns jsonb language plpgsql volatile security definer set search_path='' as $control$

declare h public.natori_case_system_holds%rowtype; g bigint;
begin
 if current_setting('transaction_isolation')<>'read committed'
  or p_owner is null or not exists(select 1 from auth.users where id=p_owner)
  or p_action is null or p_action not in ('hold','read-only','resume-commands','resume-senders')
  or p_generation is null or p_actor is null or jsonb_typeof(p_actor)<>'object'
  or coalesce(p_actor->>'kind','') not in ('auth-user','shared-key')
  or (p_actor->>'kind'='auth-user' and coalesce(p_actor->>'userId','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  or (p_actor->>'kind'='shared-key' and p_actor->>'userId' is not null)
 then return jsonb_build_object('result','invalid_request'); end if;
 -- Do not take business-row locks under this exclusive admission lock.
 perform pg_catalog.pg_advisory_xact_lock(7261549321761::bigint);
 if p_action in ('resume-commands','resume-senders') then
  if p_acknowledge_prior is distinct from true or p_review is null or p_review !~ '^[0-9a-f]{32}$' then
   return jsonb_build_object('result','fresh_review_required'); end if;
  if (public.natori_case_system_review_v1(p_owner)->>'revision') is distinct from p_review then
   return jsonb_build_object('result','review_stale'); end if;
 end if;
 select * into h from public.natori_case_system_holds where owner_id=p_owner for update;
 g:=coalesce(h.generation,0);
 if p_generation<>g then return jsonb_build_object('result','stale'); end if;
 if h.owner_id is null and p_action in ('resume-commands','resume-senders') then
  return jsonb_build_object('result','invalid_request'); end if;
 -- Sender resume is separate; it cannot silently reopen a read-only rollback.
 if p_action='resume-senders' and (h.commands_held or h.read_only) then
  return jsonb_build_object('result','commands_held'); end if;
 insert into public.natori_case_system_holds(owner_id,generation,commands_held,senders_held,read_only)
 values(p_owner,g+1,
  case when p_action in ('hold','read-only') then true when p_action='resume-commands' then false else h.commands_held end,
  case when p_action in ('hold','read-only') then true when p_action='resume-senders' then false else h.senders_held end,
  case when p_action='read-only' then true when p_action='resume-commands' then false else coalesce(h.read_only,false) end)
 on conflict(owner_id) do update set generation=excluded.generation,commands_held=excluded.commands_held,
  senders_held=excluded.senders_held,read_only=excluded.read_only,changed_at=clock_timestamp();
 insert into public.natori_case_system_hold_events(owner_id,generation,action,actor,reviewed_revision)
 values(p_owner,g+1,p_action,jsonb_build_object('kind',p_actor->>'kind','userId',p_actor->>'userId'),case when p_action like 'resume-%' then p_review else null end);
 return jsonb_build_object('result','saved','generation',g+1,'priorRequestsMayComplete',true);
end
$control$;
revoke all on function public.natori_case_system_control_v2(uuid,text,bigint,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.natori_case_system_control_v2(uuid,text,bigint,jsonb,text,boolean) to service_role;

-- Old callers can always stop; they cannot reopen using a generation-only token.
create or replace function public.natori_case_system_control_v1(p_owner uuid,p_action text,p_generation bigint,p_actor jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $old$
begin
 if p_action in ('resume-commands','resume-senders') then return jsonb_build_object('result','fresh_review_required'); end if;
 return public.natori_case_system_control_v2(p_owner,p_action,p_generation,p_actor,null,false);
end $old$;
revoke all on function public.natori_case_system_control_v1(uuid,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.natori_case_system_control_v1(uuid,text,bigint,jsonb) to service_role;
