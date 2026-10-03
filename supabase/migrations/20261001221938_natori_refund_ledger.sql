begin;
-- Phase 2D: immutable refund identity, separately reconciled financial read model.
-- No provider refund calls, project transitions or historical mail backfill.
alter table public.natori_payment_transactions
  add column stripe_charge_id text,
  add column stripe_currency text;
create index natori_payment_charge_idx on public.natori_payment_transactions
  (stripe_account_scope,stripe_livemode,stripe_charge_id) where stripe_charge_id is not null;

create table public.natori_refund_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  account_scope text not null check(length(account_scope) between 1 and 200),
  livemode boolean not null,
  refund_id text not null check(length(refund_id) between 1 and 200),
  transaction_id uuid references public.natori_payment_transactions(id),
  project_id uuid references public.natori_projects(id),
  claimed_project_id uuid,
  payment_intent_id text,
  charge_id text,
  amount bigint,
  currency text,
  provider_status text not null check(provider_status in ('pending','requires_action','succeeded','failed','canceled','unknown')),
  confirmed_at timestamptz,
  source text not null default 'stripe_signed_webhook',
  resolution text not null default 'unmatched' check(resolution in ('unmatched','resolved','needs_review')),
  review_reason text,
  first_event_id text not null,
  latest_event_id text not null,
  provider_event_created bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_scope,livemode,refund_id)
);
create index natori_refunds_project_idx on public.natori_refund_ledger(owner_id,project_id,resolution);
create index natori_refunds_unmatched_intent_idx on public.natori_refund_ledger(account_scope,livemode,payment_intent_id)
  where resolution='unmatched';
create index natori_refunds_unmatched_charge_idx on public.natori_refund_ledger(account_scope,livemode,charge_id)
  where resolution='unmatched';
alter table public.natori_refund_ledger enable row level security;
revoke all on public.natori_refund_ledger from public,anon,authenticated,service_role;
grant select,insert,update on public.natori_refund_ledger to service_role;

alter table public.natori_notification_jobs drop constraint natori_notification_jobs_purpose_check;
alter table public.natori_notification_jobs add constraint natori_notification_jobs_purpose_check check
  (purpose in ('quote_accept_artist','delivery_accept_artist','delivery_accept_client','delivery_issue_client',
   'quote_issue_client','payment_received_artist','payment_received_client','payment_review_artist','payment_link_client',
   'refund_confirmed_artist','refund_review_artist'));

-- Reuse the proven inbox's claim identity/lease fencing. Its payment completion stays intact.
create or replace function public.natori_stripe_event_claim_v1(p_owner_id uuid,p_account text,p_live boolean,p_event_id text,p_type text,p_request jsonb,p_claim_token uuid)
returns table(result text,generation integer,notification_ids uuid[])
language plpgsql security invoker set search_path='' as $$
declare e public.natori_stripe_event_inbox%rowtype;
begin
  if p_claim_token is null or p_live is null or p_request is null or jsonb_typeof(p_request)<>'object'
    or p_type not in ('checkout.session.completed','checkout.session.async_payment_succeeded','refund.created','refund.updated','refund.failed','charge.refund.updated','charge.refunded') then
    raise exception 'invalid_event_claim';
  end if;
  insert into public.natori_stripe_event_inbox(owner_id,account_scope,livemode,event_id,event_type,request,project_id)
    values(p_owner_id,p_account,p_live,p_event_id,p_type,p_request,(p_request->>'projectId')::uuid)
    on conflict(account_scope,livemode,event_id) do nothing;
  select * into e from public.natori_stripe_event_inbox
    where account_scope=p_account and livemode=p_live and event_id=p_event_id for update;
  if e.owner_id is distinct from p_owner_id then return query select 'owner_mismatch'::text,e.claim_generation,e.notification_ids; return; end if;
  if (e.request is distinct from p_request and not (
      p_type in ('checkout.session.completed','checkout.session.async_payment_succeeded')
      and (e.request-'chargeId') is not distinct from (p_request-'chargeId')
      and (e.request->>'chargeId' is null or p_request->>'chargeId' is null
        or e.request->>'chargeId'=p_request->>'chargeId')))
    or e.event_type<>p_type then
    -- Do not replace the recorded request or financial effect with a conflicting delivery.
    update public.natori_stripe_event_inbox set status='needs_review',error_code='event_identity_conflict',
      processed_at=coalesce(processed_at,now()),updated_at=now() where account_scope=p_account and livemode=p_live and event_id=p_event_id;
    return query select 'needs_review'::text,e.claim_generation,e.notification_ids; return;
  end if;
  -- Optional expanded Checkout charge mapping was absent in Phase 2B. Matching core
  -- identity can replay in either gate direction; the original request stays frozen.
  -- Two known different charge IDs, or any changed core field, still conflict above.
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

