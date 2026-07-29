-- Etorie Phase 1 constraints and indexes.
--
-- Existing rows are not updated. CHECK constraints on existing tables are
-- installed NOT VALID first, then validated without holding an
-- ACCESS EXCLUSIVE lock for the validation scan.

begin;

alter table public.natori_projects
  drop constraint natori_projects_amount_check;

alter table public.natori_projects
  add constraint natori_projects_amount_check
  check (amount is null or amount >= 0)
  not valid;

alter table public.natori_projects
  validate constraint natori_projects_amount_check;

alter table public.natori_projects
  drop constraint natori_projects_type_check;

alter table public.natori_projects
  alter column type set default 'undecided',
  add constraint natori_projects_type_check
  check (type in (
    'undecided', 'icon', 'sd', 'standing', 'illustration'
  ))
  not valid;

alter table public.natori_projects
  validate constraint natori_projects_type_check;

alter table public.natori_projects
  add constraint natori_projects_request_data_envelope_check
  check (
    request_data is null
    or (
      jsonb_typeof(request_data) = 'object'
      and request_data ? 'schemaVersion'
      and case
        when jsonb_typeof(request_data -> 'schemaVersion') = 'number'
          then (request_data ->> 'schemaVersion')::numeric = 1
        else false
      end
      and octet_length(convert_to(request_data::text, 'UTF8')) <= 65536
    )
  )
  not valid;

alter table public.natori_projects
  validate constraint natori_projects_request_data_envelope_check;

alter table public.natori_quotes
  add constraint natori_quotes_request_snapshot_object_check
  check (
    request_snapshot is null
    or jsonb_typeof(request_snapshot) = 'object'
  )
  not valid,
  add constraint natori_quotes_pricing_snapshot_object_check
  check (
    pricing_snapshot is null
    or jsonb_typeof(pricing_snapshot) = 'object'
  )
  not valid;

alter table public.natori_quotes
  validate constraint natori_quotes_request_snapshot_object_check;

alter table public.natori_quotes
  validate constraint natori_quotes_pricing_snapshot_object_check;

alter table public.natori_project_reference_links
  add constraint natori_project_reference_links_url_check
  check (
    btrim(url) <> ''
    and char_length(url) <= 2048
  )
  not valid,
  add constraint natori_project_reference_links_normalized_url_check
  check (
    btrim(normalized_url) <> ''
    and char_length(normalized_url) <= 2048
  )
  not valid,
  add constraint natori_project_reference_links_label_check
  check (
    label is null
    or char_length(label) <= 100
  )
  not valid,
  add constraint natori_project_reference_links_provider_check
  check (
    provider is null
    or char_length(provider) <= 50
  )
  not valid,
  add constraint natori_project_reference_links_sort_order_check
  check (sort_order >= 0)
  not valid;

alter table public.natori_project_reference_links
  validate constraint natori_project_reference_links_url_check;

alter table public.natori_project_reference_links
  validate constraint natori_project_reference_links_normalized_url_check;

alter table public.natori_project_reference_links
  validate constraint natori_project_reference_links_label_check;

alter table public.natori_project_reference_links
  validate constraint natori_project_reference_links_provider_check;

alter table public.natori_project_reference_links
  validate constraint natori_project_reference_links_sort_order_check;

alter table public.natori_project_reference_links
  add constraint natori_project_reference_links_project_id_normalized_url_key
  unique (project_id, normalized_url);

create index natori_project_reference_links_project_sort_idx
  on public.natori_project_reference_links(
    project_id,
    sort_order,
    created_at
  );

drop index public.natori_projects_user_due_idx;
drop index public.natori_projects_active_owner_due_idx;

create index natori_projects_active_owner_due_idx
  on public.natori_projects(user_id, due_date)
  where deleted_at is null
    and due_date is not null;

commit;
