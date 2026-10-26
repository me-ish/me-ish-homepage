begin;

-- Admission foundation only. Direct business DML/fact-scoped exceptions are
-- deliberately NOT installed by this migration: see the L7 validation record.
-- A hold is not evidence that a previously admitted request never executed.
create table public.natori_case_system_holds (
 owner_id uuid primary key references auth.users(id),
 generation bigint not null check(generation>0),
 commands_held boolean not null,
 senders_held boolean not null,
 read_only boolean not null,
 changed_at timestamptz not null default clock_timestamp(),
 check(not read_only or (commands_held and senders_held))
);
create table public.natori_case_system_hold_events (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 generation bigint not null,
 action text not null check(action in ('hold','read-only','resume-commands','resume-senders')),
 actor jsonb not null check(jsonb_typeof(actor)='object'),
 created_at timestamptz not null default clock_timestamp(),
 unique(owner_id,generation)
);
alter table public.natori_case_system_holds enable row level security;
alter table public.natori_case_system_hold_events enable row level security;
revoke all on public.natori_case_system_holds,public.natori_case_system_hold_events from public,anon,authenticated,service_role;
grant select on public.natori_case_system_holds,public.natori_case_system_hold_events to service_role;

create function public.natori_case_system_status_v1(p_owner uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('owner',p_owner,'armed',h.owner_id is not null,
  'generation',coalesce(h.generation,0),'commandsHeld',coalesce(h.commands_held,false),
  'sendersHeld',coalesce(h.senders_held,false),'readOnly',coalesce(h.read_only,false))
 from (values(1)) singleton(n) left join public.natori_case_system_holds h on h.owner_id=p_owner
 where p_owner is not null
$$;

-- VOLATILE: a caller waiting on the common lock must see the new state.
-- Call at RPC entry BEFORE row locks. Never put this in a pure read RPC.
create function public.natori_case_system_admit_v1(p_owner uuid,p_kind text)
returns boolean language plpgsql volatile security invoker set search_path='' as $$
declare h public.natori_case_system_holds%rowtype;
begin
 if p_owner is null or p_kind is null or p_kind not in ('command','sender','legacy-sender')
  or current_setting('transaction_isolation')<>'read committed' then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(7261549321761::bigint);
 select * into h from public.natori_case_system_holds where owner_id=p_owner;
 return not (coalesce(h.commands_held,false) and p_kind='command')
  and not (coalesce(h.senders_held,false) and p_kind in ('sender','legacy-sender'))
  and not (h.owner_id is not null and p_kind='legacy-sender');
end $$;

-- Deliberately no HTTP route or UI control yet. The privileged local RPC is
-- CAS/audited; a production rollout must wait for the complete writer fences.
create function public.natori_case_system_control_v1(p_owner uuid,p_action text,p_generation bigint,p_actor jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
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
 insert into public.natori_case_system_hold_events(owner_id,generation,action,actor)
 values(p_owner,g+1,p_action,jsonb_build_object('kind',p_actor->>'kind','userId',p_actor->>'userId'));
 return jsonb_build_object('result','saved','generation',g+1,'priorRequestsMayComplete',true);
end $$;

revoke all on function public.natori_case_system_status_v1(uuid),public.natori_case_system_admit_v1(uuid,text),public.natori_case_system_control_v1(uuid,text,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.natori_case_system_status_v1(uuid),public.natori_case_system_admit_v1(uuid,text),public.natori_case_system_control_v1(uuid,text,bigint,jsonb) to service_role;
commit;
