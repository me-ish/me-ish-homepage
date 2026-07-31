-- Etorie P1-05 atomic structured intake and project-type confirmation.
--
-- This migration defines server-only functions. It does not invoke them,
-- backfill rows, touch migration history, or create Storage objects.

begin;

/* --------------------------------------------------------------------------
   Internal RequestData V1 validation helpers
---------------------------------------------------------------------------- */

create function public.natori_request_text_is_valid_v1(
  p_value text,
  p_max_length integer,
  p_min_length integer
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $function$
  select
    p_value is not null
    and p_max_length >= p_min_length
    and p_value !~ '^[[:space:]]'
    and p_value !~ '[[:space:]]$'
    and coalesce((
      select sum(
        case
          when ascii(substr(p_value, position, 1)) > 65535 then 2
          else 1
        end
      )
      from generate_series(1, char_length(p_value)) as positions(position)
    ), 0) between p_min_length and p_max_length
    and not exists (
      select 1
      from generate_series(1, char_length(p_value)) as positions(position)
      where ascii(substr(p_value, position, 1)) between 1 and 8
         or ascii(substr(p_value, position, 1)) in (11, 12, 127)
         or ascii(substr(p_value, position, 1)) between 14 and 31
    );
$function$;

create function public.natori_jsonb_has_exact_keys_v1(
  p_value jsonb,
  p_keys text[]
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
declare
  v_key_count bigint;
begin
  if p_value is null or p_keys is null then
    return false;
  end if;

  if pg_catalog.jsonb_typeof(p_value) <> 'object' then
    return false;
  end if;

  select count(*)
  into v_key_count
  from pg_catalog.jsonb_object_keys(p_value) as object_keys(key_name);

  return v_key_count = pg_catalog.cardinality(p_keys)
    and p_value ?& p_keys;
end;
$function$;

create function public.natori_request_data_is_valid_v1(
  p_request_data jsonb
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
declare
  v_item jsonb;
  v_budget jsonb;
  v_deadline jsonb;
  v_legacy jsonb;
  v_kind text;
  v_request_type text;
  v_scope text;
  v_date_text text;
  v_date date;
  v_min numeric;
  v_max numeric;
begin
  if not public.natori_jsonb_has_exact_keys_v1(
    p_request_data,
    array[
      'schemaVersion', 'formVersion', 'inquiryMode', 'requestType',
      'requestTypeOther', 'commissionScope', 'commissionScopeOther',
      'options', 'usageTypes', 'usageTypeOther', 'commercialUse',
      'publicationPolicy', 'budget', 'deadline', 'characterFeatures',
      'expressionMood', 'composition', 'colorDirection', 'referenceNotes',
      'message', 'legacySource'
    ]::text[]
  ) then
    return false;
  end if;

  if octet_length(convert_to(p_request_data::text, 'UTF8')) > 65536 then
    return false;
  end if;

  if jsonb_typeof(p_request_data -> 'schemaVersion') <> 'number'
     or (p_request_data ->> 'schemaVersion')::numeric <> 1
     or jsonb_typeof(p_request_data -> 'formVersion') <> 'string'
     or p_request_data ->> 'formVersion' not in (
       'etorie-request-v1', 'natori-portfolio-v1'
     )
     or jsonb_typeof(p_request_data -> 'inquiryMode') <> 'string'
     or p_request_data ->> 'inquiryMode' not in ('consultation', 'quote')
  then
    return false;
  end if;

  v_request_type := p_request_data ->> 'requestType';
  v_scope := p_request_data ->> 'commissionScope';

  if jsonb_typeof(p_request_data -> 'requestType') <> 'string'
     or v_request_type not in (
       'undecided', 'icon', 'sd', 'standing', 'illustration', 'other'
     )
     or jsonb_typeof(p_request_data -> 'commissionScope') <> 'string'
     or v_scope not in (
       'undecided', 'bust_up', 'waist_up', 'full_body', 'other'
     )
  then
    return false;
  end if;

  if p_request_data -> 'requestTypeOther' = 'null'::jsonb then
    if v_request_type = 'other' then return false; end if;
  elsif jsonb_typeof(p_request_data -> 'requestTypeOther') <> 'string'
     or not public.natori_request_text_is_valid_v1(
       p_request_data ->> 'requestTypeOther', 100, 1
     )
     or v_request_type <> 'other'
  then
    return false;
  end if;

  if p_request_data -> 'commissionScopeOther' = 'null'::jsonb then
    if v_scope = 'other' then return false; end if;
  elsif jsonb_typeof(p_request_data -> 'commissionScopeOther') <> 'string'
     or not public.natori_request_text_is_valid_v1(
       p_request_data ->> 'commissionScopeOther', 100, 1
     )
     or v_scope <> 'other'
  then
    return false;
  end if;

  if jsonb_typeof(p_request_data -> 'commercialUse') <> 'string'
     or p_request_data ->> 'commercialUse' not in ('none', 'yes', 'unknown')
     or jsonb_typeof(p_request_data -> 'publicationPolicy') <> 'string'
     or p_request_data ->> 'publicationPolicy' not in (
       'allowed', 'delayed', 'work_private', 'fully_private', 'unknown'
     )
  then
    return false;
  end if;

  if exists (
       select 1
       from unnest(array[
         'characterFeatures', 'expressionMood', 'composition',
         'colorDirection', 'referenceNotes', 'message'
       ]::text[]) as text_fields(field_name)
       where jsonb_typeof(p_request_data -> text_fields.field_name) <> 'string'
     )
     or not public.natori_request_text_is_valid_v1(
       p_request_data ->> 'characterFeatures', 1000, 0
     )
     or not public.natori_request_text_is_valid_v1(
       p_request_data ->> 'expressionMood', 1000, 0
     )
     or not public.natori_request_text_is_valid_v1(
       p_request_data ->> 'composition', 1000, 0
     )
     or not public.natori_request_text_is_valid_v1(
       p_request_data ->> 'colorDirection', 1000, 0
     )
     or not public.natori_request_text_is_valid_v1(
       p_request_data ->> 'referenceNotes', 2000, 0
     )
     or not public.natori_request_text_is_valid_v1(
       p_request_data ->> 'message', 2000, 0
     )
  then
    return false;
  end if;

  if not (
    char_length(p_request_data ->> 'characterFeatures') > 0
    or char_length(p_request_data ->> 'expressionMood') > 0
    or char_length(p_request_data ->> 'composition') > 0
    or char_length(p_request_data ->> 'colorDirection') > 0
    or char_length(p_request_data ->> 'referenceNotes') > 0
    or char_length(p_request_data ->> 'message') > 0
  ) then
    return false;
  end if;

  if jsonb_typeof(p_request_data -> 'usageTypes') <> 'array'
     or jsonb_array_length(p_request_data -> 'usageTypes') > 10
     or exists (
       select 1
       from jsonb_array_elements(p_request_data -> 'usageTypes') as usages(value)
       where jsonb_typeof(usages.value) <> 'string'
          or usages.value #>> '{}' not in (
            'social_icon', 'streaming', 'video_thumbnail', 'trpg',
            'original_character', 'print', 'merchandise', 'advertising', 'other'
          )
     )
     or (
       select count(*) <> count(distinct usages.value #>> '{}')
       from jsonb_array_elements(p_request_data -> 'usageTypes') as usages(value)
     )
  then
    return false;
  end if;

  if p_request_data -> 'usageTypeOther' = 'null'::jsonb then
    if (p_request_data -> 'usageTypes') ? 'other' then return false; end if;
  elsif jsonb_typeof(p_request_data -> 'usageTypeOther') <> 'string'
     or not public.natori_request_text_is_valid_v1(
       p_request_data ->> 'usageTypeOther', 200, 1
     )
     or not ((p_request_data -> 'usageTypes') ? 'other')
  then
    return false;
  end if;

  if jsonb_typeof(p_request_data -> 'options') <> 'array'
     or jsonb_array_length(p_request_data -> 'options') > 20
  then
    return false;
  end if;

  for v_item in
    select options.value
    from jsonb_array_elements(p_request_data -> 'options') as options(value)
  loop
    if not public.natori_jsonb_has_exact_keys_v1(
      v_item,
      array['id', 'label', 'quantity', 'notes']::text[]
    )
       or jsonb_typeof(v_item -> 'id') <> 'string'
       or not public.natori_request_text_is_valid_v1(v_item ->> 'id', 64, 1)
       or (v_item ->> 'id') !~ '^[a-z0-9]+([_-][a-z0-9]+)*$'
       or jsonb_typeof(v_item -> 'label') <> 'string'
       or not public.natori_request_text_is_valid_v1(v_item ->> 'label', 100, 1)
       or jsonb_typeof(v_item -> 'quantity') <> 'number'
       or mod((v_item ->> 'quantity')::numeric, 1) <> 0
       or (v_item ->> 'quantity')::numeric not between 1 and 10
       or jsonb_typeof(v_item -> 'notes') <> 'string'
       or not public.natori_request_text_is_valid_v1(v_item ->> 'notes', 300, 0)
       or (
         v_item ->> 'id' = 'other'
         and char_length(v_item ->> 'notes') = 0
       )
    then
      return false;
    end if;
  end loop;

  if (
    select count(*) <> count(distinct options.value ->> 'id')
    from jsonb_array_elements(p_request_data -> 'options') as options(value)
  ) then
    return false;
  end if;

  v_budget := p_request_data -> 'budget';
  if not public.natori_jsonb_has_exact_keys_v1(
    v_budget,
    array['kind', 'min', 'max', 'currency']::text[]
  )
     or jsonb_typeof(v_budget -> 'kind') <> 'string'
     or jsonb_typeof(v_budget -> 'currency') <> 'string'
     or v_budget ->> 'currency' <> 'JPY'
     or v_budget ->> 'kind' not in ('undecided', 'range', 'fixed')
  then
    return false;
  end if;

  v_kind := v_budget ->> 'kind';
  if v_kind = 'undecided' then
    if v_budget -> 'min' <> 'null'::jsonb
       or v_budget -> 'max' <> 'null'::jsonb
    then
      return false;
    end if;
  else
    if jsonb_typeof(v_budget -> 'min') <> 'number'
       or mod((v_budget ->> 'min')::numeric, 1) <> 0
       or (v_budget ->> 'min')::numeric < 0
       or (v_budget ->> 'min')::numeric > 9007199254740991
    then
      return false;
    end if;
    v_min := (v_budget ->> 'min')::numeric;

    if v_budget -> 'max' = 'null'::jsonb then
      if v_kind <> 'range' then return false; end if;
    elsif jsonb_typeof(v_budget -> 'max') <> 'number'
       or mod((v_budget ->> 'max')::numeric, 1) <> 0
       or (v_budget ->> 'max')::numeric < 0
       or (v_budget ->> 'max')::numeric > 9007199254740991
    then
      return false;
    else
      v_max := (v_budget ->> 'max')::numeric;
      if v_max < v_min or (v_kind = 'fixed' and v_max <> v_min) then
        return false;
      end if;
    end if;
  end if;

  v_deadline := p_request_data -> 'deadline';
  if not public.natori_jsonb_has_exact_keys_v1(
    v_deadline,
    array['kind', 'date', 'note']::text[]
  )
     or jsonb_typeof(v_deadline -> 'kind') <> 'string'
     or v_deadline ->> 'kind' not in (
       'undecided', 'standard', 'preferred_date', 'rush_consultation'
     )
     or jsonb_typeof(v_deadline -> 'note') <> 'string'
     or not public.natori_request_text_is_valid_v1(
       v_deadline ->> 'note', 500, 0
     )
  then
    return false;
  end if;

  v_kind := v_deadline ->> 'kind';
  if v_deadline -> 'date' = 'null'::jsonb then
    if v_kind = 'preferred_date' then return false; end if;
  elsif jsonb_typeof(v_deadline -> 'date') <> 'string'
     or v_kind in ('undecided', 'standard')
  then
    return false;
  else
    v_date_text := v_deadline ->> 'date';
    if v_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or substring(v_date_text from 1 for 4)::integer < 100
    then
      return false;
    end if;
    v_date := make_date(
      substring(v_date_text from 1 for 4)::integer,
      substring(v_date_text from 6 for 2)::integer,
      substring(v_date_text from 9 for 2)::integer
    );
    if to_char(v_date, 'YYYY-MM-DD') <> v_date_text then return false; end if;
  end if;

  v_legacy := p_request_data -> 'legacySource';
  if v_legacy <> 'null'::jsonb then
    if not public.natori_jsonb_has_exact_keys_v1(
      v_legacy,
      array[
        'formVersion', 'requestTypeLabel', 'planLabel', 'optionLabels',
        'budgetLabel', 'deadlineLabel', 'referenceUrlsText', 'details', 'message'
      ]::text[]
    )
       or jsonb_typeof(v_legacy -> 'formVersion') <> 'string'
       or v_legacy ->> 'formVersion' <> 'natori-portfolio-v1'
       or exists (
         select 1
         from unnest(array[
           'requestTypeLabel', 'planLabel', 'budgetLabel', 'deadlineLabel',
           'referenceUrlsText', 'details', 'message'
         ]::text[]) as text_fields(field_name)
         where jsonb_typeof(v_legacy -> text_fields.field_name) <> 'string'
       )
       or not public.natori_request_text_is_valid_v1(
         v_legacy ->> 'requestTypeLabel', 100, 0
       )
       or not public.natori_request_text_is_valid_v1(
         v_legacy ->> 'planLabel', 100, 0
       )
       or not public.natori_request_text_is_valid_v1(
         v_legacy ->> 'budgetLabel', 100, 0
       )
       or not public.natori_request_text_is_valid_v1(
         v_legacy ->> 'deadlineLabel', 100, 0
       )
       or not public.natori_request_text_is_valid_v1(
         v_legacy ->> 'referenceUrlsText', 5000, 0
       )
       or not public.natori_request_text_is_valid_v1(
         v_legacy ->> 'details', 4000, 0
       )
       or not public.natori_request_text_is_valid_v1(
         v_legacy ->> 'message', 2000, 0
       )
       or jsonb_typeof(v_legacy -> 'optionLabels') <> 'array'
       or jsonb_array_length(v_legacy -> 'optionLabels') > 20
       or exists (
         select 1
         from jsonb_array_elements(v_legacy -> 'optionLabels') as labels(value)
         where jsonb_typeof(labels.value) <> 'string'
            or not public.natori_request_text_is_valid_v1(
              labels.value #>> '{}', 100, 0
            )
       )
    then
      return false;
    end if;
  end if;

  return true;
exception
  when others then
    return false;
end;
$function$;

revoke all on function
  public.natori_request_text_is_valid_v1(text, integer, integer)
from public, anon, authenticated, service_role;

revoke all on function
  public.natori_jsonb_has_exact_keys_v1(jsonb, text[])
from public, anon, authenticated, service_role;

revoke all on function
  public.natori_request_data_is_valid_v1(jsonb)
from public, anon, authenticated, service_role;

/* --------------------------------------------------------------------------
   Internal task-template source used by the type-confirmation RPC
---------------------------------------------------------------------------- */

create function public.natori_project_task_template_v1(
  p_type text
)
returns table (
  task_key text,
  label text,
  stage text,
  estimated_hours numeric,
  done boolean,
  sort_order integer
)
language sql
immutable
security invoker
set search_path = ''
as $function$
  select templates.task_key,
         templates.label,
         templates.stage,
         templates.estimated_hours,
         false as done,
         templates.sort_order
  from (
    values
      ('icon', 0, 'rough', 'ラフ作成', 'rough', 1.00::numeric),
      ('icon', 1, 'rough-submit', 'ラフ提出', 'rough', 0.50::numeric),
      ('icon', 2, 'lineart', '線画', 'lineart', 1.00::numeric),
      ('icon', 3, 'color', '着彩', 'coloring', 1.50::numeric),
      ('icon', 4, 'review', '最終確認', 'finish', 0.50::numeric),
      ('icon', 5, 'delivery', '納品', 'delivery', 0.50::numeric),
      ('sd', 0, 'rough', 'ラフ作成', 'rough', 1.50::numeric),
      ('sd', 1, 'rough-submit', 'ラフ提出', 'rough', 0.50::numeric),
      ('sd', 2, 'lineart', '線画', 'lineart', 2.50::numeric),
      ('sd', 3, 'color', '着彩', 'coloring', 4.00::numeric),
      ('sd', 4, 'review', '最終確認', 'finish', 1.00::numeric),
      ('sd', 5, 'delivery', '納品', 'delivery', 1.00::numeric),
      ('standing', 0, 'rough', 'ラフ作成', 'rough', 3.00::numeric),
      ('standing', 1, 'rough-submit', 'ラフ提出', 'rough', 0.50::numeric),
      ('standing', 2, 'lineart', '線画', 'lineart', 6.00::numeric),
      ('standing', 3, 'color', '着彩', 'coloring', 10.00::numeric),
      ('standing', 4, 'review', '最終確認', 'finish', 1.00::numeric),
      ('standing', 5, 'delivery', '納品', 'delivery', 0.50::numeric),
      ('illustration', 0, 'rough', 'ラフ', 'rough', 2.50::numeric),
      ('illustration', 1, 'rough-submit', 'ラフ提出', 'rough', 0.50::numeric),
      ('illustration', 2, 'line', '線画', 'lineart', 5.00::numeric),
      ('illustration', 3, 'color', '着彩', 'coloring', 7.00::numeric),
      ('illustration', 4, 'finishing', '仕上げ', 'finish', 1.50::numeric),
      ('illustration', 5, 'delivery', '納品', 'delivery', 0.50::numeric)
  ) as templates(
    project_type,
    sort_order,
    task_key,
    label,
    stage,
    estimated_hours
  )
  where templates.project_type = p_type
  order by templates.sort_order;
$function$;

revoke all on function
  public.natori_project_task_template_v1(text)
from public, anon, authenticated, service_role;

/* --------------------------------------------------------------------------
   RPC 1: atomic structured intake (the compatibility name mentions tasks,
   but a public intake deliberately creates zero task rows)
---------------------------------------------------------------------------- */

create function public.natori_create_project_with_tasks_v2(
  p_user_id uuid,
  p_project_id uuid,
  p_client_name text,
  p_client_email text,
  p_request_data jsonb,
  p_reference_files jsonb,
  p_reference_links jsonb
)
returns table (
  project_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_created_at timestamptz;
  v_file jsonb;
  v_path text;
  v_link jsonb;
  v_url text;
  v_normalized_url text;
  v_request_label text;
  v_title text;
  v_next_action text;
begin
  if p_user_id is null
     or not exists (
       select 1 from auth.users as users where users.id = p_user_id
     )
  then
    raise exception using errcode = '22023', message = 'invalid_owner';
  end if;

  if p_project_id is null then
    raise exception using errcode = '22023', message = 'project_id_required';
  end if;

  if not public.natori_request_text_is_valid_v1(p_client_name, 100, 1) then
    raise exception using errcode = '22023', message = 'invalid_client_name';
  end if;

  if not public.natori_request_text_is_valid_v1(p_client_email, 254, 1)
     or p_client_email like '.%'
     or p_client_email like '%..%'
     or p_client_email !~ '^[A-Za-z0-9_''+.-]*[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$'
  then
    raise exception using errcode = '22023', message = 'invalid_client_email';
  end if;

  if not public.natori_request_data_is_valid_v1(p_request_data) then
    raise exception using errcode = '22023', message = 'invalid_request_data';
  end if;

  if p_reference_files is null
     or jsonb_typeof(p_reference_files) <> 'array'
     or jsonb_array_length(p_reference_files) > 5
     or (
       select count(*) <> count(distinct files.value #>> '{}')
       from jsonb_array_elements(p_reference_files) as files(value)
     )
  then
    raise exception using errcode = '22023', message = 'invalid_reference_files';
  end if;

  for v_file in
    select files.value
    from jsonb_array_elements(p_reference_files) as files(value)
  loop
    if jsonb_typeof(v_file) <> 'string' then
      raise exception using errcode = '22023', message = 'invalid_reference_file';
    end if;
    v_path := v_file #>> '{}';
    if v_path !~ (
      '^' || p_project_id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    ) then
      raise exception using errcode = '22023', message = 'reference_file_scope_mismatch';
    end if;
    if not exists (
      select 1
      from storage.objects as objects
      where objects.bucket_id = 'natori-inquiry-refs'
        and objects.name = v_path
    ) then
      raise exception using errcode = '22023', message = 'reference_file_not_found';
    end if;
    if exists (
      select 1
      from public.natori_inquiry_reference_files as reference_files
      join public.natori_projects as existing_projects
        on existing_projects.id = reference_files.project_id
      where reference_files.storage_path = v_path
        and reference_files.project_id <> p_project_id
    ) then
      raise exception using errcode = '23505', message = 'reference_file_already_linked';
    end if;
  end loop;

  if p_reference_links is null
     or jsonb_typeof(p_reference_links) <> 'array'
     or jsonb_array_length(p_reference_links) > 5
  then
    raise exception using errcode = '22023', message = 'invalid_reference_links';
  end if;

  for v_link in
    select links.value
    from jsonb_array_elements(p_reference_links) as links(value)
  loop
    if not public.natori_jsonb_has_exact_keys_v1(
      v_link,
      array['url', 'normalized_url', 'label', 'provider', 'sort_order']::text[]
    )
       or jsonb_typeof(v_link -> 'url') <> 'string'
       or jsonb_typeof(v_link -> 'normalized_url') <> 'string'
       or not public.natori_request_text_is_valid_v1(v_link ->> 'url', 2048, 1)
       or not public.natori_request_text_is_valid_v1(
         v_link ->> 'normalized_url', 2048, 1
       )
       or lower(left(v_link ->> 'url', 8)) <> 'https://'
       or left(v_link ->> 'normalized_url', 8) <> 'https://'
       or position('#' in (v_link ->> 'normalized_url')) > 0
       or substring(v_link ->> 'url' from '^.{8}([^/?#]+)') is null
       or position(
         '@' in substring(v_link ->> 'url' from '^.{8}([^/?#]+)')
       ) > 0
       or substring(v_link ->> 'normalized_url' from '^https://([^/?#]+)') is null
       or position(
         '@' in substring(
           v_link ->> 'normalized_url' from '^https://([^/?#]+)'
         )
       ) > 0
       or substring(v_link ->> 'normalized_url' from '^https://([^/?#]+)')
          <> lower(substring(v_link ->> 'normalized_url' from '^https://([^/?#]+)'))
       or substring(v_link ->> 'normalized_url' from '^https://([^/?#]+)') ~ ':443$'
       or jsonb_typeof(v_link -> 'sort_order') <> 'number'
       or mod((v_link ->> 'sort_order')::numeric, 1) <> 0
       or (v_link ->> 'sort_order')::numeric < 0
       or (v_link ->> 'sort_order')::numeric > 2147483647
    then
      raise exception using errcode = '22023', message = 'invalid_reference_link';
    end if;

    if v_link -> 'label' = 'null'::jsonb then
      null;
    elsif jsonb_typeof(v_link -> 'label') <> 'string'
       or not public.natori_request_text_is_valid_v1(v_link ->> 'label', 100, 0)
    then
      raise exception using errcode = '22023', message = 'invalid_reference_link_label';
    end if;

    if v_link -> 'provider' = 'null'::jsonb then
      null;
    elsif jsonb_typeof(v_link -> 'provider') <> 'string'
       or not public.natori_request_text_is_valid_v1(v_link ->> 'provider', 50, 0)
    then
      raise exception using errcode = '22023', message = 'invalid_reference_link_provider';
    end if;
  end loop;

  if (
    select count(*) <> count(distinct links.value ->> 'normalized_url')
    from jsonb_array_elements(p_reference_links) as links(value)
  ) then
    raise exception using errcode = '23505', message = 'duplicate_reference_link';
  end if;

  v_request_label := case p_request_data ->> 'requestType'
    when 'undecided' then '未定・相談して決めたい'
    when 'icon' then 'SNSアイコン'
    when 'sd' then 'SDキャラクター'
    when 'standing' then '立ち絵'
    when 'illustration' then '一枚絵'
    when 'other' then p_request_data ->> 'requestTypeOther'
  end;
  if p_request_data -> 'legacySource' <> 'null'::jsonb
     and char_length(p_request_data #>> '{legacySource,requestTypeLabel}') > 0
  then
    v_request_label := p_request_data #>> '{legacySource,requestTypeLabel}';
  end if;
  v_title := v_request_label || ' / ' || p_client_name;
  v_next_action := case p_request_data ->> 'inquiryMode'
    when 'consultation' then '相談内容を確認'
    when 'quote' then '内容確認・案件種別を確定'
  end;

  insert into public.natori_projects (
    id,
    user_id,
    title,
    client_name,
    client_email,
    amount,
    type,
    status,
    delivery_plan,
    priority,
    start_date,
    due_date,
    next_action,
    note,
    request_data,
    deleted_at
  ) values (
    p_project_id,
    p_user_id,
    v_title,
    p_client_name,
    p_client_email,
    null,
    'undecided',
    'inquiry',
    'normal',
    null,
    null,
    null,
    v_next_action,
    null,
    p_request_data,
    null
  )
  on conflict (id) do nothing
  returning natori_projects.created_at into v_created_at;

  if found then
    insert into public.natori_inquiry_reference_files (
      project_id,
      storage_path
    )
    select
      p_project_id,
      files.value #>> '{}'
    from jsonb_array_elements(p_reference_files) as files(value);

    insert into public.natori_project_reference_links (
      project_id,
      url,
      normalized_url,
      label,
      provider,
      sort_order
    )
    select
      p_project_id,
      links.value ->> 'url',
      links.value ->> 'normalized_url',
      case
        when links.value -> 'label' = 'null'::jsonb then null
        else links.value ->> 'label'
      end,
      case
        when links.value -> 'provider' = 'null'::jsonb then null
        else links.value ->> 'provider'
      end,
      (links.value ->> 'sort_order')::integer
    from jsonb_array_elements(p_reference_links) as links(value);
  else
    -- A caller-generated project UUID is the submission idempotency key. An
    -- exact retry may arrive after the first response was lost. The conflicting
    -- INSERT waits for the winner; only an unchanged, fully committed envelope
    -- is then accepted as the same submission.
    select projects.created_at
    into v_created_at
    from public.natori_projects as projects
    where projects.id = p_project_id
      and projects.user_id = p_user_id
      and projects.title = v_title
      and projects.client_name = p_client_name
      and projects.client_email is not distinct from p_client_email
      and projects.amount is null
      and projects.type = 'undecided'
      and projects.status = 'inquiry'
      and projects.delivery_plan = 'normal'
      and projects.priority is null
      and projects.start_date is null
      and projects.due_date is null
      and projects.next_action = v_next_action
      and projects.note is null
      and projects.request_data = p_request_data
      and projects.payment_confirmed_at is null
      and projects.payment_link_id is null
      and projects.quoted_amount is null
      and projects.quote_accept_token_hash is null
      and projects.quote_token_expires_at is null
      and projects.quote_accepted_at is null
      and projects.quote_accepted_amount is null
      and projects.delivery_token_hash is null
      and projects.delivery_token_expires_at is null
      and projects.delivered_mail_at is null
      and projects.delivery_accepted_at is null
      and projects.active_quote_id is null
      and projects.payment_quote_id is null
      and projects.payment_link_url is null
      and projects.payment_link_status is null
      and projects.paid_amount is null
      and projects.stripe_payment_session_id is null
      and projects.paid_at is null
      and projects.completed_at is null
      and projects.deleted_at is null
      and not exists (
        select 1
        from public.natori_project_tasks as tasks
        where tasks.project_id = projects.id
      )
      and (
        select count(*)
        from public.natori_inquiry_reference_files as reference_files
        where reference_files.project_id = projects.id
      ) = jsonb_array_length(p_reference_files)
      and not exists (
        select 1
        from jsonb_array_elements(p_reference_files) as files(value)
        where not exists (
          select 1
          from public.natori_inquiry_reference_files as reference_files
          where reference_files.project_id = projects.id
            and reference_files.storage_path = files.value #>> '{}'
        )
      )
      and (
        select count(*)
        from public.natori_project_reference_links as reference_links
        where reference_links.project_id = projects.id
      ) = jsonb_array_length(p_reference_links)
      and not exists (
        select 1
        from jsonb_array_elements(p_reference_links) as links(value)
        where not exists (
          select 1
          from public.natori_project_reference_links as reference_links
          where reference_links.project_id = projects.id
            and reference_links.url = links.value ->> 'url'
            and reference_links.normalized_url = links.value ->> 'normalized_url'
            and reference_links.label is not distinct from case
              when links.value -> 'label' = 'null'::jsonb then null
              else links.value ->> 'label'
            end
            and reference_links.provider is not distinct from case
              when links.value -> 'provider' = 'null'::jsonb then null
              else links.value ->> 'provider'
            end
            and reference_links.sort_order =
              (links.value ->> 'sort_order')::integer
        )
      )
    for update of projects;

    if not found then
      raise exception using errcode = '23505', message = 'submission_conflict';
    end if;
  end if;

  return query select p_project_id, v_created_at;
end;
$function$;

revoke all on function public.natori_create_project_with_tasks_v2(
  uuid, uuid, text, text, jsonb, jsonb, jsonb
)
from public, anon, authenticated, service_role;

grant execute on function public.natori_create_project_with_tasks_v2(
  uuid, uuid, text, text, jsonb, jsonb, jsonb
)
to service_role;

/* --------------------------------------------------------------------------
   RPC 2: owner-scoped, concurrency-safe concrete type confirmation
---------------------------------------------------------------------------- */

create function public.natori_confirm_project_type_v1(
  p_user_id uuid,
  p_project_id uuid,
  p_type text
)
returns table (
  result text,
  project_id uuid,
  project_type text,
  task_count integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_project public.natori_projects%rowtype;
  v_task_count integer;
  v_expected_count integer;
  v_matching_count integer;
begin
  if p_type is null
     or p_type not in ('icon', 'sd', 'standing', 'illustration')
  then
    return query select 'invalid_type'::text, null::uuid, null::text, 0;
    return;
  end if;

  select projects.*
  into v_project
  from public.natori_projects as projects
  where projects.id = p_project_id
    and projects.user_id = p_user_id
    and projects.deleted_at is null
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::text, 0;
    return;
  end if;

  select count(*)::integer
  into v_task_count
  from public.natori_project_tasks as tasks
  where tasks.project_id = v_project.id;

  select count(*)::integer
  into v_expected_count
  from public.natori_project_task_template_v1(p_type);

  select count(*)::integer
  into v_matching_count
  from public.natori_project_tasks as tasks
  join public.natori_project_task_template_v1(p_type) as template
    on template.task_key = tasks.task_key
   and template.label = tasks.label
   and template.stage = tasks.stage
   and template.estimated_hours is not distinct from tasks.estimated_hours
   and template.done is not distinct from tasks.done
   and template.sort_order = tasks.sort_order
  where tasks.project_id = v_project.id;

  if v_project.status not in (
       'inquiry', 'estimating', 'consulting', 'quoted', 'awaiting_payment'
     )
     or v_project.payment_confirmed_at is not null
  then
    return query select 'conflict'::text, v_project.id, v_project.type, v_task_count;
    return;
  end if;

  if v_project.type = p_type
     and v_task_count = v_expected_count
     and v_matching_count = v_expected_count
  then
    return query select
      'already_confirmed'::text,
      v_project.id,
      v_project.type,
      v_task_count;
    return;
  end if;

  if v_project.type <> 'undecided' or v_task_count <> 0 then
    return query select 'conflict'::text, v_project.id, v_project.type, v_task_count;
    return;
  end if;

  update public.natori_projects as projects
  set type = p_type,
      updated_at = now()
  where projects.id = v_project.id;

  insert into public.natori_project_tasks (
    project_id,
    task_key,
    label,
    stage,
    estimated_hours,
    done,
    sort_order
  )
  select
    v_project.id,
    template.task_key,
    template.label,
    template.stage,
    template.estimated_hours,
    template.done,
    template.sort_order
  from public.natori_project_task_template_v1(p_type) as template;

  get diagnostics v_task_count = row_count;
  return query select 'confirmed'::text, v_project.id, p_type, v_task_count;
end;
$function$;

revoke all on function public.natori_confirm_project_type_v1(uuid, uuid, text)
from public, anon, authenticated, service_role;

grant execute on function public.natori_confirm_project_type_v1(uuid, uuid, text)
to service_role;

commit;
