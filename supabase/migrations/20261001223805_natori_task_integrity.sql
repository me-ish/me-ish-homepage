-- Expand only. No customer row correction, acceptance/payment/delivery facts or mail.
begin;
alter table public.natori_projects add column mutation_revision bigint not null default 0 check(mutation_revision between 0 and 9007199254740991);

create function public.natori_project_revision_guard_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 -- Every writer, including payment/receipt/close, participates in UI fencing.
 new.mutation_revision:=old.mutation_revision+1;
 return new;
end; $$;
create trigger natori_project_revision_guard before update on public.natori_projects
for each row execute function public.natori_project_revision_guard_v1();
revoke all on function public.natori_project_revision_guard_v1() from public,anon,authenticated;

create function public.natori_task_projection_v1(p_project public.natori_projects) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'id',(p_project).id,'status',(p_project).status,'nextAction',(p_project).next_action,
  'mutationRevision',(p_project).mutation_revision,
  -- A whole-row revision must carry all row-backed display metadata from this locked row.
  -- Enumerate owner-only administration fields; never expose token/hash/lease columns.
  'title',(p_project).title,'clientName',(p_project).client_name,'clientEmail',(p_project).client_email,
  'amount',(p_project).amount,'type',(p_project).type,'deliveryPlan',(p_project).delivery_plan,
  'priority',(p_project).priority,'startDate',(p_project).start_date,'dueDate',(p_project).due_date,
  'createdAt',(p_project).created_at,'note',(p_project).note,'requestData',(p_project).request_data,
  'paymentConfirmedAt',(p_project).payment_confirmed_at,'paidAt',(p_project).paid_at,
  'paidAmount',(p_project).paid_amount,'completedAt',(p_project).completed_at,
  'deliveryAcceptedAt',(p_project).delivery_accepted_at,'deliveredMailAt',(p_project).delivered_mail_at,
  'deletedAt',(p_project).deleted_at,'tasks',coalesce((select jsonb_agg(jsonb_build_object(
   'id',t.task_key,'label',t.label,'stage',t.stage,'done',t.done,
   'estimatedHours',t.estimated_hours) order by t.sort_order,t.id)
   from public.natori_project_tasks t where t.project_id=(p_project).id),'[]'::jsonb))
$$;
revoke all on function public.natori_task_projection_v1(public.natori_projects) from public,anon,authenticated;
grant execute on function public.natori_task_projection_v1(public.natori_projects) to service_role;

-- Single-statement MVCC snapshot keeps list project/revision and task rows coherent.
-- All rows, including archive rows, are owner-scoped. No hashes leave this RPC unless
-- already present in the existing privileged administration read model.
create function public.natori_project_task_snapshot_v1(p_owner uuid,p_project_ids uuid[] default null) returns jsonb
language sql stable security invoker set search_path='' as $$
 with owned as materialized (
  select p.* from public.natori_projects p where p.user_id=p_owner
   and (p_project_ids is null or p.id=any(p_project_ids))
 )
 select jsonb_build_object(
  'projects',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at,p.id) from owned p),'[]'::jsonb),
  'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by t.project_id,t.sort_order,t.id)
   from public.natori_project_tasks t join owned p on p.id=t.project_id),'[]'::jsonb))
$$;
revoke all on function public.natori_project_task_snapshot_v1(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.natori_project_task_snapshot_v1(uuid,uuid[]) to service_role;

create function public.natori_update_task_v1(p_owner uuid,p_project uuid,p_task_key text,p_done boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; task public.natori_project_tasks%rowtype;
 pending public.natori_project_tasks%rowtype; next_status text; v_next_action text;
begin
 if p_owner is null or p_done is null or p_task_key is null or length(p_task_key)>200 then
  return jsonb_build_object('result','invalid_request'); end if;
 select * into p from public.natori_projects where id=p_project and user_id=p_owner for update;
 if not found then return jsonb_build_object('result','not_found'); end if;
 -- Every task mutation locks the same project first and task rows in stable order.
 perform t.id from public.natori_project_tasks t where t.project_id=p.id order by t.sort_order,t.id for update;
 select * into task from public.natori_project_tasks where project_id=p.id and task_key=p_task_key;
 if not found then return jsonb_build_object('result','not_found'); end if;
 if task.stage not in ('material','rough','lineart','coloring','finish','delivery') then
  return jsonb_build_object('result','invalid_stage','project',public.natori_task_projection_v1(p)); end if;
 if p.deleted_at is not null or p.status in ('completed','closed','delivered')
  or p.completed_at is not null or p.delivery_accepted_at is not null or p.delivered_mail_at is not null
  or p.status not in ('rough','lineart','coloring','waiting','delivery_prep')
  or p.payment_confirmed_at is null or p.type='undecided' then
  return jsonb_build_object('result','conflict','project',public.natori_task_projection_v1(p)); end if;
 if task.done=p_done then
  return jsonb_build_object('result','unchanged','project',public.natori_task_projection_v1(p)); end if;
 update public.natori_project_tasks set done=p_done where id=task.id;
 -- Fresh DB tasks, not client status/next_action, determine the production projection.
 -- Legacy material rows are hidden in the administration UI. Preserve their raw
 -- flags/history, but do not let a hidden unchecked row pin editable production.
 select * into pending from public.natori_project_tasks where project_id=p.id and stage<>'material' and not done order by sort_order,id limit 1;
 if not found then
  next_status:='delivery_prep'; v_next_action:='納品ファイルを確認して納品通知';
 else
  next_status:=case pending.stage when 'material' then 'rough' when 'rough' then 'rough'
   when 'lineart' then 'lineart' when 'coloring' then 'coloring'
   when 'finish' then 'delivery_prep' when 'delivery' then 'delivery_prep' else null end;
  if next_status is null then raise exception 'invalid_task_stage'; end if;
  v_next_action:=pending.label;
 end if;
 update public.natori_projects set status=next_status,next_action=v_next_action where id=p.id returning * into p;
 -- No completed_at, delivered_mail_at, receipt, payment or quote field is written.
 return jsonb_build_object('result','applied','project',public.natori_task_projection_v1(p));
end; $$;
revoke all on function public.natori_update_task_v1(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.natori_update_task_v1(uuid,uuid,text,boolean) to service_role;

-- Keep deployed legacy callers safe. Their stale projection parameters are ignored.
create or replace function public.natori_update_task_and_status(
 p_user_id uuid,p_project_id uuid,p_task_key text,p_done boolean,p_status text,p_next_action text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare outcome jsonb;
begin
 outcome:=public.natori_update_task_v1(p_user_id,p_project_id,p_task_key,p_done);
 return outcome->>'result' in ('applied','unchanged');
end; $$;
revoke all on function public.natori_update_task_and_status(uuid,uuid,text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.natori_update_task_and_status(uuid,uuid,text,boolean,text,text) to service_role;
commit;