create function public.natori_refund_reconcile_v1(p_owner_id uuid,p_account text,p_live boolean,p_refund_id text)
returns uuid[] language plpgsql security invoker set search_path='' as $$
declare r public.natori_refund_ledger%rowtype; t public.natori_payment_transactions%rowtype;
  p public.natori_projects%rowtype; candidates integer; reason text; notice uuid;
  ids uuid[]:='{}'; v_purpose text; total bigint; prior_intent text; prior_charge text;
begin
  select * into r from public.natori_refund_ledger
    where account_scope=p_account and livemode=p_live and refund_id=p_refund_id and owner_id=p_owner_id;
  if not found then return ids; end if;
  -- Reentrant Natori-only financial-write guard precedes project/payment/refund locks.
  -- Account/mode serialization covers PI/charge aliases and reverse reconciliation;
  -- it intentionally favors consistent low-volume financial writes over throughput.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('natori-financial/v2/'||p_account||'/'||p_live::text,0));
  prior_intent:=r.payment_intent_id; prior_charge:=r.charge_id;
  perform p0.id from public.natori_projects p0
    where p0.id in (r.project_id,r.claimed_project_id) or exists (
      select 1 from public.natori_payment_transactions t0
      where t0.project_id=p0.id and t0.stripe_account_scope=p_account and t0.stripe_livemode=p_live
        and ((r.payment_intent_id is not null and t0.stripe_payment_intent_id=r.payment_intent_id)
          or (r.charge_id is not null and t0.stripe_charge_id=r.charge_id)))
    order by p0.id for update;

  -- Projects precede payment rows, which precede refund rows. Partial refunds share the original lock.
  perform t0.id from public.natori_payment_transactions t0
    where t0.stripe_account_scope=p_account and t0.stripe_livemode=p_live
      and ((r.payment_intent_id is not null and t0.stripe_payment_intent_id=r.payment_intent_id)
        or (r.charge_id is not null and t0.stripe_charge_id=r.charge_id)) order by t0.id for update;
  select count(*) into candidates from public.natori_payment_transactions t0
    where t0.stripe_account_scope=p_account and t0.stripe_livemode=p_live
      and ((r.payment_intent_id is not null and t0.stripe_payment_intent_id=r.payment_intent_id)
        or (r.charge_id is not null and t0.stripe_charge_id=r.charge_id));
  if candidates=1 then
    select * into t from public.natori_payment_transactions t0
      where t0.stripe_account_scope=p_account and t0.stripe_livemode=p_live
        and ((r.payment_intent_id is not null and t0.stripe_payment_intent_id=r.payment_intent_id)
          or (r.charge_id is not null and t0.stripe_charge_id=r.charge_id));
    select * into p from public.natori_projects where id=t.project_id and user_id=p_owner_id;
  elsif candidates=0 and r.project_id is not null then
    -- An explicit signed Natori hint can expose review on the owner's project, never confirm money.
    select * into p from public.natori_projects where id=r.project_id and user_id=p_owner_id;
  end if;
  select * into r from public.natori_refund_ledger
    where account_scope=p_account and livemode=p_live and refund_id=p_refund_id and owner_id=p_owner_id for update;
  -- If another signed observation enriched identity while this worker waited for a payment lock,
  -- do not acquire a new payment lock after the refund lock. The completing worker/replay reconciles it.
  if r.payment_intent_id is distinct from prior_intent or r.charge_id is distinct from prior_charge then return ids; end if;
  if r.review_reason in ('refund_identity_conflict','refund_state_order_uncertain') then reason:=r.review_reason;
  elsif p_account<>'platform' then reason:='connected_account_unsupported';
  elsif candidates>1 then reason:='payment_identity_conflict';
  elsif candidates=0 then reason:='original_payment_unmatched';
  elsif p.id is null then reason:='payment_owner_mismatch';
  elsif r.claimed_project_id is not null and r.claimed_project_id<>p.id then reason:='refund_project_mismatch';
  elsif t.status<>'received' or t.stripe_session_id is distinct from p.stripe_payment_session_id then reason:='payment_not_original';
  elsif r.payment_intent_id is not null and t.stripe_payment_intent_id is distinct from r.payment_intent_id then reason:='payment_intent_mismatch';
  elsif r.charge_id is not null and t.stripe_charge_id is not null and t.stripe_charge_id<>r.charge_id then reason:='charge_mismatch';
  elsif r.currency is null or t.stripe_currency is null or r.currency<>t.stripe_currency then reason:='refund_currency_mismatch';
  elsif r.amount is null or r.amount<=0 or r.amount>t.amount then reason:='refund_amount_mismatch';
  elsif r.provider_status='unknown' then reason:='refund_status_unknown';
  else
    select coalesce(sum(amount),0) into total from public.natori_refund_ledger
      where transaction_id=t.id and id<>r.id and resolution='resolved' and provider_status='succeeded' and confirmed_at is not null;
    if r.provider_status='succeeded' and total+r.amount>t.amount then reason:='refund_total_exceeds_original'; end if;
  end if;
  update public.natori_refund_ledger set
    transaction_id=case when p.id is not null and (reason is null or reason not in ('payment_identity_conflict','payment_owner_mismatch','refund_project_mismatch')) then t.id else null end,
    project_id=case when p.id is not null and (r.claimed_project_id is null or r.claimed_project_id=p.id) then p.id else r.project_id end,
    resolution=case when reason is null then 'resolved' when reason='original_payment_unmatched' then 'unmatched' else 'needs_review' end,
    review_reason=reason,updated_at=now() where id=r.id;
  if reason is null and t.stripe_charge_id is null and r.charge_id is not null then
    update public.natori_payment_transactions set stripe_charge_id=r.charge_id where id=t.id;
  end if;
  -- One owner notification per refund and purpose, only for an owner-verified project.
  if p.id is not null and (r.claimed_project_id is null or r.claimed_project_id=p.id) then
    v_purpose:=case when reason is not null or r.provider_status in ('failed','canceled') then 'refund_review_artist'
      when r.provider_status='succeeded' then 'refund_confirmed_artist' else null end;
    if v_purpose is not null then
      insert into public.natori_notification_jobs(notification_key,project_id,quote_id,purpose,snapshot)
        values('refund/'||p_account||'/'||p_live::text||'/'||p_refund_id||'/'||v_purpose,p.id,t.quote_id,v_purpose,
          jsonb_strip_nulls(jsonb_build_object('title',p.title,'clientName',p.client_name,'amount',r.amount,
            'currency',r.currency,'refundId',r.refund_id,'providerStatus',r.provider_status,'reviewReason',coalesce(reason,r.provider_status))))
        on conflict(notification_key,attempt_no) do nothing returning id into notice;
      if notice is null then select j.id into notice from public.natori_notification_jobs j
        where j.notification_key='refund/'||p_account||'/'||p_live::text||'/'||p_refund_id||'/'||v_purpose order by j.attempt_no desc limit 1; end if;
      ids:=array_append(ids,notice);
    end if;
  end if;
  return ids;
