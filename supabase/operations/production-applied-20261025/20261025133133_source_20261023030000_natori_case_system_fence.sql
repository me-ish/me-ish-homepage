-- Approved compatibility for the exact observed production predecessor.
-- Function definition only: no project row is modified by this migration.
do $compat$
declare p record;
begin
 select pr.*,pg_get_functiondef(pr.oid) definition,pg_get_userbyid(pr.proowner) owner_name,
        l.lanname language_name into p
 from pg_proc pr join pg_language l on l.oid=pr.prolang
 where pr.oid=to_regprocedure('public.natori_delete_project(uuid,uuid)');
 if not found then raise exception 'natori_production_delete_precondition'; end if;
 if md5(p.prosrc)<>'fb61f72d686fd06969a0162c9e8b2d89' or octet_length(p.prosrc)<>197
  or p.owner_name<>'postgres' or p.language_name<>'plpgsql' or p.prokind<>'f'
  or p.provolatile<>'v' or not p.prosecdef or p.proconfig is distinct from array['search_path=public']::text[]
  or not has_function_privilege('service_role',p.oid,'EXECUTE')
  or has_function_privilege('anon',p.oid,'EXECUTE')
  or has_function_privilege('authenticated',p.oid,'EXECUTE')
  or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')
 then raise exception 'natori_production_delete_precondition'; end if;
 execute replace(p.definition,p.prosrc,$archive$
declare
  v_project_id uuid;
begin
  select id into v_project_id
  from public.natori_projects
  where id = p_project_id
    and user_id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  update public.natori_projects
  set deleted_at = coalesce(deleted_at, now())
  where id = v_project_id;

  return true;
end;
$archive$);
 if (select md5(prosrc) from pg_proc where oid=p.oid)<>'3d3749b7c7c15d521f4a73b3080a7714'
 then raise exception 'natori_production_delete_postcondition'; end if;
end $compat$;

-- L7 database fence. Fixed, audited fact bodies only; no caller-selectable SQL,
-- no free GUC/allow flag, no private body or scope setter executable by service.
-- Original public SECURITY/owner/ACL/signature are retained. A fixed DEFINER
-- envelope is used only after checking the original INVOKER permission closure.
-- Any frozen code/ACL/schema dependency drift closes facts, rather than elevating.
-- Once cut over, legacy business endpoints may not revive stale progress/retry
-- semantics after resume. Administrative editors and fact reception are separate.
create or replace function public.natori_case_system_admit_v1(p_owner uuid,p_kind text)
returns boolean language plpgsql volatile security invoker set search_path='' as $admit$
declare h public.natori_case_system_holds%rowtype;
begin
 if p_owner is null or p_kind is null or p_kind not in ('command','legacy-command','sender','legacy-sender')
  or current_setting('transaction_isolation')<>'read committed' then return false;end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(7261549321761::bigint);
 select * into h from public.natori_case_system_holds where owner_id=p_owner;
 return not (coalesce(h.commands_held,false) and p_kind in ('command','legacy-command'))
  and not (coalesce(h.senders_held,false) and p_kind in ('sender','legacy-sender'))
  and not (h.owner_id is not null and p_kind in ('legacy-command','legacy-sender'));
end $admit$;
create schema natori_case_guard authorization postgres;
revoke all on schema natori_case_guard from public,anon,authenticated,service_role;
create table natori_case_guard.frames(pid integer not null,tx bigint not null,depth bigint generated always as identity,
 root text not null,owner_id uuid,project_id uuid,fact boolean not null,primary key(pid,tx,depth));
create table natori_case_guard.effects(root text not null,relation text not null,primary key(root,relation));
create table natori_case_guard.original_functions as select oid,proname,prosrc,prosecdef,proargtypes from pg_proc where pronamespace='public'::regnamespace;
create table natori_case_guard.dependencies(kind text not null,identity text not null,image text not null,primary key(kind,identity));
create table natori_case_guard.permissions(root text not null,kind text not null,identity text not null,privilege text not null,primary key(root,kind,identity,privilege));
alter table natori_case_guard.effects enable row level security;
alter table natori_case_guard.original_functions enable row level security;
alter table natori_case_guard.frames enable row level security;
alter table natori_case_guard.dependencies enable row level security;
alter table natori_case_guard.permissions enable row level security;
revoke all on all tables in schema natori_case_guard from public,anon,authenticated,service_role;
revoke all on all sequences in schema natori_case_guard from public,anon,authenticated,service_role;

create function natori_case_guard.shared_lock() returns void language plpgsql volatile security invoker set search_path='' as $fn$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'natori_system_isolation' using errcode='40001'; end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(7261549321761::bigint);
end $fn$;

