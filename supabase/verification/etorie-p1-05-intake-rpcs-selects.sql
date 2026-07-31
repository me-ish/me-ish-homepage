-- Etorie P1-05 read-only intake RPC verification.
-- Run only against an approved isolated verification project after migration
-- application. Every executable statement in this file is SELECT-only.

-- 1. New public RPC identities, owners, definer flags, fixed configuration,
-- ACLs, result definitions, and bodies.
select
  n.nspname as function_schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_result(p.oid) as function_result,
  pg_get_userbyid(p.proowner) as owner_name,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  p.proconfig is not distinct from array['search_path=""']::text[]
    as empty_search_path_exact,
  p.proacl as function_acl,
  pg_get_functiondef(p.oid) as function_definition
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'natori_create_project_with_tasks_v2',
    'natori_confirm_project_type_v1'
  )
order by p.proname, identity_arguments;

-- 2. Expanded EXECUTE ACL. Expected explicit/effective grantees are the
-- function owner and service_role only.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  case
    when acl.grantee = 0 then 'PUBLIC'
    else pg_get_userbyid(acl.grantee)
  end as grantee,
  acl.privilege_type,
  acl.is_grantable
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(
  coalesce(p.proacl, acldefault('f', p.proowner))
) acl
where n.nspname = 'public'
  and p.proname in (
    'natori_create_project_with_tasks_v2',
    'natori_confirm_project_type_v1'
  )
order by p.proname, grantee;

-- 3. Expected result: zero. The owner is derived dynamically rather than
-- hard-coded; every non-owner grantee other than service_role is unauthorized.
select count(*) as unauthorized_intake_rpc_execute_count
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(
  coalesce(p.proacl, acldefault('f', p.proowner))
) acl
where n.nspname = 'public'
  and p.proname in (
    'natori_create_project_with_tasks_v2',
    'natori_confirm_project_type_v1'
  )
  and acl.privilege_type = 'EXECUTE'
  and acl.grantee <> p.proowner
  and coalesce(pg_get_userbyid(acl.grantee), 'PUBLIC') <> 'service_role';

-- 4. Expected result: true for all combinations. service_role can execute
-- both RPCs; anon and authenticated cannot, including through PUBLIC.
select
  roles.role_name,
  functions.function_identity,
  has_function_privilege(
    roles.role_name::name,
    functions.function_identity,
    'EXECUTE'
  ) = (roles.role_name = 'service_role') as execute_privilege_exact
from (
  values ('service_role'), ('anon'), ('authenticated')
) as roles(role_name)
cross join (
  values
    (
      'public.natori_create_project_with_tasks_v2(uuid,uuid,text,text,jsonb,jsonb,jsonb)'
    ),
    ('public.natori_confirm_project_type_v1(uuid,uuid,text)')
) as functions(function_identity)
order by roles.role_name, functions.function_identity;

-- 5. Internal helpers must remain owner-only and non-definer. A nonzero
-- unauthorized count is a release blocker.
select count(*) as unauthorized_intake_helper_execute_count
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'natori_request_text_is_valid_v1',
    'natori_jsonb_has_exact_keys_v1',
    'natori_request_data_is_valid_v1',
    'natori_project_task_template_v1'
  )
  and (
    p.prosecdef
    or p.proconfig is distinct from array['search_path=""']::text[]
    or exists (
      select 1
      from aclexplode(
        coalesce(p.proacl, acldefault('f', p.proowner))
      ) acl
      where acl.privilege_type = 'EXECUTE'
        and acl.grantee <> p.proowner
    )
  );

-- 6. Exact task-template rows. Review against the application template before
-- any type-confirm smoke test; this SELECT performs no writes.
select
  requested_type as project_type,
  template.task_key,
  template.label,
  template.stage,
  template.estimated_hours,
  template.done,
  template.sort_order
from unnest(array['icon', 'sd', 'standing', 'illustration']::text[])
  as project_types(requested_type)
cross join lateral public.natori_project_task_template_v1(requested_type)
  as template
order by project_type, template.sort_order;

-- 7. Expected result: each type has exactly six distinct template keys.
select
  requested_type as project_type,
  count(*) as template_count,
  count(distinct template.task_key) as distinct_task_key_count,
  count(*) = 6
    and count(distinct template.task_key) = 6
    as template_identity_valid
from unnest(array['icon', 'sd', 'standing', 'illustration']::text[])
  as project_types(requested_type)
cross join lateral public.natori_project_task_template_v1(requested_type)
  as template
group by requested_type
order by requested_type;

-- 8. Old rollback-compatible RPC evidence. Keep this hash with the review
-- evidence and compare it before/after P1-05; the P1-05 migration must not
-- redefine or drop this identity.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  encode(
    extensions.digest(convert_to(p.prosrc, 'UTF8'), 'sha256'),
    'hex'
  ) as function_body_sha256,
  p.proacl as function_acl
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'natori_create_project_with_tasks'
  and pg_get_function_identity_arguments(p.oid) =
    'p_user_id uuid, p_project jsonb, p_tasks jsonb, p_reference_paths jsonb';

-- 9. Current data-level duplicate evidence. Both expected counts are zero;
-- the unique constraints remain defense in depth for concurrent callers.
select
  (
    select count(*)
    from (
      select tasks.project_id, tasks.task_key
      from public.natori_project_tasks as tasks
      group by tasks.project_id, tasks.task_key
      having count(*) > 1
    ) as duplicate_tasks
  ) as duplicate_project_task_key_groups,
  (
    select count(*)
    from (
      select links.project_id, links.normalized_url
      from public.natori_project_reference_links as links
      group by links.project_id, links.normalized_url
      having count(*) > 1
    ) as duplicate_links
  ) as duplicate_project_normalized_url_groups;

-- 10. Active history evidence for the P1-05 lane. This query is read-only and
-- does not repair or otherwise mutate migration history.
select version, name
from supabase_migrations.schema_migrations
where version in (
  '20260723111730',
  '20260723111741',
  '20260729115313',
  '20260729115323',
  '20260731111025',
  '20260731115652'
)
order by version;

-- 11. Exact-key helper truth table. Expected result: true. This proves the
-- supported key-enumeration path accepts only the exact object key set and
-- safely returns false for missing/extra keys, non-objects, and SQL NULL.
select
  public.natori_jsonb_has_exact_keys_v1(
    '{"a": 1, "b": 2}'::jsonb,
    array['a', 'b']::text[]
  ) is true
  and public.natori_jsonb_has_exact_keys_v1(
    '{}'::jsonb,
    array[]::text[]
  ) is true
  and public.natori_jsonb_has_exact_keys_v1(
    '{"a": 1}'::jsonb,
    array['a', 'b']::text[]
  ) is false
  and public.natori_jsonb_has_exact_keys_v1(
    '{"a": 1, "b": 2, "c": 3}'::jsonb,
    array['a', 'b']::text[]
  ) is false
  and public.natori_jsonb_has_exact_keys_v1(
    '[]'::jsonb,
    array[]::text[]
  ) is false
  and public.natori_jsonb_has_exact_keys_v1(
    'null'::jsonb,
    array[]::text[]
  ) is false
  and public.natori_jsonb_has_exact_keys_v1(
    null::jsonb,
    array['a']::text[]
  ) is false
  and public.natori_jsonb_has_exact_keys_v1(
    '{"a": 1}'::jsonb,
    null::text[]
  ) is false
  as exact_key_helper_contract_ok;