end;
$$;

create function public.natori_stripe_event_complete_v2(p_owner_id uuid,p_account text,p_live boolean,p_event_id text,p_claim_token uuid,p_generation integer)
returns table(result text,notification_ids uuid[]) language plpgsql security invoker set search_path='' as $$
declare e public.natori_stripe_event_inbox%rowtype; r public.natori_refund_ledger%rowtype;
  t public.natori_payment_transactions%rowtype; p public.natori_projects%rowtype; notice uuid;
  outcome record; item jsonb; ids uuid[]:='{}'; subids uuid[]; reason text; pid uuid;
  event_created bigint; v_refund_id text; new_status text; old_rank integer; new_rank integer;
begin
  select * into e from public.natori_stripe_event_inbox where account_scope=p_account and livemode=p_live and event_id=p_event_id;
  if not found then return query select 'missing'::text,ids; return; end if;
  if e.owner_id is distinct from p_owner_id then return query select 'stale'::text,ids; return; end if;
  -- All v2/direct-reconcile entrypoints take this guard before any row locks.
  -- It also prevents acquiring an extra source/hint project beneath a refund lock
  -- while a different v2 worker owns that project and is awaiting the same ledger.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('natori-financial/v2/'||p_account||'/'||p_live::text,0));
  -- Keep the existing payment identity locks inside the account/mode guard.

  if e.request->>'kind' is distinct from 'refund' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_account||'/'||p_live::text||'/'||coalesce(e.request->>'paymentIntentId',e.request->>'chargeId',e.event_id),0));
    -- Lock every presently relevant project in ID order before v1 takes its project
    -- lock or creates/locks a transaction. Earlier refund hints may differ and must
    -- be covered before reverse reconciliation can request their FK/project locks.
    perform p0.id from public.natori_projects p0
      where p0.id=e.project_id or exists (
        select 1 from public.natori_payment_transactions t0
        where t0.project_id=p0.id and t0.stripe_account_scope=p_account and t0.stripe_livemode=p_live
          and (t0.stripe_session_id=e.request->>'sessionId'
            or t0.stripe_payment_intent_id=e.request->>'paymentIntentId'
            or t0.stripe_charge_id=e.request->>'chargeId'))
        or exists (select 1 from public.natori_refund_ledger l
          where l.owner_id=p_owner_id and l.account_scope=p_account and l.livemode=p_live
            and p0.id in (l.project_id,l.claimed_project_id)
            and (l.payment_intent_id=e.request->>'paymentIntentId' or l.charge_id=e.request->>'chargeId'))
      order by p0.id for update;
    select * into outcome from public.natori_stripe_event_complete_v1(p_owner_id,p_account,p_live,p_event_id,p_claim_token,p_generation);
    if outcome.result not in ('completed','needs_review') then return query select outcome.result,outcome.notification_ids; return; end if;
    select * into e from public.natori_stripe_event_inbox where account_scope=p_account and livemode=p_live and event_id=p_event_id;
    ids:=outcome.notification_ids;
    -- Financial identity is enriched only after a verified successful original payment completion.
    -- A duplicate checkout with contradictory quote/currency/intent/charge cannot rewrite the original.
    if outcome.result='completed' and e.result='payment_recorded' then
      select t0.* into t from public.natori_payment_transactions t0 join public.natori_projects p0 on p0.id=t0.project_id
        where t0.stripe_session_id=e.request->>'sessionId' and t0.project_id=e.project_id and p0.user_id=p_owner_id
          and t0.stripe_account_scope=p_account and t0.stripe_livemode=p_live and t0.status='received'
          and t0.quote_id=(e.request->>'quoteId')::uuid and t0.amount=(e.request->>'amount')::bigint
          and p0.stripe_payment_session_id=t0.stripe_session_id for update of t0;
      if t.id is not null then
        if e.request->>'currency' is distinct from 'jpy' or (t.stripe_currency is not null and t.stripe_currency<>'jpy') then reason:='session_currency_conflict';
        elsif t.stripe_payment_intent_id is not null and e.request->>'paymentIntentId' is not null and t.stripe_payment_intent_id<>e.request->>'paymentIntentId' then reason:='session_payment_intent_conflict';
        elsif t.stripe_charge_id is not null and e.request->>'chargeId' is not null and t.stripe_charge_id<>e.request->>'chargeId' then reason:='session_charge_conflict';
        else
          update public.natori_payment_transactions set stripe_currency=coalesce(stripe_currency,'jpy'),
            stripe_payment_intent_id=coalesce(stripe_payment_intent_id,e.request->>'paymentIntentId'),
            stripe_charge_id=coalesce(stripe_charge_id,e.request->>'chargeId') where id=t.id;
        end if;
      end if;
      if reason is not null then
        select * into p from public.natori_projects where id=t.project_id and user_id=p_owner_id;
        insert into public.natori_notification_jobs(notification_key,project_id,quote_id,purpose,snapshot)
          values('payment/'||p_account||'/'||p_live::text||'/'||t.stripe_session_id||'/payment_review_artist',p.id,t.quote_id,'payment_review_artist',
            jsonb_build_object('title',p.title,'clientName',p.client_name,'amount',t.amount,'reviewReason',reason,'sessionId',t.stripe_session_id))
          on conflict(notification_key,attempt_no) do nothing returning id into notice;
        if notice is null then select j.id into notice from public.natori_notification_jobs j
          where j.notification_key='payment/'||p_account||'/'||p_live::text||'/'||t.stripe_session_id||'/payment_review_artist' order by j.attempt_no desc limit 1; end if;
        ids:=array_append(ids,notice);
        update public.natori_stripe_event_inbox set status='needs_review',result=reason,error_code=reason,notification_ids=ids
          where account_scope=p_account and livemode=p_live and event_id=p_event_id;
        return query select 'needs_review'::text,ids; return;
      end if;
    end if;
    for v_refund_id in select l.refund_id from public.natori_refund_ledger l
      where l.owner_id=p_owner_id and l.account_scope=p_account and l.livemode=p_live
        and outcome.result='completed' and e.result='payment_recorded' and t.id is not null and l.resolution='unmatched'
        and ((l.payment_intent_id is not null and l.payment_intent_id=coalesce(t.stripe_payment_intent_id,e.request->>'paymentIntentId'))
          or (l.charge_id is not null and l.charge_id=coalesce(t.stripe_charge_id,e.request->>'chargeId'))) order by l.refund_id loop
      ids:=ids||public.natori_refund_reconcile_v1(p_owner_id,p_account,p_live,v_refund_id);
    end loop;
    update public.natori_stripe_event_inbox set notification_ids=ids
      where account_scope=p_account and livemode=p_live and event_id=p_event_id;
    return query select outcome.result,ids; return;
  end if;
  -- Sorting identity locks also protects multi-refund charge snapshots from reversed batch deadlocks.
  for item in select value from jsonb_array_elements(e.request->'refunds') order by value->>'refundId' loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_account||'/'||p_live::text||'/'||coalesce(item->>'paymentIntentId',item->>'chargeId',item->>'refundId'),0));
  end loop;
  -- Signed hints, previously retained hints, and all matched source projects precede
  -- transaction/ledger rows. FK checks therefore cannot invert Checkout's order.
  perform p0.id from public.natori_projects p0 where exists (
    select 1 from jsonb_array_elements(e.request->'refunds') i
    left join public.natori_refund_ledger l on l.owner_id=p_owner_id
      and l.account_scope=p_account and l.livemode=p_live and l.refund_id=i->>'refundId'
    where p0.id in ((i->>'projectId')::uuid,l.project_id,l.claimed_project_id)
      or exists (select 1 from public.natori_payment_transactions t0
        where t0.project_id=p0.id and t0.stripe_account_scope=p_account and t0.stripe_livemode=p_live
          and (t0.stripe_payment_intent_id in (i->>'paymentIntentId',l.payment_intent_id)
            or t0.stripe_charge_id in (i->>'chargeId',l.charge_id))))
    order by p0.id for update;
  -- Transaction rows follow projects and precede refund rows, including charge-only events.
  perform t0.id from public.natori_payment_transactions t0
    where t0.stripe_account_scope=p_account and t0.stripe_livemode=p_live and exists
      (select 1 from jsonb_array_elements(e.request->'refunds') i left join public.natori_refund_ledger l
        on l.owner_id=p_owner_id and l.account_scope=p_account and l.livemode=p_live and l.refund_id=i->>'refundId'
       where t0.stripe_payment_intent_id in (i->>'paymentIntentId',l.payment_intent_id)
         or t0.stripe_charge_id in (i->>'chargeId',l.charge_id)) order by t0.id for update;
  select * into e from public.natori_stripe_event_inbox where account_scope=p_account and livemode=p_live and event_id=p_event_id for update;
  if e.owner_id is distinct from p_owner_id then return query select 'stale'::text,ids; return; end if;
  if e.status in ('completed','needs_review') then return query select e.status,e.notification_ids; return; end if;
  if e.claim_token is distinct from p_claim_token or e.claim_generation<>p_generation or e.lease_until<=clock_timestamp() then
    return query select 'stale'::text,ids; return;
  end if;
  event_created:=coalesce((e.request->>'eventCreated')::bigint,0);
  if jsonb_array_length(e.request->'refunds')=0 then reason:='refund_snapshot_missing'; end if;
  if e.request->>'snapshotIncomplete'='true' then reason:='refund_snapshot_incomplete'; end if;
  for item in select value from jsonb_array_elements(e.request->'refunds') order by value->>'refundId' loop
    v_refund_id:=item->>'refundId';
    if v_refund_id is null then reason:='refund_id_missing'; continue; end if;
    pid:=null;
    select p0.id into pid from public.natori_projects p0 where p0.id=(item->>'projectId')::uuid and p0.user_id=p_owner_id;
    new_status:=case when item->>'providerStatus' in ('pending','requires_action','succeeded','failed','canceled') then item->>'providerStatus' else 'unknown' end;
    insert into public.natori_refund_ledger(owner_id,account_scope,livemode,refund_id,project_id,claimed_project_id,
      payment_intent_id,charge_id,amount,currency,provider_status,confirmed_at,first_event_id,latest_event_id,provider_event_created)
      values(p_owner_id,p_account,p_live,v_refund_id,pid,(item->>'projectId')::uuid,item->>'paymentIntentId',item->>'chargeId',
        (item->>'amount')::bigint,item->>'currency',new_status,
        case when new_status='succeeded' then to_timestamp(event_created) else null end,p_event_id,p_event_id,event_created)
      on conflict(account_scope,livemode,refund_id) do nothing;
    select * into r from public.natori_refund_ledger where account_scope=p_account and livemode=p_live and natori_refund_ledger.refund_id=v_refund_id for update;
    if r.owner_id is distinct from p_owner_id then reason:='refund_owner_mismatch'; continue; end if;
    -- Provider snapshots may omit optional identifiers. Only contradictory known values conflict;
    -- monotonic enrichment is safe because the scoped refund ID is immutable and the event is signed.
    if (r.amount is not null and item->>'amount' is not null and r.amount<>(item->>'amount')::bigint)
      or (r.currency is not null and item->>'currency' is not null and r.currency<>item->>'currency')
      or (r.payment_intent_id is not null and item->>'paymentIntentId' is not null and r.payment_intent_id<>item->>'paymentIntentId')
      or (r.charge_id is not null and item->>'chargeId' is not null and r.charge_id<>item->>'chargeId')
      or (r.claimed_project_id is not null and item->>'projectId' is not null and r.claimed_project_id<>(item->>'projectId')::uuid) then
      update public.natori_refund_ledger set resolution='needs_review',review_reason='refund_identity_conflict',updated_at=now() where id=r.id;
      ids:=ids||public.natori_refund_reconcile_v1(p_owner_id,p_account,p_live,v_refund_id);
      reason:='refund_identity_conflict'; continue;
    end if;
    update public.natori_refund_ledger set payment_intent_id=coalesce(payment_intent_id,item->>'paymentIntentId'),
      charge_id=coalesce(charge_id,item->>'chargeId'),claimed_project_id=coalesce(claimed_project_id,(item->>'projectId')::uuid),
      project_id=coalesce(project_id,pid),amount=coalesce(amount,(item->>'amount')::bigint),currency=coalesce(currency,item->>'currency')
      where id=r.id;
    old_rank:=case r.provider_status when 'failed' then 4 when 'canceled' then 4 when 'succeeded' then 3 when 'requires_action' then 2 when 'pending' then 1 else 0 end;
    new_rank:=case new_status when 'failed' then 4 when 'canceled' then 4 when 'succeeded' then 3 when 'requires_action' then 2 when 'pending' then 1 else 0 end;
    if event_created=r.provider_event_created and r.provider_status<>new_status and old_rank>0 and new_rank>0 then
      -- Stripe states are not a total order: requires_action can return to pending,
      -- and a bank return can require action after success. Same-second differing
      -- known states have no trustworthy order; a strictly later observation can
      -- resolve review without erasing the prior confirmation audit timestamp.
      -- Contradictory refund identity is permanent quarantine; later status evidence
      -- can resolve chronological uncertainty but cannot verify the disputed identity.
      update public.natori_refund_ledger set resolution='needs_review',
        review_reason=case when review_reason='refund_identity_conflict' then review_reason else 'refund_state_order_uncertain' end,
        updated_at=now() where id=r.id;
    elsif event_created>r.provider_event_created or (event_created=r.provider_event_created and new_rank>old_rank) then
      update public.natori_refund_ledger set provider_status=new_status,latest_event_id=p_event_id,provider_event_created=event_created,
        confirmed_at=case when new_status='succeeded' then coalesce(confirmed_at,to_timestamp(event_created)) else confirmed_at end,
        review_reason=case when review_reason='refund_state_order_uncertain' then null else review_reason end,
        updated_at=now() where id=r.id;
    end if;
    subids:=public.natori_refund_reconcile_v1(p_owner_id,p_account,p_live,v_refund_id); ids:=ids||subids;
    select * into r from public.natori_refund_ledger where id=r.id;
    if r.resolution<>'resolved' then reason:=coalesce(reason,r.review_reason); end if;
  end loop;
  update public.natori_stripe_event_inbox set status=case when reason is null then 'completed' else 'needs_review' end,
    result=coalesce(reason,'refund_recorded'),error_code=reason,notification_ids=ids,processed_at=now(),lease_until=null,updated_at=now()
    where account_scope=p_account and livemode=p_live and event_id=p_event_id;
  return query select case when reason is null then 'completed' else 'needs_review' end,ids;
