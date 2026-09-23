-- Agreements shown on the acceptance page belong to the issued quote, not to
-- the mutable project or the customer's original preference.
alter table public.natori_quotes
  add column quote_terms jsonb;

alter table public.natori_quotes
  add constraint natori_quotes_terms_shape_check check (
    quote_terms is null or (
      jsonb_typeof(quote_terms) = 'object'
      and jsonb_typeof(quote_terms->'deliverables') = 'string'
      and char_length(trim(quote_terms->>'deliverables')) between 1 and 1000
      and (quote_terms->>'dueDate') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    )
  );

create function public.guard_natori_quote_terms_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Initial write happens immediately after the legacy quote-issuance RPC,
  -- before the email is sent. Historical and accepted quotes remain immutable.
  if old.quote_terms is distinct from new.quote_terms and (
    old.quote_terms is not null or old.accepted_at is not null or
    old.superseded_at is not null
  ) then
    raise exception 'quote_terms_immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_natori_quote_terms_immutability()
  from public, anon, authenticated;

create trigger trg_natori_quote_terms_immutable
  before update on public.natori_quotes
  for each row execute function public.guard_natori_quote_terms_immutability();

-- Reuse the established quote issuance transaction, adding a locked check
-- against the confirmed project calendar and persisting the display terms in
-- the same transaction. Any error rolls back both the new quote and the
-- superseding of the previous quote.
create function public.natori_issue_quote_with_terms(
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
  p_quote_terms jsonb,
  p_expected_due_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_due_date date;
begin
  if p_quote_terms is null
     or p_quote_terms->>'dueDate' is distinct from p_expected_due_date::text then
    raise exception 'invalid_quote_terms';
  end if;

  select due_date into v_due_date
  from public.natori_projects
  where id = p_project_id and user_id = p_user_id
  for update;
  if not found or v_due_date is null or v_due_date is distinct from p_expected_due_date then
    raise exception 'invalid_quote_due_date';
  end if;

  v_quote_id := public.natori_issue_quote(
    p_user_id, p_project_id, p_title, p_client_name, p_to_email, p_amount,
    p_subject, p_body_snapshot, p_token_hash, p_expires_at
  );
  update public.natori_quotes
  set quote_terms = p_quote_terms
  where id = v_quote_id and project_id = p_project_id and user_id = p_user_id;
  if not found then raise exception 'quote_terms_not_saved'; end if;

  return v_quote_id;
end;
$$;

revoke all on function public.natori_issue_quote_with_terms(
  uuid, uuid, text, text, text, integer, text, text, text, timestamptz,
  jsonb, date
) from public, anon, authenticated;

grant execute on function public.natori_issue_quote_with_terms(
  uuid, uuid, text, text, text, integer, text, text, text, timestamptz,
  jsonb, date
) to service_role;
