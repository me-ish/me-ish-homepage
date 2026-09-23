-- The original request stays immutable. This private, owner-scoped draft holds
-- the terms agreed after consultation and the editable estimate line items.
create table public.natori_estimate_drafts (
  project_id uuid primary key references public.natori_projects(id) on delete cascade,
  user_id uuid not null,
  agreed_terms jsonb not null check (jsonb_typeof(agreed_terms) = 'object'),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

create index natori_estimate_drafts_owner_idx on public.natori_estimate_drafts(user_id);
alter table public.natori_estimate_drafts enable row level security;
revoke all on table public.natori_estimate_drafts from public, anon, authenticated;
grant select, insert, update, delete on table public.natori_estimate_drafts to service_role;

-- Keep quote issuance, terms shown on the acceptance page, and the project
-- calendar date in the same transaction. The established v1 function still
-- handles immutable snapshots, versions, totals and idempotency.
create function public.natori_issue_quote_from_draft_v1(
  p_user_id uuid, p_project_id uuid, p_title text, p_client_name text,
  p_to_email text, p_amount integer, p_subject text, p_body_snapshot text,
  p_token_hash text, p_expires_at timestamptz, p_request_snapshot jsonb,
  p_pricing_snapshot jsonb, p_idempotency_key text, p_expected_revision integer
)
returns table(quote_id uuid, version integer, reused boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_draft public.natori_estimate_drafts%rowtype;
  v_due_date date;
  v_quote record;
  v_terms jsonb;
begin
  select * into v_draft from public.natori_estimate_drafts
  where project_id = p_project_id and user_id = p_user_id for update;
  if not found or v_draft.revision is distinct from p_expected_revision then
    raise exception 'estimate_draft_changed';
  end if;
  if p_pricing_snapshot->'items' is distinct from v_draft.items
     or p_pricing_snapshot->'agreedTerms' is distinct from v_draft.agreed_terms then
    raise exception 'estimate_draft_mismatch';
  end if;
  if nullif(trim(v_draft.agreed_terms->>'deliverables'), '') is null
     or char_length(v_draft.agreed_terms->>'deliverables') > 1000
     or coalesce(v_draft.agreed_terms->>'scope', 'undecided') = 'undecided'
     or (v_draft.agreed_terms->>'scope' = 'other' and nullif(trim(v_draft.agreed_terms->>'scopeNote'), '') is null)
     or nullif(trim(v_draft.agreed_terms->>'usage'), '') is null
     or v_draft.agreed_terms->>'commercialUse' not in ('yes', 'no')
     or nullif(trim(v_draft.agreed_terms->>'publication'), '') is null
     or (v_draft.agreed_terms->>'dueDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'estimate_terms_incomplete';
  end if;
  begin
    v_due_date := (v_draft.agreed_terms->>'dueDate')::date;
  exception when others then
    raise exception 'estimate_terms_incomplete';
  end;
  if v_due_date < (now() at time zone 'Asia/Tokyo')::date then raise exception 'estimate_due_date_past'; end if;

  select * into v_quote from public.natori_issue_quote_v1(
    p_user_id, p_project_id, p_title, p_client_name, p_to_email, p_amount,
    p_subject, p_body_snapshot, p_token_hash, p_expires_at,
    p_request_snapshot, p_pricing_snapshot, p_idempotency_key
  );
  v_terms := jsonb_build_object(
    'deliverables', v_draft.agreed_terms->>'deliverables',
    'dueDate', v_draft.agreed_terms->>'dueDate',
    'scope', case v_draft.agreed_terms->>'scope'
      when 'bust_up' then '胸上' when 'waist_up' then '膝〜腰上'
      when 'full_body' then '全身' when 'sd' then 'SD'
      else v_draft.agreed_terms->>'scopeNote' end,
    'usage', v_draft.agreed_terms->>'usage',
    'commercialUse', case v_draft.agreed_terms->>'commercialUse'
      when 'yes' then 'あり' else 'なし' end,
    'publication', v_draft.agreed_terms->>'publication'
  );
  update public.natori_quotes set quote_terms = v_terms
  where id = v_quote.quote_id and project_id = p_project_id
    and (quote_terms is null or quote_terms = v_terms);
  if not found then raise exception 'quote_terms_conflict'; end if;
  update public.natori_projects set due_date = v_due_date
  where id = p_project_id and user_id = p_user_id;
  return query select v_quote.quote_id::uuid, v_quote.version::integer, v_quote.reused::boolean;
end;
$$;

revoke all on function public.natori_issue_quote_from_draft_v1(
  uuid, uuid, text, text, text, integer, text, text, text, timestamptz,
  jsonb, jsonb, text, integer
) from public, anon, authenticated;
grant execute on function public.natori_issue_quote_from_draft_v1(
  uuid, uuid, text, text, text, integer, text, text, text, timestamptz,
  jsonb, jsonb, text, integer
) to service_role;