end;
$$;

create function public.natori_refund_summaries_v1(p_owner_id uuid,p_project_ids uuid[]) returns table(project_id uuid,summary jsonb)
language sql stable security invoker set search_path='' as $$
  with sources as (
    select p.id,(p.paid_at is not null or p.payment_confirmed_at is not null or p.paid_amount is not null) as known_paid,
      exists(select 1 from public.natori_payment_transactions t where t.project_id=p.id and t.status='received'
        and t.stripe_session_id=p.stripe_payment_session_id
        and t.stripe_account_scope='platform' and t.stripe_livemode is not null and t.stripe_currency='jpy'
        and (t.stripe_payment_intent_id is not null or t.stripe_charge_id is not null)) as original_mapped
    from public.natori_projects p where p.user_id=p_owner_id and p.id=any(p_project_ids)
  )
  select p.id,jsonb_build_object('available',true,'originalMapped',p.original_mapped,
    'confirmedAmount',case when p.known_paid and not p.original_mapped then null else
      coalesce(sum(r.amount) filter(where r.resolution='resolved' and r.provider_status='succeeded' and r.confirmed_at is not null),0) end,
    'pendingCount',count(r.id) filter(where r.provider_status in ('pending','requires_action')),
    'reviewCount',count(r.id) filter(where r.resolution<>'resolved' or r.provider_status in ('failed','canceled','unknown'))
      + case when p.known_paid and not p.original_mapped then 1 else 0 end)
  from sources p left join public.natori_refund_ledger r on r.project_id=p.id and r.owner_id=p_owner_id
  group by p.id,p.known_paid,p.original_mapped;
