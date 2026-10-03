begin;
-- Phase 2B: expand-only Natori-specific durable inbox. No history rewrite.
create table public.natori_stripe_event_inbox (
  event_id text not null check (length(event_id) between 1 and 200),
  account_scope text not null check (length(account_scope) between 1 and 200),
  livemode boolean not null,
  event_type text not null,
  request jsonb not null check (jsonb_typeof(request)='object'),
  owner_id uuid not null references auth.users(id),
  project_id uuid,
  status text not null default 'processing' check (status in ('processing','completed','needs_review')),
  claim_token uuid, claim_generation integer not null default 0,
  lease_until timestamptz, processed_at timestamptz,
  result text, error_code text,
  notification_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(account_scope,livemode,event_id)
);
create index natori_stripe_inbox_attention_idx on public.natori_stripe_event_inbox(project_id,status,lease_until)
  where status in ('processing','needs_review');
alter table public.natori_stripe_event_inbox enable row level security;
revoke all on public.natori_stripe_event_inbox from public,anon,authenticated,service_role;
grant select,insert,update on public.natori_stripe_event_inbox to service_role;

alter table public.natori_payment_transactions add column stripe_account_scope text,
  add column stripe_livemode boolean, add column stripe_payment_intent_id text;
create index natori_payment_intent_idx on public.natori_payment_transactions(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.natori_notification_jobs drop constraint natori_notification_jobs_purpose_check;
alter table public.natori_notification_jobs add constraint natori_notification_jobs_purpose_check check
  (purpose in ('quote_accept_artist','delivery_accept_artist','delivery_accept_client','delivery_issue_client',
  'quote_issue_client','payment_received_artist','payment_received_client','payment_review_artist'));

create function public.natori_stripe_event_claim_v1(p_owner_id uuid,p_account text,p_live boolean,p_event_id text,p_type text,p_request jsonb,p_claim_token uuid)
returns table(result text,generation integer,notification_ids uuid[])
language plpgsql security invoker set search_path='' as $$
declare e public.natori_stripe_event_inbox%rowtype;
begin
  if p_claim_token is null or p_live is null or p_request is null or jsonb_typeof(p_request)<>'object'
    or p_type not in ('checkout.session.completed','checkout.session.async_payment_succeeded') then
    raise exception 'invalid_event_claim';
  end if;
  insert into public.natori_stripe_event_inbox(owner_id,account_scope,livemode,event_id,event_type,request,project_id)
    values(p_owner_id,p_account,p_live,p_event_id,p_type,p_request,(p_request->>'projectId')::uuid)
    on conflict(account_scope,livemode,event_id) do nothing;
  select * into e from public.natori_stripe_event_inbox
    where account_scope=p_account and livemode=p_live and event_id=p_event_id for update;
  if e.owner_id is distinct from p_owner_id then return query select 'owner_mismatch'::text,e.claim_generation,e.notification_ids; return; end if;
  if e.request is distinct from p_request or e.event_type<>p_type then
    -- Do not replace the recorded request or financial effect with a conflicting delivery.
    update public.natori_stripe_event_inbox set status='needs_review',error_code='event_identity_conflict',
      processed_at=coalesce(processed_at,now()),updated_at=now() where account_scope=p_account and livemode=p_live and event_id=p_event_id;
    return query select 'needs_review'::text,e.claim_generation,e.notification_ids; return;
  end if;
  if e.status in ('completed','needs_review') then
    return query select e.status,e.claim_generation,e.notification_ids; return;
  end if;
  if e.claim_token is not null and e.lease_until>clock_timestamp() then
    return query select 'busy'::text,e.claim_generation,e.notification_ids; return;
  end if;
  update public.natori_stripe_event_inbox set claim_token=p_claim_token,claim_generation=e.claim_generation+1,
    lease_until=clock_timestamp()+interval '60 seconds',updated_at=now()
    where account_scope=p_account and livemode=p_live and event_id=p_event_id;
  return query select 'claimed'::text,e.claim_generation+1,e.notification_ids;
end;
$$;

create function public.natori_stripe_event_complete_v1(p_owner_id uuid,p_account text,p_live boolean,p_event_id text,p_claim_token uuid,p_generation integer)
returns table(result text,notification_ids uuid[])
language plpgsql security invoker set search_path='' as $$
declare e public.natori_stripe_event_inbox%rowtype; p public.natori_projects%rowtype;
  q public.natori_quotes%rowtype; prior public.natori_payment_transactions%rowtype;
  outcome record; reason text; ids uuid[]:='{}'; notice uuid; v_purpose text; snap jsonb;
  session_id text; amount integer; quote_id uuid; payment_intent text; notice_session text;
begin
  -- Project first, then inbox. Waiting for a project never grants an expired worker authority.
  select * into e from public.natori_stripe_event_inbox where account_scope=p_account and livemode=p_live and event_id=p_event_id;
  if not found then return query select 'missing'::text,ids; return; end if;
  select * into p from public.natori_projects where id=e.project_id and user_id=p_owner_id for update;
  select * into e from public.natori_stripe_event_inbox where account_scope=p_account and livemode=p_live and event_id=p_event_id for update;
  if e.owner_id is distinct from p_owner_id then return query select 'stale'::text,ids; return; end if;
  if e.status in ('completed','needs_review') then return query select e.status,e.notification_ids; return; end if;
  if e.claim_token is distinct from p_claim_token or e.claim_generation<>p_generation or e.lease_until<=clock_timestamp() then
    return query select 'stale'::text,ids; return;
  end if;
  session_id:=e.request->>'sessionId'; quote_id:=(e.request->>'quoteId')::uuid;
  payment_intent:=e.request->>'paymentIntentId';
  if p.id is null then reason:='project_not_found';
  elsif p_account<>'platform' then reason:='connected_account_unsupported';
  elsif e.request->>'currency'<>'jpy' or e.request->>'currency' is null then reason:='currency_mismatch';
  elsif session_id is null or length(session_id) not between 1 and 200 then reason:='session_missing';
  elsif e.request->>'paymentStatus' is distinct from 'paid' then reason:='payment_not_paid';
  elsif e.request->>'amount' is null or (e.request->>'amount')::numeric<0 or (e.request->>'amount')::numeric>2147483647
    or (e.request->>'amount')::numeric<>trunc((e.request->>'amount')::numeric) then reason:='amount_invalid';
  elsif p.type='undecided' then reason:='project_type_unconfirmed';
  elsif p.payment_quote_id is null then reason:='payment_quote_unset';
  else
    amount:=(e.request->>'amount')::integer;
    select * into q from public.natori_quotes where id=quote_id;
    if q.id is null or q.project_id<>p.id then reason:='quote_unrelated';
    elsif q.accepted_at is null then reason:='quote_not_accepted';
    else
      select * into prior from public.natori_payment_transactions where stripe_session_id=session_id;
      if prior.id is not null and (prior.project_id<>p.id or prior.quote_id is distinct from quote_id or prior.amount<>amount
        or (prior.stripe_account_scope is not null and prior.stripe_account_scope<>p_account)
        or (prior.stripe_livemode is not null and prior.stripe_livemode<>p_live)) then reason:='session_identity_conflict';
      elsif prior.id is not null then
        if prior.status='received' and p.payment_confirmed_at is not null and p.stripe_payment_session_id=session_id then
          reason:=null;
        else reason:='legacy_transaction_review'; end if;
      else
        if amount<>q.amount then
          insert into public.natori_payment_transactions(project_id,quote_id,stripe_session_id,amount,status,received_at,note,
            stripe_account_scope,stripe_livemode,stripe_payment_intent_id)
            values(p.id,q.id,session_id,amount,'amount_mismatch',now(),'accepted_quote_amount_mismatch',p_account,p_live,payment_intent);
          reason:='amount_mismatch';
        else
        -- Preserve the existing quote/amount/session verification and ledger behavior.
        select * into outcome from public.natori_record_stripe_payment(p.id,session_id,amount,quote_id);
        if outcome.result='received' then
          if p.deleted_at is not null or p.status='closed' then
            update public.natori_projects set status=p.status,next_action=p.next_action where id=p.id;
            reason:='terminal_project_payment';
          end if;
        elsif outcome.result<>'already-paid' then reason:=replace(outcome.result,'-','_'); end if;
        update public.natori_payment_transactions set stripe_account_scope=p_account,stripe_livemode=p_live,
          stripe_payment_intent_id=payment_intent where stripe_session_id=session_id and project_id=p.id;
        end if;
      end if;
    end if;
  end if;
  if p.id is not null and p_account='platform' and not (prior.id is not null and prior.stripe_account_scope is null) then
    -- Legacy transaction with unknown mail history never generates inferred replacement mail.
    notice_session:=coalesce(session_id,'event-'||p_event_id);
    snap:=jsonb_strip_nulls(jsonb_build_object('title',p.title,'clientName',p.client_name,'clientEmail',p.client_email,
      'amount',amount,'reviewReason',reason,'sessionId',session_id));
    foreach v_purpose in array case when reason is null then array['payment_received_artist','payment_received_client']
      else array['payment_review_artist'] end loop
      insert into public.natori_notification_jobs(notification_key,project_id,quote_id,purpose,snapshot)
        values('payment/'||p_account||'/'||p_live::text||'/'||notice_session||'/'||v_purpose,p.id,
          case when q.project_id=p.id then q.id else null end,v_purpose,snap)
        on conflict(notification_key,attempt_no) do nothing returning id into notice;
      if notice is null then select j.id into notice from public.natori_notification_jobs j
        where j.notification_key='payment/'||p_account||'/'||p_live::text||'/'||notice_session||'/'||v_purpose order by j.attempt_no desc limit 1; end if;
      ids:=array_append(ids,notice);
    end loop;
  end if;
  update public.natori_stripe_event_inbox set status=case when reason is null then 'completed' else 'needs_review' end,
    result=case when reason is null then 'payment_recorded' else reason end,error_code=reason,notification_ids=ids,
    processed_at=now(),lease_until=null,updated_at=now()
    where account_scope=p_account and livemode=p_live and event_id=p_event_id;
  return query select case when reason is null then 'completed' else 'needs_review' end,ids;
end;
$$;
revoke all on function public.natori_stripe_event_claim_v1(uuid,text,boolean,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.natori_stripe_event_complete_v1(uuid,text,boolean,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.natori_stripe_event_claim_v1(uuid,text,boolean,text,text,jsonb,uuid) to service_role;
grant execute on function public.natori_stripe_event_complete_v1(uuid,text,boolean,text,uuid,integer) to service_role;

create function public.natori_quote_payment_state_v1(p_owner_id uuid,p_project_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('available',true,'confirmedAt',p.payment_confirmed_at,
   'requiresReview',exists(select 1 from public.natori_stripe_event_inbox e where e.owner_id=p_owner_id and e.project_id=p.id and e.status='needs_review'),
   'processing',exists(select 1 from public.natori_stripe_event_inbox e where e.owner_id=p_owner_id and e.project_id=p.id and e.status='processing'))
 from public.natori_projects p where p.id=p_project_id and p.user_id=p_owner_id;
$$;
create function public.natori_payment_attention_v1(p_owner_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(attention)),'[]'::jsonb) from (
   select e.project_id as "projectId",coalesce(p.title,'案件との対応を確認') as title,e.status,e.error_code as "reason",e.updated_at as "updatedAt"
   from public.natori_stripe_event_inbox e left join public.natori_projects p on p.id=e.project_id and p.user_id=p_owner_id
   where e.owner_id=p_owner_id and (e.status='needs_review' or (e.status='processing' and e.lease_until<=now()))
   order by e.updated_at desc limit 100
 ) attention;
$$;
revoke all on function public.natori_quote_payment_state_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.natori_payment_attention_v1(uuid) from public,anon,authenticated;
grant execute on function public.natori_quote_payment_state_v1(uuid,uuid) to service_role;
grant execute on function public.natori_payment_attention_v1(uuid) to service_role;

commit;
