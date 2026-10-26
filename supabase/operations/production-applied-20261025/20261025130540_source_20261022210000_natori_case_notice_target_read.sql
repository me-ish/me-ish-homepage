-- Bounded exact-target reads. Existing 200-series view and all writers remain unchanged.
begin;
create function public.natori_case_admin_notice_read_v1(p_owner uuid,p_project uuid,p_notice uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; j public.natori_notification_jobs%rowtype; latest uuid; v jsonb; n jsonb;
begin
 select * into p from public.natori_projects where id=p_project and user_id=p_owner;
 if not found then return null;end if;
 select * into j from public.natori_notification_jobs where id=p_notice and project_id=p.id;
 if not found then return null;end if;
 select id into latest from public.natori_notification_jobs where project_id=p.id and notification_key=j.notification_key order by attempt_no desc,id limit 1;
 v:=public.natori_case_admin_read_v1(p_owner,p_project);
 n:=jsonb_build_object('id',j.id,'purpose',j.purpose,'status',j.status,'attempt_no',j.attempt_no,'quote_id',j.quote_id,
  'created_at',j.created_at,'sent_at',j.sent_at,'deadline',j.snapshot->>'deadline',
  'retry_candidate',j.id=latest and not exists(select 1 from public.natori_notification_jobs newer where newer.notification_key=j.notification_key and newer.attempt_no>j.attempt_no) and j.status in ('failed','pending')
   and (j.payload is not null or (j.send_started_at is null and j.purpose not in ('quote_issue_client','delivery_issue_client','payment_link_client','consultation_staff','consultation_client')))
   and j.claim_count<8 and j.attempt_no<5 and coalesce(j.lease_expires_at,'-infinity')<=clock_timestamp()
   and coalesce(j.retry_after,'-infinity')<=clock_timestamp() and (j.status='failed' or j.send_started_at is null)
   and public.natori_case_admin_notice_target_v1(p,j));
 return v||jsonb_build_object('complete',false,'notices',jsonb_build_array(n),
  'selectedNotice',jsonb_build_object('id',j.id,'latestId',latest,'isLatest',j.id=latest));
end $$;
create function public.natori_case_reconciliation_notice_read_v1(p_owner uuid,p_project uuid,p_notice uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare j public.natori_notification_jobs%rowtype; v jsonb;
begin
 select n.* into j from public.natori_notification_jobs n join public.natori_projects p on p.id=n.project_id
  where p.id=p_project and p.user_id=p_owner and n.id=p_notice;
 if not found then return jsonb_build_object('result','not_found');end if;
 v:=public.natori_case_reconciliation_v1(p_owner,p_project,'read','{}');
 -- A selected row is not proof that other purposes or the rest of the collection are clear.
 return v||jsonb_build_object('selectedNotice',j.id,'notifications',jsonb_build_array(jsonb_build_object(
  'id',j.id,'purpose',j.purpose,'status',j.status,'attempt_no',j.attempt_no)));
end $$;
revoke all on function public.natori_case_admin_notice_read_v1(uuid,uuid,uuid),public.natori_case_reconciliation_notice_read_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.natori_case_admin_notice_read_v1(uuid,uuid,uuid),public.natori_case_reconciliation_notice_read_v1(uuid,uuid,uuid) to service_role;
commit;
