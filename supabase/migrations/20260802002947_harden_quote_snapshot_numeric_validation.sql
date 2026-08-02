-- Etorie P1-09 follow-up: reject malformed numeric JSON with domain errors
-- instead of leaking PostgreSQL cast errors.

begin;

create or replace function public.natori_issue_quote_v1(
  p_user_id uuid,
  p_project_id uuid,
  p_title text,
  p_client_name text,
  p_to_email text,
  p_amount integer,
  p_subject text,
  p_body_snapshot text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_request_snapshot jsonb,
  p_pricing_snapshot jsonb,
  p_idempotency_key text
)
returns table(quote_id uuid, version integer, reused boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.natori_projects%rowtype;
  v_existing public.natori_quotes%rowtype;
  v_quote_id uuid;
  v_version integer;
  v_item_total bigint;
  v_invalid_item_count integer;
  v_unresolved_review_count integer;
  v_orphan_resolution_count integer;
  v_total_text text;
  v_now timestamptz := now();
begin
  if p_user_id is null or p_project_id is null then
    raise exception 'owner_and_project_required';
  end if;
  if nullif(trim(p_title), '') is null
     or nullif(trim(p_client_name), '') is null
     or nullif(trim(p_to_email), '') is null
     or nullif(trim(p_subject), '') is null
     or nullif(trim(p_body_snapshot), '') is null
     or nullif(trim(p_token_hash), '') is null then
    raise exception 'quote_fields_required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_quote_amount';
  end if;
  if p_expires_at is null or p_expires_at <= v_now then
    raise exception 'invalid_quote_expiry';
  end if;
  if p_idempotency_key is null
     or char_length(p_idempotency_key) not between 8 and 200
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$' then
    raise exception 'invalid_idempotency_key';
  end if;
  if p_request_snapshot is not null then
    if jsonb_typeof(p_request_snapshot) <> 'object'
       or p_request_snapshot->>'schemaVersion' <> '1' then
      raise exception 'invalid_request_snapshot';
    end if;
  end if;
  if jsonb_typeof(p_pricing_snapshot) <> 'object'
     or p_pricing_snapshot->>'schemaVersion' <> '1'
     or p_pricing_snapshot->>'currency' <> 'JPY' then
    raise exception 'invalid_pricing_snapshot';
  end if;
  if jsonb_typeof(p_pricing_snapshot->'items') <> 'array'
     or jsonb_array_length(p_pricing_snapshot->'items') = 0 then
    raise exception 'quote_items_required';
  end if;
  if jsonb_typeof(p_pricing_snapshot->'reviewItems') <> 'array'
     or jsonb_typeof(p_pricing_snapshot->'reviewResolutions') <> 'array' then
    raise exception 'invalid_review_snapshot';
  end if;

  -- Validate type and lexical form before any cast. JSON strings, decimals,
  -- negatives, exponent notation, and values outside integer range are rejected.
  if jsonb_typeof(p_pricing_snapshot->'total') <> 'number' then
    raise exception 'invalid_pricing_snapshot';
  end if;
  v_total_text := p_pricing_snapshot->>'total';
  if v_total_text !~ '^[0-9]+$'
     or char_length(v_total_text) > 10
     or v_total_text::numeric > 2147483647 then
    raise exception 'invalid_pricing_snapshot';
  end if;
  if v_total_text::integer <> p_amount then
    raise exception 'quote_total_mismatch';
  end if;

  -- First pass contains no casts. This guarantees the arithmetic pass cannot
  -- fail with invalid_text_representation or numeric overflow.
  select count(*)
  into v_invalid_item_count
  from jsonb_array_elements(p_pricing_snapshot->'items') as item
  where jsonb_typeof(item) <> 'object'
     or jsonb_typeof(item->'quantity') <> 'number'
     or jsonb_typeof(item->'unitAmount') <> 'number'
     or jsonb_typeof(item->'amount') <> 'number'
     or coalesce(item->>'quantity', '') !~ '^[0-9]+$'
     or coalesce(item->>'unitAmount', '') !~ '^[0-9]+$'
     or coalesce(item->>'amount', '') !~ '^[0-9]+$'
     or char_length(coalesce(item->>'quantity', '')) > 3
     or char_length(coalesce(item->>'unitAmount', '')) > 10
     or char_length(coalesce(item->>'amount', '')) > 10;

  if v_invalid_item_count > 0 then
    raise exception 'invalid_quote_item';
  end if;

  select
    coalesce(sum((item->>'amount')::bigint), 0),
    count(*) filter (
      where (item->>'quantity')::integer not between 1 and 100
         or (item->>'unitAmount')::numeric > 2147483647
         or (item->>'amount')::numeric > 2147483647
         or (item->>'amount')::numeric
              <> (item->>'unitAmount')::numeric * (item->>'quantity')::numeric
    )
  into v_item_total, v_invalid_item_count
  from jsonb_array_elements(p_pricing_snapshot->'items') as item;

  if v_invalid_item_count > 0 then
    raise exception 'invalid_quote_item';
  end if;
  if v_item_total <> p_amount then
    raise exception 'quote_item_total_mismatch';
  end if;

  select count(*)
  into v_unresolved_review_count
  from jsonb_array_elements(p_pricing_snapshot->'reviewItems') as review_item
  where not exists (
    select 1
    from jsonb_array_elements(p_pricing_snapshot->'reviewResolutions') as resolution
    where resolution->>'code' = review_item->>'code'
      and resolution->>'ruleId' = review_item->>'ruleId'
      and resolution->>'resolution' in ('accepted', 'overridden', 'not_applicable')
  );

  if v_unresolved_review_count > 0 then
    raise exception 'unresolved_review_item';
  end if;

  select count(*)
  into v_orphan_resolution_count
  from jsonb_array_elements(p_pricing_snapshot->'reviewResolutions') as resolution
  where not exists (
    select 1
    from jsonb_array_elements(p_pricing_snapshot->'reviewItems') as review_item
    where review_item->>'code' = resolution->>'code'
      and review_item->>'ruleId' = resolution->>'ruleId'
  );

  if v_orphan_resolution_count > 0 then
    raise exception 'orphan_review_resolution';
  end if;

  select * into v_project
  from public.natori_projects
  where id = p_project_id and user_id = p_user_id
  for update;

  if not found then raise exception 'project_not_found'; end if;
  if v_project.deleted_at is not null then raise exception 'project_archived'; end if;
  if v_project.payment_confirmed_at is not null then raise exception 'project_already_paid'; end if;
  if v_project.type = 'undecided' then raise exception 'project_type_undecided'; end if;
  if v_project.status not in ('inquiry', 'consulting', 'estimating', 'quoted') then
    raise exception 'invalid_quote_state';
  end if;
  if p_pricing_snapshot->>'projectTypeSnapshot' <> v_project.type then
    raise exception 'project_type_snapshot_mismatch';
  end if;
  if p_request_snapshot is distinct from v_project.request_data then
    raise exception 'request_snapshot_mismatch';
  end if;

  select * into v_existing
  from public.natori_quotes
  where project_id = p_project_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.user_id is distinct from p_user_id
       or v_existing.title is distinct from p_title
       or v_existing.client_name is distinct from p_client_name
       or v_existing.to_email is distinct from p_to_email
       or v_existing.amount is distinct from p_amount
       or v_existing.subject is distinct from p_subject
       or v_existing.body_snapshot is distinct from p_body_snapshot
       or v_existing.token_hash is distinct from p_token_hash
       or v_existing.expires_at is distinct from p_expires_at
       or v_existing.request_snapshot is distinct from p_request_snapshot
       or v_existing.pricing_snapshot is distinct from p_pricing_snapshot then
      raise exception 'idempotency_conflict';
    end if;

    return query select v_existing.id, v_existing.version, true;
    return;
  end if;

  update public.natori_quotes
  set superseded_at = coalesce(superseded_at, v_now)
  where project_id = p_project_id
    and superseded_at is null;

  select coalesce(max(q.version), 0) + 1
  into v_version
  from public.natori_quotes q
  where q.project_id = p_project_id;

  insert into public.natori_quotes (
    project_id, user_id, version, title, client_name, to_email, amount,
    subject, body_snapshot, token_hash, expires_at, request_snapshot,
    pricing_snapshot, idempotency_key, issued_at
  ) values (
    p_project_id, p_user_id, v_version, p_title, p_client_name, p_to_email,
    p_amount, p_subject, p_body_snapshot, p_token_hash, p_expires_at,
    p_request_snapshot, p_pricing_snapshot, p_idempotency_key, v_now
  ) returning id into v_quote_id;

  update public.natori_projects
  set active_quote_id = v_quote_id,
      client_email = p_to_email,
      amount = p_amount,
      quoted_amount = p_amount,
      quote_accept_token_hash = p_token_hash,
      quote_token_expires_at = p_expires_at,
      quote_accepted_at = null,
      quote_accepted_amount = null
  where id = p_project_id and user_id = p_user_id;

  return query select v_quote_id, v_version, false;
end;
$$;

revoke all on function public.natori_issue_quote_v1(
  uuid, uuid, text, text, text, integer, text, text, text, timestamptz,
  jsonb, jsonb, text
) from public, anon, authenticated;

grant execute on function public.natori_issue_quote_v1(
  uuid, uuid, text, text, text, integer, text, text, text, timestamptz,
  jsonb, jsonb, text
) to service_role;

commit;
