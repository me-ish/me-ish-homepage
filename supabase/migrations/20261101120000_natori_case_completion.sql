-- Forward only. Adds one owner-only completion route for cases that can never
-- receive a customer acceptance through a delivery page:
--   external : a case taken outside the site (no delivery page, no site intake)
--   deemed   : a delivery page that expired without the customer pressing 受け取り
-- PAY-01 stays intact for every other writer: the delivery guard accepts a first
-- completion without customer acceptance only inside this RPC's own guard frame.
-- No customer row is changed by this migration.
begin;
select pg_catalog.pg_advisory_xact_lock(7261549321761::bigint);
do $preflight$
declare r record;
begin
 if (select md5(prosrc) from pg_proc where oid='natori_case_guard.images()'::regprocedure)<>'13f3b8f50e9013b6d72e01af347bfaeb'
  or (select md5(prosrc) from pg_proc where oid='natori_case_guard.check_contract(text)'::regprocedure)<>'5dee460563666848471d9912b93048a3'
  then raise exception 'case_completion_guard_contract_mismatch';end if;
 if (select md5(prosrc) from pg_proc where oid='public.natori_delivery_project_guard_v1()'::regprocedure)<>'5669d0837ba50a7f5a31de9b08208d22'
  or (select md5(prosrc) from pg_proc where oid='public.natori_case_work_revision_v1(uuid)'::regprocedure)<>'7211ebadaf577b0a015fc27a0f9ed528'
  then raise exception 'case_completion_prior_contract_mismatch';end if;
 for r in select distinct root from natori_case_guard.permissions loop perform natori_case_guard.check_contract(r.root);end loop;
end $preflight$;

-- One immutable evidence row per completed case: who, when, why.
create table public.natori_case_completions(
 project_id uuid primary key references public.natori_projects(id),
 owner_id uuid not null references auth.users(id),
 request_id uuid not null unique,
 kind text not null check(kind in ('external','deemed')),
 release_id uuid references public.natori_delivery_releases(id),
 completed_at timestamptz not null,
 note text not null check(length(btrim(note)) between 1 and 2000),
 operator jsonb not null check(jsonb_typeof(operator)='object' and operator->>'kind' in ('auth-user','shared-key')),
 request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 check((kind='deemed')=(release_id is not null))
);
alter table public.natori_case_completions enable row level security;
revoke all on table public.natori_case_completions from public,anon,authenticated,service_role;
grant select on table public.natori_case_completions to service_role;

create function public.natori_case_completion_immutable_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin raise exception 'natori_case_completion_immutable' using errcode='23514'; end $$;
create trigger natori_case_completion_immutable before update or delete on public.natori_case_completions
 for each row execute function public.natori_case_completion_immutable_v1();
revoke all on function public.natori_case_completion_immutable_v1() from public,anon,authenticated,service_role;

-- The delivery guard keeps every PAY-01 rule. The only addition: a first
-- completion without customer acceptance is accepted when this transaction is
-- inside natori_case_complete_v1 for this same project. Any other writer
-- (including service_role) cannot read or create that frame.
do $patch$
declare p record;body text;old text;
begin
 select *,pg_get_functiondef(oid) definition into p from pg_proc where oid='public.natori_delivery_project_guard_v1()'::regprocedure;
 body:=p.prosrc;
 old:=$old0$declare r public.natori_delivery_releases%rowtype; first_acceptance boolean;$old0$;
 if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'case_completion_patch_count_0';end if;
 body:=replace(body,old,$new0$declare r public.natori_delivery_releases%rowtype; first_acceptance boolean; owner_completion boolean;$new0$);
 old:=$old1$  if old.completed_at is null and new.completed_at is not null and not first_acceptance then$old1$;
 if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'case_completion_patch_count_1';end if;
 body:=replace(body,old,$new1$  owner_completion:=false;
  if old.completed_at is null and new.completed_at is not null and not first_acceptance
    and new.status='completed' and old.status not in ('completed','closed')
    and new.delivery_accepted_at is null and old.delivery_accepted_at is null and new.deleted_at is null
    and (new.delivery_token_hash,new.delivery_token_expires_at,new.delivered_mail_at)
      is not distinct from (old.delivery_token_hash,old.delivery_token_expires_at,old.delivered_mail_at) then
    select exists(select 1 from natori_case_guard.frames f where f.pid=pg_backend_pid() and f.tx=txid_current()
      and f.root='natori_case_complete_v1' and f.project_id=old.id and f.owner_id=old.user_id) into owner_completion;
  end if;
  if owner_completion then return new; end if;
  if old.completed_at is null and new.completed_at is not null and not first_acceptance then$new1$);
 execute replace(p.definition,p.prosrc,body);
end $patch$;

