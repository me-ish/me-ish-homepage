-- Phase 2A foundation: expand only; no historical business rows are rewritten.
begin;

-- All quote writers, including the legacy adapter, acquire the project first.
-- The insert and the lifecycle projection commit together, before any mail await.
create function public.natori_quote_issue_lifecycle_v1() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare p public.natori_projects%rowtype;
begin
  select * into p from public.natori_projects where id = new.project_id for update;
  if not found or p.user_id is distinct from new.user_id then raise exception 'project_not_found'; end if;
  if p.deleted_at is not null or p.status = 'closed' then raise exception 'project_archived'; end if;
  if p.payment_confirmed_at is not null then raise exception 'project_already_paid'; end if;
  if p.quote_accepted_at is not null then raise exception 'quote_already_accepted'; end if;
  if p.status not in ('inquiry','consulting','estimating','quoted') then raise exception 'invalid_quote_state'; end if;
  update public.natori_projects set status = 'quoted', next_action = '見積りの承諾待ち'
    where id = p.id;
  return new;
end;
$$;
create trigger natori_quote_issue_lifecycle before insert on public.natori_quotes
for each row execute function public.natori_quote_issue_lifecycle_v1();
revoke all on function public.natori_quote_issue_lifecycle_v1() from public, anon, authenticated;

