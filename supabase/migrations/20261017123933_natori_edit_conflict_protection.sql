-- Q03: owner-scoped, atomic compare-and-swap for human edits. No customer backfill.
begin;
create function public.natori_project_edit_snapshot_v1(p public.natori_projects) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',(p).id,'mutationRevision',(p).mutation_revision,
  'clientName',(p).client_name,'title',(p).title,'type',(p).type,'amount',(p).amount,
  'deliveryPlan',(p).delivery_plan,'startDate',(p).start_date,'dueDate',(p).due_date,
  'note',(p).note,'nextAction',(p).next_action)
$$;
revoke all on function public.natori_project_edit_snapshot_v1(public.natori_projects) from public,anon,authenticated;
grant execute on function public.natori_project_edit_snapshot_v1(public.natori_projects) to service_role;

create function public.natori_edit_project_v1(p_owner uuid,p_project uuid,p_expected_revision bigint,p_patch jsonb,p_next_action text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; confirmation record; k text; v jsonb;
begin
 if p_owner is null or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>9007199254740991
  or p_patch is null or jsonb_typeof(p_patch)<>'object' then
  return jsonb_build_object('result','invalid_request'); end if;
 -- Validate the entire payload before any type/task write.
 for k,v in select * from jsonb_each(p_patch) loop
  if k not in ('client_name','title','type','amount','delivery_plan','start_date','due_date','note') then
   return jsonb_build_object('result','invalid_request'); end if;
  if k in ('client_name','title') and (jsonb_typeof(v)<>'string' or length(btrim(v#>>'{}'))=0) then
   return jsonb_build_object('result','invalid_request'); end if;
  if k='type' and (jsonb_typeof(v)<>'string' or v#>>'{}' not in ('icon','sd','standing','illustration')) then
   return jsonb_build_object('result','invalid_type'); end if;
  if k='amount' and v<>'null'::jsonb then
   if jsonb_typeof(v)<>'number' then return jsonb_build_object('result','invalid_request'); end if;
   if (v#>>'{}')::numeric<0 or (v#>>'{}')::numeric>9007199254740991 or trunc((v#>>'{}')::numeric)<>(v#>>'{}')::numeric then
    return jsonb_build_object('result','invalid_request'); end if;
  end if;
  if k='delivery_plan' and (jsonb_typeof(v)<>'string' or v#>>'{}' not in ('normal','rush_14_days','rush_7_days')) then
   return jsonb_build_object('result','invalid_request'); end if;
  if k in ('start_date','due_date') and v<>'null'::jsonb then
   if jsonb_typeof(v)<>'string' or (v#>>'{}')!~'^\d{4}-\d{2}-\d{2}$' then
    return jsonb_build_object('result','invalid_request'); end if;
   -- Date cast intentionally raises on impossible dates, rolling back the transaction.
   perform (v#>>'{}')::date;
  end if;
  if k='note' and jsonb_typeof(v) not in ('string','null') then return jsonb_build_object('result','invalid_request'); end if;
 end loop;
 if p_patch='{}'::jsonb and p_next_action is null then return jsonb_build_object('result','invalid_request'); end if;
 select * into p from public.natori_projects where id=p_project and user_id=p_owner and deleted_at is null for update;
 if not found then return jsonb_build_object('result','not_found'); end if;
 if p.mutation_revision<>p_expected_revision then
  return jsonb_build_object('result','edit_conflict','project',public.natori_project_edit_snapshot_v1(p)); end if;
 -- Dedicated inquiry correction only; never bypass production/payment/receipt guards.
 if p_next_action is not null and (length(p_next_action)>120 or p.status not in ('inquiry','estimating','consulting','quoted','awaiting_payment') or p.payment_confirmed_at is not null) then
  return jsonb_build_object('result','invalid_next_action'); end if;
 if p_patch ? 'type' and p.type<>(p_patch->>'type') then
  select * into confirmation from public.natori_confirm_project_type_v1(p_owner,p_project,p_patch->>'type');
  if confirmation.result not in ('confirmed','already_confirmed') then return jsonb_build_object('result','invalid_type'); end if;
 end if;
 -- Failures after type confirmation must raise, never return, so tasks and type roll back.
 update public.natori_projects set
  client_name=case when p_patch?'client_name' then p_patch->>'client_name' else client_name end,
  title=case when p_patch?'title' then p_patch->>'title' else title end,
  amount=case when p_patch?'amount' then (p_patch->>'amount')::integer else amount end,
  delivery_plan=case when p_patch?'delivery_plan' then p_patch->>'delivery_plan' else delivery_plan end,
  start_date=case when p_patch?'start_date' then (p_patch->>'start_date')::date else start_date end,
  due_date=case when p_patch?'due_date' then (p_patch->>'due_date')::date else due_date end,
  note=case when p_patch?'note' then p_patch->>'note' else note end,
  next_action=coalesce(p_next_action,next_action)
 where id=p.id returning * into p;
 return jsonb_build_object('result','applied','project',public.natori_task_projection_v1(p));
end; $$;
revoke all on function public.natori_edit_project_v1(uuid,uuid,bigint,jsonb,text) from public,anon,authenticated;
grant execute on function public.natori_edit_project_v1(uuid,uuid,bigint,jsonb,text) to service_role;

alter table public.natori_user_profiles add column mutation_revision bigint not null default 0 check(mutation_revision between 0 and 9007199254740991);
create trigger natori_profile_revision_guard before update on public.natori_user_profiles
for each row execute function public.natori_project_revision_guard_v1();

create function public.natori_edit_profile_v1(p_owner uuid,p_expected_revision bigint,p_patch jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.natori_user_profiles%rowtype; k text; v jsonb;
begin
 if p_owner is null or (p_expected_revision is not null and (p_expected_revision<0 or p_expected_revision>9007199254740991))
  or p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then return jsonb_build_object('result','invalid_request'); end if;
 for k,v in select * from jsonb_each(p_patch) loop
  if k not in ('handle','display_name','portfolio_url','links_url','daily_capacity_hours') then return jsonb_build_object('result','invalid_request'); end if;
  if k='daily_capacity_hours' and v<>'null'::jsonb then
   if jsonb_typeof(v)<>'number' then return jsonb_build_object('result','invalid_request'); end if;
   if (v#>>'{}')::numeric<0 or (v#>>'{}')::numeric>24 then return jsonb_build_object('result','invalid_request'); end if;
  elsif k<>'daily_capacity_hours' and jsonb_typeof(v) not in ('string','null') then return jsonb_build_object('result','invalid_request'); end if;
 end loop;
 if p_expected_revision is null then
  insert into public.natori_user_profiles(user_id,handle,display_name,portfolio_url,links_url,daily_capacity_hours)
   values(p_owner,p_patch->>'handle',p_patch->>'display_name',p_patch->>'portfolio_url',p_patch->>'links_url',(p_patch->>'daily_capacity_hours')::numeric)
   on conflict(user_id) do nothing returning * into p;
 else
  update public.natori_user_profiles set
   handle=case when p_patch?'handle' then p_patch->>'handle' else handle end,
   display_name=case when p_patch?'display_name' then p_patch->>'display_name' else display_name end,
   portfolio_url=case when p_patch?'portfolio_url' then p_patch->>'portfolio_url' else portfolio_url end,
   links_url=case when p_patch?'links_url' then p_patch->>'links_url' else links_url end,
   daily_capacity_hours=case when p_patch?'daily_capacity_hours' then (p_patch->>'daily_capacity_hours')::numeric else daily_capacity_hours end
   where user_id=p_owner and mutation_revision=p_expected_revision returning * into p;
 end if;
 if not found then return jsonb_build_object('result','edit_conflict'); end if;
 return jsonb_build_object('result','applied','profile',jsonb_build_object('user_id',p.user_id,'handle',p.handle,'display_name',p.display_name,
  'portfolio_url',p.portfolio_url,'links_url',p.links_url,'daily_capacity_hours',p.daily_capacity_hours,'mutation_revision',p.mutation_revision));
end; $$;
revoke all on function public.natori_edit_profile_v1(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.natori_edit_profile_v1(uuid,bigint,jsonb) to service_role;

-- Compatibility close path appends against the locked current note, never an earlier read.
create function public.natori_close_project_with_note_v1(p_owner uuid,p_project uuid,p_from_status text,p_entry text) returns boolean
language sql security invoker set search_path='' as $$
 with changed as (update public.natori_projects set status='closed',next_action='',
  note=case when p_entry='' then note when coalesce(note,'')='' then p_entry else note||E'\n\n'||p_entry end
  where id=p_project and user_id=p_owner and deleted_at is null and status=p_from_status
   and status in ('inquiry','estimating','consulting','quoted','awaiting_payment')
  returning id) select exists(select 1 from changed)
$$;
revoke all on function public.natori_close_project_with_note_v1(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.natori_close_project_with_note_v1(uuid,uuid,text,text) to service_role;
commit;
