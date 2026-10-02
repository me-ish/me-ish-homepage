-- Review candidates only. Explicit owner must be supplied by a separate approved
-- read-only run; this Phase does not run against customer data or update rows.
-- psql: -v owner_uuid='<authorized owner UUID>'
begin transaction read only;
select p.id,p.status as stored_status,p.next_action as stored_next_action,
 case when pending.stage='lineart' then 'lineart' when pending.stage='coloring' then 'coloring'
  when pending.stage in ('finish','delivery') or pending.stage is null then 'delivery_prep' else 'rough' end as proposed_status,
 coalesce(pending.label,'納品ファイルを確認して納品通知') as proposed_next_action,
 p.mutation_revision
from public.natori_projects p
left join lateral (select stage,label from public.natori_project_tasks t
 where t.project_id=p.id and t.stage<>'material' and not t.done order by t.sort_order,t.id limit 1) pending on true
where p.user_id=:'owner_uuid'::uuid and p.deleted_at is null
 and p.status in ('rough','lineart','coloring','waiting','delivery_prep') and p.type<>'undecided'
 and p.payment_confirmed_at is not null and p.completed_at is null
 and p.delivery_accepted_at is null and p.delivered_mail_at is null
 and exists(select 1 from public.natori_project_tasks t where t.project_id=p.id and t.stage<>'material')
order by p.id;
rollback;
