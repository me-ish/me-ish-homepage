-- 見積もり希望時の自由記述を任意にする。相談時の既存検証は維持。
-- CREATE OR REPLACE により、既存の関数権限・呼び出し元を維持する。
begin;

create or replace function public.natori_request_data_is_valid_v1(
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

  if p_request_data ->> 'inquiryMode' = 'consultation' and not (
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

commit;
