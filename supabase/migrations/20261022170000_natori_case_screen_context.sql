-- Workspace-only source/plan reads and versioned source-link/memo commands. No backfill or provider operation.
begin;
create function public.natori_case_context_revision_v1(p_project uuid) returns text
language sql stable security invoker set search_path='' as $$
 select encode(sha256(convert_to(jsonb_build_array(public.natori_case_work_revision_v1(p_project),
  coalesce((select jsonb_agg(to_jsonb(l) order by l.sort_order,l.created_at,l.id)
   from public.natori_project_reference_links l where l.project_id=p_project),'[]'::jsonb))::text,'UTF8')),'hex')
$$;

create function public.natori_case_context_read_v1(p_owner uuid,p_project uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('project',public.natori_task_projection_v1(p),'revision',public.natori_case_context_revision_v1(p.id),
  'links',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'url',l.url,'label',l.label,'sortOrder',l.sort_order,'createdAt',l.created_at)
   order by l.sort_order,l.created_at,l.id) from public.natori_project_reference_links l where l.project_id=p.id),'[]'::jsonb),
  'files',coalesce((select jsonb_agg(jsonb_build_object('path',r.storage_path) order by r.created_at,r.id)
   from public.natori_inquiry_reference_files r where r.project_id=p.id),'[]'::jsonb))
 from public.natori_projects p where p.user_id=p_owner and p.id=p_project
$$;

create function public.natori_case_planning_read_v1(p_owner uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'updatedAt',p.updated_at,
  'startDate',p.start_date,'dueDate',p.due_date,'deliveryPlan',p.delivery_plan,'priority',p.priority,
  'status',p.status,'type',p.type,'archivedAt',p.deleted_at,
  'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'label',t.label,'stage',t.stage,'done',t.done,'estimatedHours',t.estimated_hours)
   order by t.sort_order,t.id) from public.natori_project_tasks t where t.project_id=p.id),'[]'::jsonb)) order by p.id),'[]'::jsonb)
 from public.natori_projects p where p.user_id=p_owner
$$;

-- Reference writers share the parent's lock. Existing row contents and public-intake contract stay intact.
create function public.natori_case_reference_lock_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.project_id is distinct from old.project_id then raise exception 'reference_project_immutable';end if;
 perform 1 from public.natori_projects where id=case when tg_op='DELETE' then old.project_id else new.project_id end for update;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger natori_case_reference_lock before insert or update or delete on public.natori_project_reference_links
for each row execute function public.natori_case_reference_lock_v1();

create function public.natori_case_context_command_v1(p_owner uuid,p_operation uuid,p_project uuid,p_command text,p_revision text,p_input jsonb,p_operator jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; old public.natori_case_admin_operations%rowtype; h text; r jsonb; affected integer;
begin
 if p_owner is null or p_project is null or p_operation is null or p_command not in ('intake-memo','reference-link')
  or jsonb_typeof(p_input) is distinct from 'object' or length(p_input::text)>10000
  or coalesce(p_operator->>'kind','') not in ('auth-user','shared-key') then raise exception 'case_context_invalid';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||'/'||p_operation::text,0));
 h:=encode(sha256(convert_to(jsonb_build_array(p_project,p_command,p_revision,p_input)::text,'UTF8')),'hex');
 select * into old from public.natori_case_admin_operations where owner_id=p_owner and id=p_operation;
 if found then return case when old.request_hash=h then old.response||jsonb_build_object('replayed',true) else jsonb_build_object('result','conflict') end;end if;
 select * into p from public.natori_projects where id=p_project and user_id=p_owner for update;
 if not found then return jsonb_build_object('result','not_found');end if;
 if p_revision is distinct from public.natori_case_context_revision_v1(p.id) then return jsonb_build_object('result','stale');end if;
 if p.deleted_at is not null or p.status='closed' then return jsonb_build_object('result','inactive');end if;
 if p_command='intake-memo' then
  if length(coalesce(p_input->>'text',''))>120 then return jsonb_build_object('result','invalid');end if;
  update public.natori_projects set next_action=coalesce(p_input->>'text','') where id=p.id;
 else
  if p_input->>'mode' not in ('add','edit','remove') then return jsonb_build_object('result','invalid');end if;
  if p_input->>'mode'<>'remove' then
   if coalesce(p_input->>'url','')!~'^https://' or length(p_input->>'url')>2048
    or coalesce(p_input->>'normalizedUrl','')!~'^https://' or length(p_input->>'normalizedUrl')>2048
    or length(coalesce(p_input->>'label',''))>100 then return jsonb_build_object('result','invalid');end if;
   if exists(select 1 from public.natori_project_reference_links where project_id=p.id and normalized_url=p_input->>'normalizedUrl'
    and id is distinct from (p_input->>'linkId')::uuid) then return jsonb_build_object('result','duplicate');end if;
  end if;
  if p_input->>'mode'='add' then
   if (select count(*) from public.natori_project_reference_links where project_id=p.id)>=5 then return jsonb_build_object('result','link_limit');end if;
   insert into public.natori_project_reference_links(project_id,url,normalized_url,label,provider,sort_order)
   values(p.id,p_input->>'url',p_input->>'normalizedUrl',nullif(p_input->>'label',''),null,
    coalesce((select max(sort_order)+1 from public.natori_project_reference_links where project_id=p.id),0));
  elsif p_input->>'mode'='edit' then
   update public.natori_project_reference_links set url=p_input->>'url',normalized_url=p_input->>'normalizedUrl',label=nullif(p_input->>'label','')
    where project_id=p.id and id=(p_input->>'linkId')::uuid;
   get diagnostics affected=row_count;if affected<>1 then return jsonb_build_object('result','not_found');end if;
  else
   delete from public.natori_project_reference_links where project_id=p.id and id=(p_input->>'linkId')::uuid;
   get diagnostics affected=row_count;if affected<>1 then return jsonb_build_object('result','not_found');end if;
  end if;
 end if;
 r:=jsonb_build_object('result','applied','projectId',p.id);
 insert into public.natori_case_admin_operations(owner_id,id,project_id,command,request_hash,operator,response)
 values(p_owner,p_operation,p.id,p_command,h,p_operator,r);
 return r||jsonb_build_object('replayed',false);
end $$;
revoke all on function public.natori_case_context_revision_v1(uuid),public.natori_case_context_read_v1(uuid,uuid),public.natori_case_planning_read_v1(uuid),public.natori_case_context_command_v1(uuid,uuid,uuid,text,text,jsonb,jsonb),public.natori_case_reference_lock_v1() from public,anon,authenticated;
grant execute on function public.natori_case_context_revision_v1(uuid),public.natori_case_context_read_v1(uuid,uuid),public.natori_case_planning_read_v1(uuid),public.natori_case_context_command_v1(uuid,uuid,uuid,text,text,jsonb,jsonb) to service_role;
commit;