$$;

-- Keep Phase 2B's inbox-only attention v1 definition and ACL frozen. The server
-- selects this separate refund-aware read model only when refund reading is enabled.
create function public.natori_payment_attention_v2(p_owner_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(attention)),'[]'::jsonb) from (
   select e.project_id as "projectId",coalesce(p.title,'案件との対応を確認') as title,e.status,e.error_code as "reason",e.updated_at as "updatedAt"
   from public.natori_stripe_event_inbox e left join public.natori_projects p on p.id=e.project_id and p.user_id=p_owner_id
   where e.owner_id=p_owner_id and (e.request->>'kind' is distinct from 'refund'
     or e.error_code in ('refund_snapshot_missing','refund_snapshot_incomplete','refund_id_missing','event_identity_conflict')
     or e.status='processing')
     and (e.status='needs_review' or (e.status='processing' and e.lease_until<=now()))
   union all
   select r.project_id,coalesce(p.title,'返金と元の入金の対応を確認'),
     case when r.resolution<>'resolved' or r.provider_status in ('failed','canceled','unknown') then 'needs_review' else 'pending' end,
     coalesce(r.review_reason,'refund_'||r.provider_status),r.updated_at
   from public.natori_refund_ledger r left join public.natori_projects p on p.id=r.project_id and p.user_id=p_owner_id
   where r.owner_id=p_owner_id and (r.resolution<>'resolved' or r.provider_status<>'succeeded')
   union all
   select p.id,p.title,'needs_review','refund_history_unverified',p.updated_at
   from public.natori_projects p where p.user_id=p_owner_id
     and (p.paid_at is not null or p.payment_confirmed_at is not null or p.paid_amount is not null)
     and not exists(select 1 from public.natori_payment_transactions t where t.project_id=p.id and t.status='received'
       and t.stripe_session_id=p.stripe_payment_session_id
       and t.stripe_account_scope='platform' and t.stripe_livemode is not null and t.stripe_currency='jpy'
       and (t.stripe_payment_intent_id is not null or t.stripe_charge_id is not null))
   order by "updatedAt" desc limit 100
 ) attention;
$$;
revoke all on function public.natori_refund_reconcile_v1(uuid,text,boolean,text) from public,anon,authenticated;
revoke all on function public.natori_stripe_event_complete_v2(uuid,text,boolean,text,uuid,integer) from public,anon,authenticated;
revoke all on function public.natori_refund_summaries_v1(uuid,uuid[]) from public,anon,authenticated;
revoke all on function public.natori_payment_attention_v2(uuid) from public,anon,authenticated;
grant execute on function public.natori_refund_reconcile_v1(uuid,text,boolean,text) to service_role;
grant execute on function public.natori_stripe_event_complete_v2(uuid,text,boolean,text,uuid,integer) to service_role;
grant execute on function public.natori_refund_summaries_v1(uuid,uuid[]) to service_role;
grant execute on function public.natori_payment_attention_v2(uuid) to service_role;
commit;
