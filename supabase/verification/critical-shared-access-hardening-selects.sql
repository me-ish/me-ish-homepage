-- Read-only verification for 20260911132256_critical_shared_access_hardening.sql.

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', format('public.%I', c.relname), 'select') as anon_select,
  has_table_privilege('anon', format('public.%I', c.relname), 'insert') as anon_insert,
  has_table_privilege('anon', format('public.%I', c.relname), 'update') as anon_update,
  has_table_privilege('anon', format('public.%I', c.relname), 'delete') as anon_delete,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'select') as authenticated_select,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'insert') as authenticated_insert,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'update') as authenticated_update,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'delete') as authenticated_delete,
  has_table_privilege('service_role', format('public.%I', c.relname), 'select,insert,update,delete') as service_role_crud
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('card_requests', 'aura_projects')
order by c.relname;

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  has_function_privilege('anon', p.oid, 'execute') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'execute') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'admin_mark_sales_paid',
    'finalize_sale',
    'get_auth_user_id_by_email'
  )
order by p.proname, identity_arguments;
