-- P1-12 production preflight/post-deploy checks.
-- Read-only: this file deliberately does not invoke natori_accept_delivery_v1,
-- because that RPC can update a project. Every anomaly count must be 0.

select case
  when count(*) = 1
   and bool_and(pg_get_function_identity_arguments(procedures.oid) = 'p_token_hash text')
   and bool_and(
     pg_get_function_result(procedures.oid) =
       'TABLE(result text, project_id uuid, project_title text, client_name text, accepted_at timestamp with time zone)'
   )
   and bool_and(not procedures.prosecdef)
   and bool_and(procedures.proconfig = array['search_path=""'])
    then 0
  else 1
end as delivery_accept_rpc_contract_anomaly_count
from pg_proc as procedures
join pg_namespace as namespaces on namespaces.oid = procedures.pronamespace
where namespaces.nspname = 'public'
  and procedures.proname = 'natori_accept_delivery_v1';

select count(*) as unauthorized_delivery_accept_rpc_execute_count
from pg_proc as procedures
join pg_namespace as namespaces on namespaces.oid = procedures.pronamespace
cross join lateral aclexplode(
  coalesce(procedures.proacl, acldefault('f', procedures.proowner))
) as acl
where namespaces.nspname = 'public'
  and procedures.proname = 'natori_accept_delivery_v1'
  and acl.privilege_type = 'EXECUTE'
  and acl.grantee <> procedures.proowner
  and coalesce(pg_get_userbyid(acl.grantee), 'PUBLIC') <> 'service_role';

select case
  when to_regprocedure('public.natori_accept_delivery_v1(text)') is not null
   and has_function_privilege(
     'service_role',
     to_regprocedure('public.natori_accept_delivery_v1(text)'),
     'EXECUTE'
   )
   and not has_function_privilege(
     'anon',
     to_regprocedure('public.natori_accept_delivery_v1(text)'),
     'EXECUTE'
   )
   and not has_function_privilege(
     'authenticated',
     to_regprocedure('public.natori_accept_delivery_v1(text)'),
     'EXECUTE'
   )
    then 0
  else 1
end as delivery_accept_rpc_effective_acl_anomaly_count;

select case
  when count(*) = 1 and bool_and(triggers.tgenabled <> 'D') then 0
  else 1
end as delivery_activity_trigger_anomaly_count
from pg_trigger as triggers
join pg_class as relations on relations.oid = triggers.tgrelid
join pg_namespace as namespaces on namespaces.oid = relations.relnamespace
where namespaces.nspname = 'public'
  and relations.relname = 'natori_projects'
  and triggers.tgname = 'trg_natori_projects_record_delivery_activity'
  and not triggers.tgisinternal;

select count(*) as delivery_accept_state_anomaly_count
from public.natori_projects
where (delivery_accepted_at is not null and completed_at is null)
   or (delivery_accepted_at is not null and status <> 'completed')
   or (completed_at is not null and status <> 'completed');

select count(*) as duplicated_delivery_token_hash_group_count
from (
  select delivery_token_hash
  from public.natori_projects
  where delivery_token_hash is not null
  group by delivery_token_hash
  having count(*) > 1
) as duplicates;

select case when count(*) = 1 then 0 else 1 end
  as delivery_accept_migration_history_anomaly_count
from supabase_migrations.schema_migrations
where name = 'natori_accept_delivery_rpc';
