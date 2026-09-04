-- Etorie P1-04 read-only security verification.
-- Run only against an approved isolated verification project after its schema
-- has been applied. Every executable statement in this file is SELECT-only.

-- 1. Natori bucket privacy and bucket-level validation contract.
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id in (
  'natori-inquiry-refs',
  'natori-deliveries',
  'natori-portfolio'
)
order by id;

-- 2. All storage.objects policies that can affect writes to the audited
-- buckets. Review roles, command, USING, and WITH CHECK together.
select
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    coalesce(qual, '') ilike '%natori-inquiry-refs%'
    or coalesce(with_check, '') ilike '%natori-inquiry-refs%'
    or coalesce(qual, '') ilike '%natori-deliveries%'
    or coalesce(with_check, '') ilike '%natori-deliveries%'
    or coalesce(qual, '') ilike '%natori-portfolio%'
    or coalesce(with_check, '') ilike '%natori-portfolio%'
  )
order by policyname;

-- 3. A nonzero result is a release blocker: a bucket-agnostic true predicate
-- can authorize writes without a bucket/path boundary.
select count(*) as broad_storage_write_policy_count
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and cmd in ('ALL', 'INSERT', 'UPDATE')
  and (
    lower(regexp_replace(coalesce(qual, ''), '\s+', '', 'g')) in ('true', '(true)')
    or lower(regexp_replace(coalesce(with_check, ''), '\s+', '', 'g'))
      in ('true', '(true)')
  );

-- 4. Base table grants do not grant bucket-specific access, but they are part
-- of the complete Storage authorization picture and must be reviewed with RLS.
select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'storage'
  and table_name = 'objects'
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by grantee, privilege_type;

-- 5. processed_stripe_events must have RLS enabled.
select
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'processed_stripe_events'
  and c.relkind in ('r', 'p');

-- 6. Direct ACL detail. Expected result: service_role has SELECT, INSERT,
-- DELETE only; PUBLIC, anon, and authenticated have no rows. This catalog
-- expansion includes PUBLIC grants (information_schema.role_table_grants does
-- not), so it is suitable for diagnosing a failed equality check below.
select
  case
    when acl.grantee = 0 then 'PUBLIC'
    else pg_get_userbyid(acl.grantee)
  end as grantee,
  acl.privilege_type,
  acl.is_grantable
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(
  coalesce(c.relacl, acldefault('r', c.relowner))
) acl
where n.nspname = 'public'
  and c.relname = 'processed_stripe_events'
  and c.relkind in ('r', 'p')
  and (
    acl.grantee = 0
    or pg_get_userbyid(acl.grantee) in ('anon', 'authenticated', 'service_role')
  )
order by grantee, privilege_type;

-- 7. Expected result: true. Check all seven table privileges as effective
-- privileges so grants inherited from PUBLIC or another role cannot false-green.
-- service_role must have SELECT, INSERT, DELETE and no other table privilege;
-- anon and authenticated must have none. PUBLIC must also have no direct grant.
select
  bool_and(
    has_table_privilege(
      roles.role_name::name,
      'public.processed_stripe_events',
      privileges.privilege_name
    ) = (
      roles.role_name = 'service_role'
      and privileges.privilege_name in ('SELECT', 'INSERT', 'DELETE')
    )
  )
  and not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(
      coalesce(c.relacl, acldefault('r', c.relowner))
    ) acl
    where n.nspname = 'public'
      and c.relname = 'processed_stripe_events'
      and c.relkind in ('r', 'p')
      and acl.grantee = 0
  ) as processed_stripe_events_privileges_exact
from (
  values ('service_role'), ('anon'), ('authenticated')
) as roles(role_name)
cross join (
  values
    ('SELECT'),
    ('INSERT'),
    ('UPDATE'),
    ('DELETE'),
    ('TRUNCATE'),
    ('REFERENCES'),
    ('TRIGGER')
) as privileges(privilege_name);

-- 8. No policy is required for the service-role webhook path. Any row here
-- needs review; adding a permissive policy merely to silence Advisor is unsafe.
select
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'processed_stripe_events'
order by policyname;

-- 9. Function identity, owner, SECURITY DEFINER flag, fixed configuration,
-- ACL, and body. The body must update deleted_at and contain no physical delete.
select
  n.nspname as function_schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_userbyid(p.proowner) as owner_name,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  p.proacl as function_acl,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'natori_delete_project'
  and pg_get_function_identity_arguments(p.oid) = 'p_user_id uuid, p_project_id uuid';

-- 10. Expanded function EXECUTE ACL. Expected effective grantees are the
-- function owner and service_role.
select
  case
    when acl.grantee = 0 then 'PUBLIC'
    else pg_get_userbyid(acl.grantee)
  end as grantee,
  acl.privilege_type,
  acl.is_grantable
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(
  coalesce(p.proacl, acldefault('f', p.proowner))
) acl
where n.nspname = 'public'
  and p.proname = 'natori_delete_project'
  and pg_get_function_identity_arguments(p.oid) = 'p_user_id uuid, p_project_id uuid'
order by grantee, acl.privilege_type;

-- 11. A nonzero result is a release blocker. The function owner is derived
-- dynamically from pg_proc.proowner; no owner role name is hard-coded.
select count(*) as unauthorized_delete_project_execute_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(
  coalesce(p.proacl, acldefault('f', p.proowner))
) acl
where n.nspname = 'public'
  and p.proname = 'natori_delete_project'
  and pg_get_function_identity_arguments(p.oid) = 'p_user_id uuid, p_project_id uuid'
  and acl.privilege_type = 'EXECUTE'
  and acl.grantee <> p.proowner
  and coalesce(pg_get_userbyid(acl.grantee), 'PUBLIC') <> 'service_role';