-- Owner-only completion. Owner/operator are resolved on the server, never from the browser.
create function public.natori_case_complete_v1(p_owner uuid,p_project uuid,p_input jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare p public.natori_projects%rowtype; r public.natori_delivery_releases%rowtype; prior public.natori_case_completions%rowtype;
 v_request uuid; v_kind text; v_note text; v_at timestamptz; v_expiry timestamptz; h text; frame bigint;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'natori_system_isolation' using errcode='40001';end if;
 perform natori_case_guard.shared_lock();
 perform natori_case_guard.check_contract('natori_case_complete_v1');
 if p_owner is null or p_project is null or jsonb_typeof(p_input)<>'object'
  or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('requestId','revision','kind','note','completedAt','operator'))
  or coalesce(p_input->>'kind','') not in ('external','deemed')
  or coalesce(p_input->'operator'->>'kind','') not in ('auth-user','shared-key')
  or length(btrim(coalesce(p_input->>'note','')))=0 or length(p_input->>'note')>2000
  or coalesce(p_input->>'requestId','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or (p_input->>'kind'='deemed' and p_input ? 'completedAt')
  then return jsonb_build_object('result','invalid'); end if;
 v_request:=(p_input->>'requestId')::uuid; v_kind:=p_input->>'kind'; v_note:=btrim(p_input->>'note');
 h:=encode(sha256(convert_to(jsonb_build_array(v_kind,v_note,p_input->'completedAt',p_input->'operator')::text,'UTF8')),'hex');
 select * into p from public.natori_projects where id=p_project and user_id=p_owner for update;
 if not found then return jsonb_build_object('result','not-found'); end if;
 insert into natori_case_guard.frames(pid,tx,root,owner_id,project_id,fact)
  values(pg_backend_pid(),txid_current(),'natori_case_complete_v1',p.user_id,p.id,false) returning depth into frame;
 begin
  select * into prior from public.natori_case_completions where request_id=v_request or project_id=p.id;
  if found then
   delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;
   return jsonb_build_object('result',case when prior.request_id=v_request and prior.project_id=p.id and prior.owner_id=p_owner and prior.request_hash=h then 'applied' else 'conflict' end);
  end if;
  if p_input->>'revision' is distinct from public.natori_case_work_revision_v1(p.id) then
   delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;
   return jsonb_build_object('result','stale'); end if;
  if p.deleted_at is not null or p.status='closed' then
   delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;
   return jsonb_build_object('result','inactive'); end if;
  if p.status='completed' or p.completed_at is not null or p.delivery_accepted_at is not null then
   delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;
   return jsonb_build_object('result','already-completed'); end if;
  select * into r from public.natori_delivery_releases where project_id=p.id;
  if v_kind='external' then
   -- Taken outside the site: never had a delivery page, never came through the site form,
   -- and nobody recorded it as a site case.
   if r.id is not null or p.delivery_token_hash is not null or p.delivered_mail_at is not null or p.request_data is not null
    or exists(select 1 from public.natori_intake_operations where project_id=p.id and status='completed')
    or exists(select 1 from public.natori_case_work_records where project_id=p.id and kind='origin' and data->>'origin'='internal') then
    delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;
    return jsonb_build_object('result','not-eligible'); end if;
   v_at:=coalesce((p_input->>'completedAt')::timestamptz,clock_timestamp());
   if v_at>clock_timestamp() or v_at<p.created_at then
    delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;
    return jsonb_build_object('result','invalid'); end if;
  else
   -- Delivery page issued, expired (including extensions), never accepted.
   if r.id is null or r.accepted_at is not null or p.status<>'delivered' then
    delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;
    return jsonb_build_object('result','not-eligible'); end if;
   v_expiry:=greatest(r.expires_at,coalesce((select max(x.new_expires_at) from public.natori_delivery_extensions x where x.release_id=r.id),r.expires_at));
   if v_expiry>clock_timestamp() then
    delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;
    return jsonb_build_object('result','not-expired'); end if;
   v_at:=v_expiry;
  end if;
  update public.natori_projects set status='completed',completed_at=v_at where id=p.id;
  insert into public.natori_case_completions(project_id,owner_id,request_id,kind,release_id,completed_at,note,operator,request_hash)
   values(p.id,p_owner,v_request,v_kind,case when v_kind='deemed' then r.id end,v_at,v_note,p_input->'operator',h);
 exception when others then
  delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;raise;
 end;
 delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;
 return jsonb_build_object('result','applied');
end $$;
revoke all on function public.natori_case_complete_v1(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.natori_case_complete_v1(uuid,uuid,jsonb) to service_role;

do $finalize$
declare obj text;
begin
 execute 'create trigger natori_000_system_lock before insert or update or delete or truncate on public.natori_case_completions for each statement execute function natori_case_guard.statement_guard()';
 execute 'create trigger zzzz_natori_system_row before insert or update or delete on public.natori_case_completions for each row execute function natori_case_guard.row_guard()';
 insert into natori_case_guard.permissions values('natori_case_complete_v1','schema','public','USAGE'),
  ('natori_case_complete_v1','function','public.natori_case_complete_v1(uuid,uuid,jsonb)'::regprocedure::oid::text,'EXECUTE');
 insert into natori_case_guard.dependencies select * from natori_case_guard.images() on conflict(kind,identity) do update set image=excluded.image;
 for obj in select distinct root from natori_case_guard.permissions loop perform natori_case_guard.check_contract(obj);end loop;
end $finalize$;
commit;
