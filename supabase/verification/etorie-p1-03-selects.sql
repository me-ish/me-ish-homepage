-- Etorie P1-03 read-only verification.
--
-- Run the first query before and after migration application and compare the
-- row counts. Run all remaining queries only after both P1-03 migrations.
-- Every executable statement in this file is SELECT-only.

select
  'natori_projects' as table_name,
  count(*) as row_count
from public.natori_projects
union all
select
  'natori_quotes' as table_name,
  count(*) as row_count
from public.natori_quotes
order by table_name;

select
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'natori_projects',
    'natori_quotes',
    'natori_project_reference_links'
  )
order by table_name, ordinal_position;

select
  c.conrelid::regclass::text as table_name,
  c.conname as constraint_name,
  c.contype as constraint_type,
  c.convalidated as is_validated,
  pg_get_constraintdef(c.oid, true) as definition
from pg_catalog.pg_constraint c
where c.connamespace = 'public'::regnamespace
  and c.conrelid in (
    'public.natori_projects'::regclass,
    'public.natori_quotes'::regclass,
    'public.natori_project_reference_links'::regclass
  )
order by table_name, constraint_name;

select
  tablename,
  indexname,
  indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
  and tablename in (
    'natori_projects',
    'natori_quotes',
    'natori_project_reference_links'
  )
order by tablename, indexname;

select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'natori_project_reference_links';

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename = 'natori_project_reference_links'
order by policyname;

select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'natori_project_reference_links'
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by grantee, privilege_type;

select
  c.conname as foreign_key_name,
  c.conrelid::regclass::text as source_table,
  c.confrelid::regclass::text as target_table,
  pg_get_constraintdef(c.oid, true) as definition
from pg_catalog.pg_constraint c
where c.conrelid = 'public.natori_project_reference_links'::regclass
  and c.contype = 'f';

select
  count(*) as duplicate_project_normalized_url_groups
from (
  select project_id, normalized_url
  from public.natori_project_reference_links
  group by project_id, normalized_url
  having count(*) > 1
) duplicates;

select
  count(*) as projects_over_five_reference_links
from (
  select project_id
  from public.natori_project_reference_links
  group by project_id
  having count(*) > 5
) oversized_link_sets;

select
  count(*) as invalid_project_rows
from public.natori_projects
where amount < 0
   or type not in (
     'undecided', 'icon', 'sd', 'standing', 'illustration'
   )
   or (
     request_data is not null
     and (
       jsonb_typeof(request_data) <> 'object'
       or not (request_data ? 'schemaVersion')
       or case
         when jsonb_typeof(request_data -> 'schemaVersion') = 'number'
           then (request_data ->> 'schemaVersion')::numeric <> 1
         else true
       end
       or octet_length(convert_to(request_data::text, 'UTF8')) > 65536
     )
   );

select
  count(*) as invalid_quote_snapshot_rows
from public.natori_quotes
where (
    request_snapshot is not null
    and jsonb_typeof(request_snapshot) <> 'object'
  )
  or (
    pricing_snapshot is not null
    and jsonb_typeof(pricing_snapshot) <> 'object'
  );

select
  count(*) as invalid_reference_link_rows
from public.natori_project_reference_links
where btrim(url) = ''
   or char_length(url) > 2048
   or btrim(normalized_url) = ''
   or char_length(normalized_url) > 2048
   or char_length(label) > 100
   or char_length(provider) > 50
   or sort_order < 0;

select
  count(*) as request_data_null_rows
from public.natori_projects
where request_data is null;

select
  count(*) filter (where request_snapshot is null)
    as request_snapshot_null_rows,
  count(*) filter (where pricing_snapshot is null)
    as pricing_snapshot_null_rows
from public.natori_quotes;

select
  count(*) as pricing_owner_groups_with_multiple_defaults
from (
  select user_id
  from public.natori_pricing_configs
  where is_default
  group by user_id
  having count(*) > 1
) duplicate_defaults;