-- Deterministic definitions only, never business rows or secret values.
create function natori_case_guard.images() returns table(kind text,identity text,image text)
language sql stable security invoker set search_path='' as $fn$
 select 'function',p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')||p.proowner::text)
 from pg_proc p where p.pronamespace in ('public'::regnamespace,'natori_case_guard'::regnamespace) and p.prokind in ('f','p','w')
 union all
 select 'relation',c.oid::regclass::text,md5(c.relowner::text||c.relrowsecurity::text||c.relforcerowsecurity::text||coalesce(c.relacl::text,'')||
  coalesce((select string_agg(a.attnum::text||a.attname||a.atttypid::text||a.attnotnull::text||coalesce(a.attacl::text,'')||coalesce(pg_get_expr(d.adbin,d.adrelid),''),'|' order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),'')||
  coalesce((select string_agg(pg_get_triggerdef(t.oid)||t.tgenabled::text||p.prosrc||p.prosecdef::text||p.proowner::text||coalesce(p.proconfig::text,''),'|' order by t.tgname) from pg_trigger t join pg_proc p on p.oid=t.tgfoid where t.tgrelid=c.oid and not t.tgisinternal),'')||
  coalesce((select string_agg(pg_get_constraintdef(k.oid)||k.convalidated::text,'|' order by k.conname) from pg_constraint k where k.conrelid=c.oid),'')||
  coalesce((select string_agg(pg_get_indexdef(k.indexrelid)||k.indisvalid::text||k.indisready::text,'|' order by k.indexrelid::regclass::text) from pg_index k where k.indrelid=c.oid),'')||
  coalesce((select string_agg(pg_get_ruledef(k.oid),'|' order by k.rulename) from pg_rewrite k where k.ev_class=c.oid),'')||
  coalesce((select string_agg(k.polname::text||k.polcmd::text||k.polroles::text||coalesce(pg_get_expr(k.polqual,k.polrelid),'')||coalesce(pg_get_expr(k.polwithcheck,k.polrelid),''),'|' order by k.polname) from pg_policy k where k.polrelid=c.oid),''))
 from pg_class c where c.relnamespace='public'::regnamespace and c.relname like 'natori_%' and c.relkind in ('r','S')
 union all select 'schema','public',md5(nspowner::text||coalesce(nspacl::text,'')) from pg_namespace where oid='public'::regnamespace
 union all select 'role','service_role',md5(rolbypassrls::text||rolsuper::text||rolinherit::text) from pg_roles where rolname='service_role'
$fn$;

create function natori_case_guard.check_contract(p_root text) returns void language plpgsql stable security invoker set search_path='' as $fn$
declare r record; allowed boolean;
begin
 if exists(select 1 from natori_case_guard.dependencies d full join natori_case_guard.images() i using(kind,identity) where d.image is distinct from i.image) then
  raise exception 'natori_system_contract_changed'; end if;
 if not exists(select 1 from pg_roles where rolname='service_role' and rolbypassrls) then raise exception 'natori_system_role_changed'; end if;
 for r in select * from natori_case_guard.permissions where root=p_root loop
  allowed:=case r.kind
   when 'schema' then has_schema_privilege('service_role',r.identity,r.privilege)
   when 'table' then has_table_privilege('service_role',r.identity,r.privilege)
   when 'sequence' then has_sequence_privilege('service_role',r.identity,r.privilege)
   when 'function' then has_function_privilege('service_role',r.identity::oid,r.privilege) else false end;
  if allowed is distinct from true then raise exception 'natori_system_original_permission_missing: % % % %',p_root,r.kind,r.identity,r.privilege; end if;
 end loop;
end $fn$;

-- Called only by triggers, never grants a frame to a caller.
create function natori_case_guard.row_owner(p_table text,p_row jsonb) returns uuid language plpgsql stable security invoker set search_path='' as $fn$
declare result uuid; project uuid;
begin
 if p_row is null then return null; end if;
 if p_row->>'owner_id' is not null then return (p_row->>'owner_id')::uuid; end if;
 if p_row->>'user_id' is not null then return (p_row->>'user_id')::uuid; end if;
 if p_table='natori_projects' then return (p_row->>'user_id')::uuid; end if;
 project:=nullif(p_row->>'project_id','')::uuid;
 if project is null and p_row->>'quote_id' is not null then select q.project_id into project from public.natori_quotes q where q.id=(p_row->>'quote_id')::uuid; end if;
 if project is null and p_row->>'release_id' is not null then select r.project_id into project from public.natori_delivery_releases r where r.id=(p_row->>'release_id')::uuid; end if;
 if project is null and p_row->>'job_id' is not null then
  select j.project_id into project from public.natori_notification_jobs j where j.id=(p_row->>'job_id')::uuid;
  if project is null then select j.project_id into project from public.natori_case_reconciliation_jobs j where j.id=(p_row->>'job_id')::uuid; end if;
 end if;
 select user_id into result from public.natori_projects where id=project;
 return result;
end $fn$;

create function natori_case_guard.statement_guard() returns trigger language plpgsql volatile security definer set search_path='' as $fn$
begin
 perform natori_case_guard.shared_lock();
 if tg_op='TRUNCATE' and exists(select 1 from public.natori_case_system_holds where commands_held or senders_held or read_only) then raise exception 'natori_system_held'; end if;
 return null;
end $fn$;
create function natori_case_guard.row_guard() returns trigger language plpgsql volatile security definer set search_path='' as $fn$
declare image jsonb; own uuid; project uuid; sender_change boolean; frame natori_case_guard.frames%rowtype;
begin
 if not exists(select 1 from public.natori_case_system_holds where commands_held or senders_held or read_only) then return case when tg_op='DELETE' then old else new end; end if;
 select * into frame from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() order by depth desc limit 1;
 for image in select v from (values(case when tg_op<>'INSERT' then to_jsonb(old) end),(case when tg_op<>'DELETE' then to_jsonb(new) end)) x(v) where v is not null loop
  own:=natori_case_guard.row_owner(tg_table_name,image);
  sender_change:=false;
  if tg_op<>'DELETE' then
   if tg_table_name='natori_notification_jobs' then
    sender_change:=((to_jsonb(new)->>'send_started_at') is not null and (to_jsonb(new)->>'send_started_at') is distinct from (to_jsonb(old)->>'send_started_at'))
     or ((to_jsonb(new)->>'status')='sending' and (to_jsonb(new)->>'claim_token') is not null and ((to_jsonb(new)->>'claim_token') is distinct from (to_jsonb(old)->>'claim_token') or (to_jsonb(new)->>'lease_expires_at') is distinct from (to_jsonb(old)->>'lease_expires_at')));
   elsif tg_table_name='natori_payment_link_attempts' then
    sender_change:=((to_jsonb(new)->>'price_started_at') is not null and (to_jsonb(new)->>'price_started_at') is distinct from (to_jsonb(old)->>'price_started_at')) or ((to_jsonb(new)->>'link_started_at') is not null and (to_jsonb(new)->>'link_started_at') is distinct from (to_jsonb(old)->>'link_started_at'));
   elsif tg_table_name='natori_payment_link_stops' then
    sender_change:=(to_jsonb(new)->>'claim_token') is not null and ((to_jsonb(new)->>'claim_token') is distinct from (to_jsonb(old)->>'claim_token') or ((to_jsonb(new)->>'lease_until') is not null and (to_jsonb(new)->>'lease_until') is distinct from (to_jsonb(old)->>'lease_until')));
   elsif tg_table_name in ('natori_case_mail_bindings','natori_case_mail_spends') then sender_change:=tg_op='INSERT';
   end if;
  end if;
  if sender_change and exists(select 1 from public.natori_case_system_holds where (own is null or owner_id=own) and (senders_held or read_only)) then raise exception 'natori_system_held';end if;
  if own is not null and not exists(select 1 from public.natori_case_system_holds where owner_id=own and (commands_held or read_only)) then continue; end if;
  project:=case when tg_table_name='natori_projects' then (image->>'id')::uuid else nullif(image->>'project_id','')::uuid end;
  if frame.fact is distinct from true or frame.owner_id is null or own is distinct from frame.owner_id or tg_op='DELETE'
   or (frame.project_id is not null and project is not null and project<>frame.project_id)
   or not exists(select 1 from natori_case_guard.effects r where r.root=frame.root and r.relation='public.'||tg_table_name)
   then raise exception 'natori_system_held'; end if;
 end loop;
 return case when tg_op='DELETE' then old else new end;
end $fn$;

-- Patch only exact 51-migration definitions; SECURITY/owner/ACL stay on the same OID.
do $install$
declare root jsonb; writer jsonb; p record; child record; dependency record; obj text; definition text; body text; args text;
 call_args text; guard_name text; wrapper text; guard_body text; facts jsonb; refs text[]; done text[]; todo text[]; current_name text; source text; requirement text; rel regclass; required_update boolean;
begin
 perform pg_catalog.pg_advisory_xact_lock(7261549321761::bigint);
 facts:=$facts$[{"name":"natori_accept_quote","ownerSql":"select p.user_id,q.project_id into hold_owner,hold_project from public.natori_quotes q join public.natori_projects p on p.id=q.project_id where q.token_hash=p_token_hash or q.id in (select a.quote_id from public.natori_quote_access a where a.token_hash=p_token_hash and a.expires_at>clock_timestamp()) limit 1;","factSql":"true","readSql":"false"},{"name":"natori_accept_quote_with_notifications_v1","ownerSql":"select p.user_id,q.project_id into hold_owner,hold_project from public.natori_quotes q join public.natori_projects p on p.id=q.project_id where q.token_hash=p_token_hash or q.id in (select a.quote_id from public.natori_quote_access a where a.token_hash=p_token_hash and a.expires_at>clock_timestamp()) limit 1;","factSql":"true","readSql":"false"},{"name":"natori_accept_delivery_ready_v1","ownerSql":"select p.user_id,p.id into hold_owner,hold_project from public.natori_projects p where p.delivery_token_hash=p_token_hash or p.id in (select r.project_id from public.natori_delivery_access a join public.natori_delivery_releases r on r.id=a.release_id where a.token_hash=p_token_hash) limit 1;","factSql":"true","readSql":"false"},{"name":"natori_record_rough_ok_v1","ownerSql":"select user_id,id into hold_owner,hold_project from public.natori_projects where id=p_project_id;","factSql":"true","readSql":"false"},{"name":"natori_stripe_event_claim_v1","ownerSql":"hold_owner:=p_owner_id;","factSql":"true","readSql":"false"},{"name":"natori_stripe_event_complete_v1","ownerSql":"hold_owner:=p_owner_id;","factSql":"true","readSql":"false"},{"name":"natori_stripe_event_complete_v2","ownerSql":"hold_owner:=p_owner_id;","factSql":"true","readSql":"false"},{"name":"natori_refund_reconcile_v1","ownerSql":"hold_owner:=p_owner_id;","factSql":"true","readSql":"false"},{"name":"natori_case_mail_event_v1","ownerSql":"select b.owner_id,b.project_id into hold_owner,hold_project from public.natori_case_mail_bindings b where b.job_id=p_job and b.run_id=p_run and b.provider_scope=p_scope;","factSql":"true","readSql":"false"},{"name":"natori_notification_finish_v1","ownerSql":"select p.user_id,p.id into hold_owner,hold_project from public.natori_notification_jobs j join public.natori_projects p on p.id=j.project_id where j.id=p_id; hold_fact:=exists(select 1 from public.natori_notification_jobs j where j.id=p_id and j.send_started_at is not null);","factSql":"true","readSql":"false"},{"name":"natori_payment_links_v1","ownerSql":"hold_owner:=p_owner_id; hold_project:=p_project_id;","factSql":"(p_command='stage' and p_input->>'stage' in ('price','link','review')) or p_command in ('reconcile_save','reconcile_review','finish_stop') or (p_command='mail_gate' and p_input->>'action' in ('release','review'))","readSql":"p_command='scan'"},{"name":"natori_case_payment_command_v1","ownerSql":"hold_owner:=p_owner_id; hold_project:=p_project_id;","factSql":"(p_command='stage' and p_input->>'stage' in ('price','link')) or (p_command='mail_gate' and p_input->>'action'='release')","readSql":"false"},{"name":"natori_case_reconciliation_v1","ownerSql":"hold_owner:=p_owner_id; hold_project:=p_project_id;","factSql":"p_command='save'","readSql":"p_command='read'"},{"name":"natori_case_payment_receipts_retire_v1","ownerSql":"hold_owner:=p_owner_id; hold_project:=p_project_id;","factSql":"true","readSql":"false"},{"name":"natori_consultation_operation_v1","ownerSql":"select user_id,id into hold_owner,hold_project from public.natori_projects where id=p_project_id;","factSql":"p_command='credential_finish'","readSql":"false"}]$facts$::jsonb;
 for root in select * from jsonb_array_elements($roots$[{"name":"natori_accept_quote","signature":"natori_accept_quote(text)","hash":"c5ff7c46f3a6bcf79a153af17fd7f2ea","definer":true,"refs":["natori_projects","natori_quote_access","natori_quotes"]},{"name":"natori_accept_quote_with_notifications_v1","signature":"natori_accept_quote_with_notifications_v1(text)","hash":"3a1c21ed1bcc72d069970234a569749b","definer":false,"refs":["natori_accept_quote","natori_notification_jobs","natori_quotes"]},{"name":"natori_accept_delivery_ready_v1","signature":"natori_accept_delivery_ready_v1(text,uuid,jsonb,timestamp with time zone)","hash":"e9ae3bbe50e0772c7c07355f234b053c","definer":true,"refs":["natori_delivery_access","natori_delivery_releases","natori_notification_jobs","natori_projects"]},{"name":"natori_record_rough_ok_v1","signature":"natori_record_rough_ok_v1(uuid,uuid,text)","hash":"b46dc8c48df340f6e500cce669fe86aa","definer":false,"refs":["natori_consultation_access","natori_consultation_messages","natori_notification_jobs","natori_projects","natori_talk_roughs"]},{"name":"natori_stripe_event_claim_v1","signature":"natori_stripe_event_claim_v1(uuid,text,boolean,text,text,jsonb,uuid)","hash":"41e83bc6562f0700784adf8372b75de9","definer":false,"refs":["natori_stripe_event_inbox"]},{"name":"natori_stripe_event_complete_v1","signature":"natori_stripe_event_complete_v1(uuid,text,boolean,text,uuid,integer)","hash":"4012e201da14178f88812c0a005f8665","definer":false,"refs":["natori_notification_jobs","natori_payment_transactions","natori_projects","natori_quotes","natori_record_stripe_payment","natori_stripe_event_inbox"]},{"name":"natori_stripe_event_complete_v2","signature":"natori_stripe_event_complete_v2(uuid,text,boolean,text,uuid,integer)","hash":"0991dfd62f231f65e3bb9719af05f975","definer":false,"refs":["natori_notification_jobs","natori_payment_transactions","natori_projects","natori_refund_ledger","natori_refund_reconcile_v1","natori_stripe_event_complete_v1","natori_stripe_event_inbox"]},{"name":"natori_refund_reconcile_v1","signature":"natori_refund_reconcile_v1(uuid,text,boolean,text)","hash":"450903364b2a13f1da06469a31aeaf91","definer":false,"refs":["natori_notification_jobs","natori_payment_transactions","natori_projects","natori_refund_ledger"]},{"name":"natori_case_mail_event_v1","signature":"natori_case_mail_event_v1(uuid,text,text,text,uuid,text,text,text,timestamp with time zone)","hash":"62c837425d64f8d06a96d854d188dd52","definer":false,"refs":["natori_case_mail_bindings","natori_case_mail_events","natori_case_mail_provider_map","natori_notification_jobs","natori_projects"]},{"name":"natori_notification_finish_v1","signature":"natori_notification_finish_v1(uuid,uuid,text,text,text)","hash":"971392b5964d7ecf5ecca4fc7e95d184","definer":false,"refs":["natori_notification_jobs","natori_projects"]},{"name":"natori_payment_links_v1","signature":"natori_payment_links_v1(uuid,uuid,text,jsonb)","hash":"5bcffc9fa58664e8eae146b3f62e593e","definer":false,"refs":["natori_case_outbound_blocked_v1","natori_case_reconciliation_jobs","natori_case_reconciliation_resolutions","natori_notification_jobs","natori_order_mail_logs","natori_payment_link_attempts","natori_payment_link_operations","natori_payment_link_reject_v1","natori_payment_link_rejections","natori_payment_link_stops","natori_projects","natori_quotes","natori_stripe_event_inbox"]},{"name":"natori_case_payment_command_v1","signature":"natori_case_payment_command_v1(uuid,uuid,text,jsonb)","hash":"7a098708217135d01fd9fc75370ff83e","definer":false,"refs":["natori_case_payment_receipt_reason_v1","natori_case_payment_snapshot_v1","natori_notification_jobs","natori_notification_retry_v1","natori_payment_link_operations","natori_payment_link_reject_v1","natori_payment_links_v1","natori_projects"]},{"name":"natori_case_reconciliation_v1","signature":"natori_case_reconciliation_v1(uuid,uuid,text,jsonb)","hash":"98d70b811c5a26bf075513837a5b4036","definer":false,"refs":["natori_case_mail_bindings","natori_case_mail_events","natori_case_reconciliation_evidence","natori_case_reconciliation_identity_v1","natori_case_reconciliation_jobs","natori_case_reconciliation_resolutions","natori_case_reconciliation_revision_v1","natori_notification_jobs","natori_payment_link_attempts","natori_payment_link_operations","natori_payment_link_stops","natori_payment_transactions","natori_projects","natori_quotes","natori_record_stripe_payment"]},{"name":"natori_case_payment_receipts_retire_v1","signature":"natori_case_payment_receipts_retire_v1(uuid,uuid,integer)","hash":"591fca70fd76b0af496c8437e9943db5","definer":false,"refs":["natori_case_payment_receipt_reason_v1","natori_notification_jobs","natori_payment_link_attempts","natori_payment_link_operations","natori_projects"]},{"name":"natori_consultation_operation_v1","signature":"natori_consultation_operation_v1(uuid,text,uuid,text,text,uuid,text,jsonb,uuid)","hash":"55640184cb0a2ecfffc39571feec3036","definer":false,"refs":["natori_consultation_access","natori_consultation_files","natori_consultation_messages","natori_consultation_operations","natori_consultation_uploads","natori_notification_jobs","natori_projects"]}]$roots$::jsonb) loop
  select pr.*,pg_get_functiondef(pr.oid) as definition,pg_get_function_arguments(pr.oid) as args,pg_get_function_result(pr.oid) as result into p from pg_proc pr where pr.oid=(root->>'signature')::regprocedure;
  if md5(p.prosrc)<>root->>'hash' or pg_get_userbyid(p.proowner)<>'postgres' or p.prosecdef is distinct from (root->>'definer')::boolean then raise exception 'natori_system_source_changed: %',root->>'name'; end if;
  -- Compute a conservative explicit permission closure at install time. Dynamic
  -- SQL and role-dependent bodies are rejected, not guessed or granted rights.
  todo:=array[root->>'name'];done:='{}';
  while cardinality(todo)>0 loop
   current_name:=todo[1];todo:=todo[2:];if current_name=any(done) then continue; end if;done:=array_append(done,current_name);
   select pr.* into child from natori_case_guard.original_functions pr where pr.proname=current_name;
   insert into natori_case_guard.permissions values(root->>'name','function',child.oid::text,'EXECUTE') on conflict do nothing;
   if child.prosecdef then continue; end if;
   source:=child.prosrc;
   if source ~* '\mexecute\M|\mcurrent_user\M|\msession_user\M|auth[.]uid|set[ ]+role' then raise exception 'natori_system_unbounded_dependency: %',current_name; end if;
   required_update:=source ~* 'for[[:space:]]+(update|share)';
   insert into natori_case_guard.permissions values(root->>'name','schema','public','USAGE') on conflict do nothing;
   for obj in select distinct (m)[1] from regexp_matches(source,'public[.](natori_[a-zA-Z0-9_]+)','g') m loop
    select c.oid into rel from pg_class c where c.relnamespace='public'::regnamespace and c.relname=obj and c.relkind='r';
    if rel is not null then
     insert into natori_case_guard.permissions values(root->>'name','table','public.'||obj,'SELECT') on conflict do nothing;
     if exists(select 1 from regexp_split_to_table(source,';') statement where statement ~* ('public[.]'||obj||'\M') and statement ~* 'for[[:space:]]+(update|share)') or source ~* ('update[[:space:]]+public[.]'||obj||'\M') then insert into natori_case_guard.permissions values(root->>'name','table','public.'||obj,'UPDATE') on conflict do nothing; end if;
     if source ~* ('insert[[:space:]]+into[[:space:]]+public[.]'||obj||'\M') then
      insert into natori_case_guard.permissions values(root->>'name','table','public.'||obj,'INSERT') on conflict do nothing;
      for dependency in select distinct 'public.'||s.relname as identity from pg_depend d join pg_class s on s.oid=d.objid and s.relkind='S' where d.refobjid=rel loop
       insert into natori_case_guard.permissions values(root->>'name','sequence',dependency.identity,'USAGE') on conflict do nothing;
      end loop;
     end if;
     if source ~* ('delete[[:space:]]+from[[:space:]]+public[.]'||obj||'\M') then insert into natori_case_guard.permissions values(root->>'name','table','public.'||obj,'DELETE') on conflict do nothing; end if;
     -- Trigger EXECUTE is checked at trigger creation, not each firing. Its body
     -- executes with its original SECURITY. Walk only INVOKER trigger bodies.
     for dependency in select f.* from pg_trigger t join pg_proc f on f.oid=t.tgfoid where t.tgrelid=rel and not t.tgisinternal and not f.prosecdef loop
      -- Frozen trigger source/attributes are checked by images(). Walk each
      -- normal function/table reference, but do not require trigger EXECUTE.
      if dependency.prosrc ~* '\mexecute\M|\mcurrent_user\M|\msession_user\M|auth[.]uid' then raise exception 'natori_system_role_dependent_trigger'; end if;
      for requirement in select distinct (m)[1] from regexp_matches(dependency.prosrc,'public[.](natori_[a-zA-Z0-9_]+)','g') m loop
       if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname=requirement) then todo:=array_append(todo,requirement);
       elsif exists(select 1 from pg_class where relnamespace='public'::regnamespace and relname=requirement and relkind='r') then
        insert into natori_case_guard.permissions values(root->>'name','table','public.'||requirement,'SELECT') on conflict do nothing;
        if dependency.prosrc ~* ('insert[[:space:]]+into[[:space:]]+public[.]'||requirement||'\M') then insert into natori_case_guard.permissions values(root->>'name','table','public.'||requirement,'INSERT') on conflict do nothing; end if;
        if dependency.prosrc ~* ('update[[:space:]]+public[.]'||requirement||'\M') then insert into natori_case_guard.permissions values(root->>'name','table','public.'||requirement,'UPDATE') on conflict do nothing; end if;
       end if;
      end loop;
     end loop;
    elsif exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname=obj) then todo:=array_append(todo,obj); end if;
   end loop;
  end loop;
  -- Effect scope is a separate closure. DEFINER boundaries retain their
  -- privilege context, but their exact trigger/table effects must remain recordable.
  todo:=array[root->>'name'];done:='{}';
  while cardinality(todo)>0 loop
   current_name:=todo[1];todo:=todo[2:];if current_name=any(done) then continue;end if;done:=array_append(done,current_name);
   select pr.* into child from natori_case_guard.original_functions pr where pr.proname=current_name;
   if child.prosrc is null then raise exception 'natori_system_effect_dependency_missing';end if;
   if child.prosrc ~* '\mexecute\M' then raise exception 'natori_system_dynamic_effect';end if;
   for obj in select distinct (m)[1] from regexp_matches(child.prosrc,'public[.](natori_[a-zA-Z0-9_]+)','g') m loop
    select c.oid into rel from pg_class c where c.relnamespace='public'::regnamespace and c.relname=obj and c.relkind='r';
    if rel is not null then
     insert into natori_case_guard.effects values(root->>'name','public.'||obj) on conflict do nothing;
     for requirement in select f.proname from pg_trigger t join pg_proc f on f.oid=t.tgfoid where t.tgrelid=rel and not t.tgisinternal loop todo:=array_append(todo,requirement);end loop;
    elsif exists(select 1 from natori_case_guard.original_functions where proname=obj) then todo:=array_append(todo,obj);end if;
   end loop;
  end loop;
  -- Existing DEFINER roots intentionally own their effects; collect table scope
  -- separately without adding service_role rights to the release table.
  if p.prosecdef then
   for obj in select distinct (m)[1] from regexp_matches(p.prosrc,'public[.](natori_[a-zA-Z0-9_]+)','g') m loop
    if exists(select 1 from pg_class where relnamespace='public'::regnamespace and relname=obj and relkind='r') then
     insert into natori_case_guard.permissions values(root->>'name','table','public.'||obj,'SELECT') on conflict do nothing;
    end if;
   end loop;
  end if;
  body:=p.prosrc;
  if root->>'name'='natori_accept_quote' then body:=replace(body,'if p.id is null or p.deleted_at','if q.user_id is distinct from p.user_id or p.id is null or p.deleted_at'); end if;
  if root->>'name' in ('natori_stripe_event_complete_v1','natori_stripe_event_complete_v2') then
   body:=replace(body,'if e.claim_token is distinct from p_claim_token','if p_claim_token is null or p_generation is null or e.claim_token is null or e.lease_until is null or e.claim_token is distinct from p_claim_token');
  end if;
  if root->>'name'='natori_consultation_operation_v1' then body:=replace(body,'if not found or upload_row.credential_issuer is distinct from p_claim_token','if not found or upload_row.credential_started_at is null or upload_row.credential_issuer is distinct from p_claim_token');end if;
  if root->>'name'='natori_payment_links_v1' then
   body:=replace(body,'elsif v_stage=''price'' then', 'elsif v_stage=''price'' then if a.price_started_at is null then return jsonb_build_object(''result'',''stale''); end if;');
   body:=replace(body,'elsif v_stage=''link'' then', 'elsif v_stage=''link'' then if a.link_started_at is null then return jsonb_build_object(''result'',''stale''); end if;');
  end if;
  if root->>'name'='natori_case_reconciliation_v1' then body:=replace(body,'if x.token is distinct from (p_input->>''token'')::uuid or x.generation', 'if x.token is null or x.lease_until is null or (p_input->>''token'') is null or (p_input->>''generation'') is null or x.token is distinct from (p_input->>''token'')::uuid or x.generation'); end if;
  -- Copy the exact trusted body to a private, non-callable-by-service function.
  definition:=replace(p.definition,'FUNCTION public.'||(root->>'name')||'(', 'FUNCTION natori_case_guard.'||(root->>'name')||'(');
  definition:=replace(definition,p.prosrc,body);execute definition;
  execute format('revoke all on function natori_case_guard.%I(%s) from public,anon,authenticated,service_role',root->>'name',pg_get_function_identity_arguments(p.oid));
  select string_agg(quote_ident(a),',' order by ord) into call_args from unnest(p.proargnames[1:p.pronargs]) with ordinality n(a,ord);
  guard_name:='natori_system_fact_'||(root->>'name');
  select value into root from jsonb_array_elements(facts) where value->>'name'=root->>'name';
  guard_body:='declare hold_owner uuid;hold_project uuid;hold_frame bigint;hold_fact boolean;';
  if p.result not like 'TABLE(%' and p.result not like 'SETOF %' then guard_body:=guard_body||'hold_result '||p.result||';';end if;
  guard_body:=guard_body||'begin if ('||(root->>'readSql')||') is not true then perform natori_case_guard.shared_lock();end if;perform natori_case_guard.check_contract('||quote_literal(root->>'name')||');';
  if root->>'readSql'<>'false' then guard_body:=guard_body||'if '||(root->>'readSql')||' then '||case when p.proretset then 'return query select * from ' else 'return ' end||'natori_case_guard.'||quote_ident(root->>'name')||'('||call_args||');'||case when p.proretset then 'return;' else '' end||'end if;';end if;
  guard_body:=guard_body||'hold_fact:=coalesce(('||(root->>'factSql')||'),false);'||(root->>'ownerSql')||
   'insert into natori_case_guard.frames(pid,tx,root,owner_id,project_id,fact) values(pg_backend_pid(),txid_current(),'||quote_literal(root->>'name')||',hold_owner,hold_project,hold_fact) returning depth into hold_frame;begin '||
   case when p.proretset then 'return query select * from ' else 'hold_result:=' end||'natori_case_guard.'||quote_ident(root->>'name')||'('||call_args||');exception when others then delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=hold_frame;raise;end;'||
   'delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=hold_frame;'||case when p.proretset then 'return;' else 'return hold_result;' end||'end';
  execute format('create function public.%I(%s) returns %s language plpgsql volatile security definer set search_path = %L as %L',guard_name,p.args,p.result,'',guard_body);
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated',guard_name,pg_get_function_identity_arguments(p.oid));
  execute format('grant execute on function public.%I(%s) to service_role',guard_name,pg_get_function_identity_arguments(p.oid));
  wrapper:='begin '||case when p.proretset then 'return query select * from ' else 'return ' end||'public.'||quote_ident(guard_name)||'('||call_args||');end';
  execute replace(p.definition,p.prosrc,wrapper);
 end loop;
 -- RPC admission precedes their existing advisory locks and business row locks.
 for writer in select * from jsonb_array_elements($writers$[{"signature":"natori_acknowledge_rough_ok_v1(uuid,uuid,uuid)","hash":"4fbcfa162f04ec4eb8550d0feecbc423"},{"signature":"natori_case_acceptance_mail_v1(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,jsonb)","hash":"0e26133102fba70942eb0d312ff58baf"},{"signature":"natori_case_acceptance_send_v1(uuid,uuid,uuid,text)","hash":"fb45db574f2f27ef1f229e6ff14a3c1c"},{"signature":"natori_case_admin_command_v1(uuid,uuid,uuid,text,text,jsonb,jsonb)","hash":"84e51825543ca5bb8b59f7dbed8e17cf"},{"signature":"natori_case_consultation_operation_v1(uuid,text,uuid,text,text,uuid,text,jsonb,uuid,jsonb)","hash":"e680f398566a7f2333a5930334d943be"},{"signature":"natori_case_context_command_v1(uuid,uuid,uuid,text,text,jsonb,jsonb)","hash":"334e26dd84b131ca39e7414841a1ff9d"},{"signature":"natori_case_delivery_v1(uuid,uuid,text,jsonb,uuid,text,text,jsonb,timestamp with time zone,text,timestamp with time zone,jsonb)","hash":"c0adac9a2711d076bf6e5fcf8d82dd7c"},{"signature":"natori_case_issue_quote_v1(uuid,jsonb,jsonb,text)","hash":"3b19d3c5d71629a9fab4270cefd53889"},{"signature":"natori_case_reconciliation_notice_read_v1(uuid,uuid,uuid)","hash":"35cce0639f36bd5ef7abe61ebed5af78"},{"signature":"natori_case_renotify_quote_v1(uuid,uuid,text,jsonb,text,timestamp with time zone,jsonb,text)","hash":"92fdd629242f8b147fb11578f20e2425"},{"signature":"natori_case_work_command_v1(uuid,uuid,text,jsonb)","hash":"d554668bf322f7ccae6e588e94550eba"},{"signature":"natori_confirm_manual_payment(uuid,uuid,text)","hash":"e09cfad6dcfd12eebc9f14c48224e713"},{"signature":"natori_confirm_project_type_v1(uuid,uuid,text)","hash":"67d37e5be3483fe1958fe65ddea543e7"},{"signature":"natori_consultation_legacy_notice_v1(uuid,uuid,uuid,jsonb,text,timestamp with time zone)","hash":"d381c32a5a5c424530cae05f2017188f"},{"signature":"natori_consultation_notice_projection_v1()","hash":"18abd96f613930c8579bc27aadc306fa"},{"signature":"natori_create_project_with_tasks(uuid,jsonb,jsonb,jsonb)","hash":"3c92c1b500be268eeb30d2ce2e4fec7f"},{"signature":"natori_create_project_with_tasks_v2(uuid,uuid,text,text,jsonb,jsonb,jsonb)","hash":"fda4ff03ad2e7fda4db9e3f3072da2f2"},{"signature":"natori_delete_project(uuid,uuid)","hash":"3d3749b7c7c15d521f4a73b3080a7714"},{"signature":"natori_delivery_delete_v1(uuid,uuid,boolean)","hash":"b2d687447217731371033fbef7c0a0e4"},{"signature":"natori_delivery_extend_v1(uuid,uuid,uuid,text,timestamp with time zone,text,text,jsonb,timestamp with time zone,jsonb)","hash":"1b81ee25316828abcfd866881e6769e5"},{"signature":"natori_delivery_finalize_v1(uuid,uuid,bigint,text,text,timestamp with time zone)","hash":"83f0fe7c2fb032e1d11e380c0f5003bf"},{"signature":"natori_delivery_issue_v1(uuid,uuid,uuid,text,text,jsonb,timestamp with time zone,text,timestamp with time zone,jsonb)","hash":"961f11c3c1b6d06ff8a6a797ca72f5a9"},{"signature":"natori_delivery_purge_payloads_v1(uuid)","hash":"524b6b04efd1a070c7de3a01092b1291"},{"signature":"natori_delivery_reserve_v1(uuid,uuid,uuid,text,text,text,bigint,text)","hash":"adbb764cca4303eb06ebd119daa10cb2"},{"signature":"natori_intake_begin_v1(uuid,uuid,text,jsonb,jsonb,uuid,boolean)","hash":"c0db4f013eba6a5c9ce57f7f26cfcf9f"},{"signature":"natori_intake_fail_v1(uuid,uuid,text,uuid)","hash":"0e302ff48116a2226b02dfdd69313f70"},{"signature":"natori_intake_finish_v1(uuid,uuid,text,uuid,text,text,jsonb,jsonb,boolean)","hash":"b879b1fdd74e4a5cb081b3176ceae18c"},{"signature":"natori_intake_review_v1(uuid,uuid,text,uuid)","hash":"0778ec238b40cafbef8e2ae9f0c4bcf0"},{"signature":"natori_intake_settle_v1(uuid,uuid,text)","hash":"809cb4fcb51bbffc842b7a50f35653c0"},{"signature":"natori_intake_touch_v1(uuid,uuid,text,uuid)","hash":"6dc194194297ce6e5872e3cc6a5d14ae"},{"signature":"natori_issue_quote(uuid,uuid,text,text,text,integer,text,text,text,timestamp with time zone)","hash":"77030c54474019077bc837f52684a3e8"},{"signature":"natori_issue_quote_from_draft_v1(uuid,uuid,text,text,text,integer,text,text,text,timestamp with time zone,jsonb,jsonb,text,integer)","hash":"18681e835969d60c8ae5817e2de169f1"},{"signature":"natori_issue_quote_v1(uuid,uuid,text,text,text,integer,text,text,text,timestamp with time zone,jsonb,jsonb,text)","hash":"859e0688c1b5b791478c64aee01594c4"},{"signature":"natori_issue_quote_with_notification_v1(uuid,jsonb,jsonb)","hash":"e5b16950c1e82a173c3389ab45d56677"},{"signature":"natori_issue_quote_with_terms(uuid,uuid,text,text,text,integer,text,text,text,timestamp with time zone,jsonb,date)","hash":"150e67f454e12990041dd8e9bde69c99"},{"signature":"natori_notification_claim_v1(uuid,uuid,boolean)","hash":"0b7538400b53cc571342bc745d5c7621"},{"signature":"natori_notification_retry_v1(uuid,uuid)","hash":"a2071b004bcbd0cd3dbde2d631438baf"},{"signature":"natori_notification_start_v1(uuid,uuid,jsonb)","hash":"ae28bef80c6b988ae6fd3a4b3cc75026"},{"signature":"natori_payment_link_reject_v1(uuid,uuid,text,text)","hash":"3eafb547ba9e0e1f5e29d98783e0e0c5"},{"signature":"natori_payment_link_terminal_guard_v1()","hash":"e54b44435326d8e2275c1c627eec58f9"},{"signature":"natori_quote_issue_lifecycle_v1()","hash":"7627ca2d1e06f12aa89c39e86c187cc5"},{"signature":"natori_record_stripe_payment(uuid,text,integer,uuid)","hash":"26e4295ec6bf7a0dbb9488789ca593d0"},{"signature":"natori_record_unresolved_stripe_payment_v1(uuid,text,integer,text)","hash":"f5cb6f94b1dfb0810a96eb95c51a0ab9"},{"signature":"natori_renotify_quote_v1(uuid,uuid,text,jsonb,text,timestamp with time zone,jsonb)","hash":"d79c5c2af8c77025f6831891fad99c59"},{"signature":"natori_retry_rough_ok_notification_v1(uuid,uuid,uuid)","hash":"dd2a44828955dc57760c062454ea5d27"},{"signature":"natori_rough_ok_enqueue_v1()","hash":"266f1bd8c945ca72e9350f8700afac14"},{"signature":"natori_save_estimate_draft_v1(uuid,uuid,integer,jsonb)","hash":"e900ef2ec1fdb4e81e2ccb87d32d1dab"},{"signature":"natori_save_portfolio_content(bigint,jsonb)","hash":"3c92c538949b8f8f989123b3be776d3f"},{"signature":"natori_update_task_and_status(uuid,uuid,text,boolean,text,text)","hash":"a9009c3c56ccffe758f0ff4608772fe9"},{"signature":"natori_update_task_v1(uuid,uuid,text,boolean)","hash":"5052ead2127fcc81a080a1e0e335122c"}]$writers$::jsonb) loop
  select pr.*,pg_get_functiondef(pr.oid) as definition into p from pg_proc pr where pr.oid=(writer->>'signature')::regprocedure;
  if md5(p.prosrc)<>writer->>'hash' then raise exception 'natori_system_writer_changed: %',writer->>'signature'; end if;
  body:=p.prosrc;
  if p.proname='natori_consultation_legacy_notice_v1' then
   body:=replace(body,'if m.notification_id is not null then return m.notification_id;end if;', 'if m.notification_id is not null then return m.notification_id;end if; if exists(select 1 from public.natori_case_system_holds where owner_id=p.user_id) then return null;end if;');
  end if;
  if p.proname='natori_case_consultation_operation_v1' then
   body:=replace(body,'declare p public.natori_projects%rowtype;o public.natori_consultation_operations%rowtype;','declare p public.natori_projects%rowtype;o public.natori_consultation_operations%rowtype;hold_receipt jsonb;');
   body:=replace(body,$old$ if p_command not in ('lookup','cancel') and o.status is distinct from 'committed' then$old$,$new$ if p_command='credential_finish' then
    hold_receipt:=public.natori_consultation_operation_v1(p_project_id,p_sender,p_operation_id,p_request_hash,p_command,p_owner_id,p_access_hash,p_input,p_claim_token);
    if p_workspace_guard is distinct from jsonb_build_object('title',p.title,'clientName',p.client_name,'email',p.client_email)
     or public.natori_case_outbound_blocked_v1(p.id) or o.notice_payload->>'caseWorkGuard' is distinct from public.natori_case_work_metadata_v1(p.id)
     or exists(select 1 from public.natori_case_system_holds where owner_id=p.user_id and (commands_held or read_only)) then
      hold_receipt:=jsonb_set(hold_receipt,'{expose}','false'::jsonb);
    end if;
    return hold_receipt;
   end if;
   if p_command not in ('lookup','cancel') and o.status is distinct from 'committed' then$new$);
  end if;
  body:=regexp_replace(body,'\mbegin\M',E'begin\n if current_setting(''transaction_isolation'')<>''read committed'' then raise exception ''natori_system_isolation'' using errcode=''40001'';end if; perform pg_catalog.pg_advisory_xact_lock_shared(7261549321761::bigint);','i');
  execute replace(p.definition,p.prosrc,body);
 end loop;
 for obj in select relname from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'natori_%' and relname not in ('natori_case_system_holds','natori_case_system_hold_events') loop
  execute format('create trigger natori_000_system_lock before insert or update or delete or truncate on public.%I for each statement execute function natori_case_guard.statement_guard()',obj);
  execute format('create trigger zzzz_natori_system_row before insert or update or delete on public.%I for each row execute function natori_case_guard.row_guard()',obj);
 end loop;
 execute 'revoke all on all functions in schema natori_case_guard from public,anon,authenticated,service_role';
 insert into natori_case_guard.dependencies select * from natori_case_guard.images();
 -- Preflight original permissions. Never compensate a failure with new grants.
 for obj in select distinct perm.root from natori_case_guard.permissions perm loop perform natori_case_guard.check_contract(obj); end loop;
end $install$;
revoke all on all functions in schema natori_case_guard from public,anon,authenticated,service_role;