create table public.natori_quote_access (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  quote_id uuid not null references public.natori_quotes(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);
create index natori_quote_access_quote on public.natori_quote_access(quote_id);
alter table public.natori_quote_access enable row level security;
revoke all on public.natori_quote_access from public,anon,authenticated,service_role;
grant select,insert on public.natori_quote_access to service_role;


-- Retain the existing signature and notifications wrapper. Lock order agrees
-- with issue/close (project -> quote); prior accepted timestamps are unchanged.
create or replace function public.natori_accept_quote(p_token_hash text)
returns table(result text, quote_id uuid, project_id uuid, accepted_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare q public.natori_quotes%rowtype; p public.natori_projects%rowtype;
  t timestamptz := clock_timestamp();
begin
  select * into q from public.natori_quotes where token_hash = p_token_hash or id in
    (select a.quote_id from public.natori_quote_access a where a.token_hash=p_token_hash and a.expires_at>clock_timestamp());
  if not found then
    return query select 'not-found'::text,null::uuid,null::uuid,null::timestamptz; return;
  end if;
  select * into p from public.natori_projects where id = q.project_id for update;
  select * into q from public.natori_quotes where id = q.id for update;
  if q.superseded_at is not null then
    return query select 'superseded'::text,q.id,q.project_id,q.accepted_at; return;
  end if;
  if q.accepted_at is not null then
    return query select 'already-accepted'::text,q.id,q.project_id,q.accepted_at; return;
  end if;
  if p.id is null or p.deleted_at is not null or p.status = 'closed'
    or p.active_quote_id is distinct from q.id then
    return query select 'not-found'::text,q.id,q.project_id,null::timestamptz; return;
  end if;
  if q.expires_at < t then
    return query select 'expired'::text,q.id,q.project_id,null::timestamptz; return;
  end if;
  update public.natori_quotes set accepted_at = t where id = q.id;
  update public.natori_projects set quote_accepted_at = t, quote_accepted_amount = q.amount,
    amount = q.amount, next_action = case
      when payment_confirmed_at is not null then next_action
      else '見積り承諾済み・支払案内待ち' end
    where id = p.id;
  return query select 'ok'::text,q.id,q.project_id,t;
end;
$$;
revoke all on function public.natori_accept_quote(text) from public, anon, authenticated;
grant execute on function public.natori_accept_quote(text) to service_role;



create or replace function public.natori_issue_quote_from_draft_v1(
  p_user_id uuid, p_project_id uuid, p_title text, p_client_name text,
  p_to_email text, p_amount integer, p_subject text, p_body_snapshot text,
  p_token_hash text, p_expires_at timestamptz, p_request_snapshot jsonb,
  p_pricing_snapshot jsonb, p_idempotency_key text, p_expected_revision integer
)
returns table(quote_id uuid, version integer, reused boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_draft public.natori_estimate_drafts%rowtype;
  v_due_date date;
  v_quote record;
  v_terms jsonb;
begin
  perform 1 from public.natori_projects where id=p_project_id and user_id=p_user_id for update;
  if not found then raise exception 'project_not_found'; end if;
  select * into v_draft from public.natori_estimate_drafts
  where project_id = p_project_id and user_id = p_user_id for update;
  if not found or v_draft.revision is distinct from p_expected_revision then
    raise exception 'estimate_draft_changed';
  end if;
  if p_pricing_snapshot->'items' is distinct from v_draft.items
     or p_pricing_snapshot->'agreedTerms' is distinct from v_draft.agreed_terms then
    raise exception 'estimate_draft_mismatch';
  end if;
  if nullif(trim(v_draft.agreed_terms->>'deliverables'), '') is null
     or char_length(v_draft.agreed_terms->>'deliverables') > 1000
     or coalesce(v_draft.agreed_terms->>'scope', 'undecided') = 'undecided'
     or (v_draft.agreed_terms->>'scope' = 'other' and nullif(trim(v_draft.agreed_terms->>'scopeNote'), '') is null)
     or nullif(trim(v_draft.agreed_terms->>'usage'), '') is null
     or v_draft.agreed_terms->>'commercialUse' not in ('yes', 'no')
     or nullif(trim(v_draft.agreed_terms->>'publication'), '') is null
     or (v_draft.agreed_terms->>'dueDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'estimate_terms_incomplete';
  end if;
  begin
    v_due_date := (v_draft.agreed_terms->>'dueDate')::date;
  exception when others then
    raise exception 'estimate_terms_incomplete';
  end;
  if v_due_date < (now() at time zone 'Asia/Tokyo')::date then raise exception 'estimate_due_date_past'; end if;

  select * into v_quote from public.natori_issue_quote_v1(
    p_user_id, p_project_id, p_title, p_client_name, p_to_email, p_amount,
    p_subject, p_body_snapshot, p_token_hash, p_expires_at,
    p_request_snapshot, p_pricing_snapshot, p_idempotency_key
  );
  v_terms := jsonb_build_object(
    'deliverables', v_draft.agreed_terms->>'deliverables',
    'dueDate', v_draft.agreed_terms->>'dueDate',
    'scope', case v_draft.agreed_terms->>'scope'
      when 'bust_up' then '胸上' when 'waist_up' then '膝〜腰上'
      when 'full_body' then '全身' when 'sd' then 'SD'
      else v_draft.agreed_terms->>'scopeNote' end,
    'usage', v_draft.agreed_terms->>'usage',
    'commercialUse', case v_draft.agreed_terms->>'commercialUse'
      when 'yes' then 'あり' else 'なし' end,
    'publication', v_draft.agreed_terms->>'publication'
  );
  update public.natori_quotes set quote_terms = v_terms
  where id = v_quote.quote_id and project_id = p_project_id
    and (quote_terms is null or quote_terms = v_terms);
  if not found then raise exception 'quote_terms_conflict'; end if;
  update public.natori_projects set due_date = v_due_date
  where id = p_project_id and user_id = p_user_id;
  return query select v_quote.quote_id::uuid, v_quote.version::integer, v_quote.reused::boolean;
end;
$$;


-- Durable issue/replay evidence; no plaintext bearer token is stored.
create table public.natori_quote_issue_operations (
  project_id uuid not null references public.natori_projects(id),
  operation_id text not null check (char_length(operation_id) between 8 and 200),
  request jsonb not null check (jsonb_typeof(request) = 'object'),
  quote_id uuid not null references public.natori_quotes(id),
  notification_id uuid not null references public.natori_notification_jobs(id),
  created_at timestamptz not null default clock_timestamp(),
  primary key (project_id, operation_id)
);
create index natori_quote_issue_operations_created on public.natori_quote_issue_operations(project_id,created_at desc);
alter table public.natori_quote_issue_operations enable row level security;
revoke all on public.natori_quote_issue_operations from public,anon,authenticated,service_role;
grant select,insert on public.natori_quote_issue_operations to service_role;

alter table public.natori_notification_jobs drop constraint natori_notification_jobs_purpose_check;
alter table public.natori_notification_jobs add constraint natori_notification_jobs_purpose_check
check (purpose in ('quote_accept_artist','delivery_accept_artist','delivery_accept_client','delivery_issue_client','quote_issue_client'));
alter table public.natori_notification_jobs add constraint natori_quote_notification_encrypted
check (purpose <> 'quote_issue_client' or (payload is not null and
  payload->>'format'='natori-delivery-aes256gcm-v1' and payload ? 'ciphertext' and payload ? 'expiresAt'));

create function public.natori_issue_quote_with_notification_v1(p_owner_id uuid,p_input jsonb,p_payload jsonb)
returns table(quote_id uuid,version integer,reused boolean,notification_id uuid)
language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; op public.natori_quote_issue_operations%rowtype;
  q record; notice uuid; project uuid := (p_input->>'projectId')::uuid;
begin
  select * into p from public.natori_projects where id=project and user_id=p_owner_id for update;
  if not found then raise exception 'project_not_found'; end if;
  select * into op from public.natori_quote_issue_operations
    where project_id=p.id and operation_id=p_input->>'idempotencyKey';
  if found then
    if op.request is distinct from p_input then raise exception 'idempotency_conflict'; end if;
    return query select existing.id,existing.version,true,op.notification_id
      from public.natori_quotes existing where existing.id=op.quote_id;
    return;
  end if;
  if p_payload->>'format' is distinct from 'natori-delivery-aes256gcm-v1'
    or nullif(p_payload->>'ciphertext','') is null
    or (p_payload->>'expiresAt')::timestamptz is distinct from (p_input->>'expiresAt')::timestamptz then
    raise exception 'quote_notification_invalid';
  end if;
  select * into q from public.natori_issue_quote_from_draft_v1(
    p_owner_id,p.id,p.title,p.client_name,p_input->>'toEmail',(p_input->'pricingSnapshot'->>'total')::integer,
    p_input->>'subject',p_input->>'bodySnapshot',p_input->>'tokenHash',(p_input->>'expiresAt')::timestamptz,
    nullif(p_input->'requestSnapshot','null'::jsonb),p_input->'pricingSnapshot',p_input->>'idempotencyKey',(p_input->>'draftRevision')::integer);
  -- The trigger already saves the quoted lifecycle in this same transaction.
  insert into public.natori_notification_jobs(notification_key,project_id,quote_id,purpose,snapshot,payload)
    values('quote-issued/'||q.quote_id,p.id,q.quote_id,'quote_issue_client',
      jsonb_build_object('title',p.title,'clientName',p.client_name,'version',q.version),p_payload)
    returning id into notice;
  insert into public.natori_quote_issue_operations(project_id,operation_id,request,quote_id,notification_id)
    values(p.id,p_input->>'idempotencyKey',p_input,q.quote_id,notice);
  return query select q.quote_id::uuid,q.version::integer,q.reused::boolean,notice;
end;
$$;
revoke all on function public.natori_issue_quote_with_notification_v1(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.natori_issue_quote_with_notification_v1(uuid,jsonb,jsonb) to service_role;

create function public.natori_quote_issue_recovery_v1(p_owner_id uuid,p_project_id uuid,p_operation_id text default null)
returns table(quote_id uuid,version integer,notification_id uuid,notification_status text)
language sql stable security invoker set search_path='' as $$
  select q.id,q.version,j.id,coalesce(j.status,'legacy_unknown') from public.natori_projects p
  join public.natori_quotes q on q.id=p.active_quote_id
  left join lateral (select n.notification_id from public.natori_quote_issue_operations n
    where n.project_id=p.id and n.quote_id=q.id order by n.created_at desc limit 1) op on true
  left join public.natori_notification_jobs original on original.id=op.notification_id
  left join lateral (select n.* from public.natori_notification_jobs n where n.notification_key=original.notification_key order by n.attempt_no desc limit 1) j on true
  where p.id=p_project_id and p.user_id=p_owner_id and p_operation_id is null
  union all
  select q.id,q.version,j.id,j.status from public.natori_quote_issue_operations op
  join public.natori_projects p on p.id=op.project_id and p.user_id=p_owner_id
  join public.natori_quotes q on q.id=op.quote_id
  join public.natori_notification_jobs original on original.id=op.notification_id
  join lateral (select n.* from public.natori_notification_jobs n where n.notification_key=original.notification_key order by n.attempt_no desc limit 1) j on true
  where p.id=p_project_id and op.operation_id=p_operation_id;
$$;
revoke all on function public.natori_quote_issue_recovery_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.natori_quote_issue_recovery_v1(uuid,uuid,text) to service_role;

alter table public.natori_estimate_drafts add column mail_draft jsonb
  check (mail_draft is null or jsonb_typeof(mail_draft)='object');


-- Project-first draft save. Accepted/payment/terminal facts are checked under lock.
create function public.natori_save_estimate_draft_v1(p_owner_id uuid,p_project_id uuid,p_revision integer,p_draft jsonb)
returns table(result text,revision integer)
language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; d public.natori_estimate_drafts%rowtype;
begin
  select * into p from public.natori_projects where id=p_project_id and user_id=p_owner_id for update;
  if not found or p.deleted_at is not null then return query select 'not-found'::text,0; return; end if;
  if p.status not in ('inquiry','consulting','estimating','quoted') or p.quote_accepted_at is not null
    or p.payment_confirmed_at is not null then return query select 'invalid-state'::text,0; return; end if;
  select * into d from public.natori_estimate_drafts where project_id=p.id for update;
  if coalesce(d.revision,0) is distinct from p_revision then return query select 'conflict'::text,coalesce(d.revision,0); return; end if;
  insert into public.natori_estimate_drafts(project_id,user_id,agreed_terms,items,mail_draft,revision)
    values(p.id,p_owner_id,p_draft->'agreedTerms',p_draft->'items',nullif(p_draft->'mailDraft','null'::jsonb),p_revision+1)
    on conflict(project_id) do update set agreed_terms=excluded.agreed_terms,items=excluded.items,
      mail_draft=excluded.mail_draft,revision=excluded.revision,updated_at=clock_timestamp();
  return query select 'ok'::text,p_revision+1;
end;
$$;
revoke all on function public.natori_save_estimate_draft_v1(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.natori_save_estimate_draft_v1(uuid,uuid,integer,jsonb) to service_role;

-- Compatibility writers also cannot edit accepted facts. Old REST writers may
-- lose a deadlock race and must reload; they never commit an invalid draft.
create function public.natori_guard_estimate_draft_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype;
begin
  select * into p from public.natori_projects where id=new.project_id for update;
  if not found or p.user_id is distinct from new.user_id or p.deleted_at is not null
    or p.status not in ('inquiry','consulting','estimating','quoted')
    or p.quote_accepted_at is not null or p.payment_confirmed_at is not null then
    raise exception 'estimate_draft_locked' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger natori_guard_estimate_draft before insert or update on public.natori_estimate_drafts
for each row execute function public.natori_guard_estimate_draft_v1();
revoke all on function public.natori_guard_estimate_draft_v1() from public,anon,authenticated;

create function public.natori_renotify_quote_v1(p_owner_id uuid,p_quote_id uuid,p_operation_id text,
  p_request jsonb,p_token_hash text,p_expires_at timestamptz,p_payload jsonb)
returns table(notification_id uuid)
language plpgsql security invoker set search_path='' as $$
declare q public.natori_quotes%rowtype; p public.natori_projects%rowtype;
  op public.natori_quote_issue_operations%rowtype; n uuid; prior public.natori_notification_jobs%rowtype;
begin
  select * into q from public.natori_quotes where id=p_quote_id;
  if not found then raise exception 'project_not_found'; end if;
  select * into p from public.natori_projects where id=q.project_id and user_id=p_owner_id for update;
  if not found then raise exception 'project_not_found'; end if;
  select * into op from public.natori_quote_issue_operations where project_id=p.id and operation_id=p_operation_id;
  if found then
    if op.request is distinct from p_request or op.quote_id is distinct from q.id then raise exception 'idempotency_conflict'; end if;
    return query select op.notification_id; return;
  end if;
  select * into q from public.natori_quotes where id=p_quote_id for update;
  if p.deleted_at is not null or p.status='closed' or p.active_quote_id is distinct from q.id
    or q.superseded_at is not null then raise exception 'invalid_quote_state'; end if;
  if q.accepted_at is null and q.expires_at<=clock_timestamp() then raise exception 'invalid_quote_expiry'; end if;
  if p_expires_at<=clock_timestamp() or (q.accepted_at is null and p_expires_at>q.expires_at)
    or p_payload->>'format' is distinct from 'natori-delivery-aes256gcm-v1'
    or nullif(p_payload->>'ciphertext','') is null
    or (p_payload->>'expiresAt')::timestamptz is distinct from p_expires_at then raise exception 'quote_notification_invalid'; end if;
  -- Unknown or processing results recover the original payload/key, never a second mail.
  select * into prior from public.natori_notification_jobs j where j.quote_id=q.id and j.purpose='quote_issue_client'
    order by j.created_at desc limit 1;
  if found and prior.status in ('pending','sending','unknown') then
    if prior.snapshot->'request' is distinct from p_request then raise exception 'notification_recovery_required'; end if;
    n:=prior.id;
  else
    insert into public.natori_quote_access(token_hash,quote_id,expires_at) values(p_token_hash,q.id,p_expires_at);
    insert into public.natori_notification_jobs(notification_key,project_id,quote_id,purpose,snapshot,payload)
      values('quote-renotified/'||q.id||'/'||p_operation_id,p.id,q.id,'quote_issue_client',
        jsonb_build_object('title',q.title,'clientName',q.client_name,'version',q.version,'request',p_request),p_payload)
      returning id into n;
  end if;
  insert into public.natori_quote_issue_operations(project_id,operation_id,request,quote_id,notification_id)
    values(p.id,p_operation_id,p_request,q.id,n);
  return query select n;
end;
$$;
revoke all on function public.natori_renotify_quote_v1(uuid,uuid,text,jsonb,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.natori_renotify_quote_v1(uuid,uuid,text,jsonb,text,timestamptz,jsonb) to service_role;

commit;
