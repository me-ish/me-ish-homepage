-- Read-only catalogue snapshot, 2026-09-27. No business rows/tokens.
-- Existing production RPC only; installed exclusively by Phase N's guarded fixture.
create function public.natori_accept_quote(p_token_hash text)
returns table(result text, quote_id uuid, project_id uuid, accepted_at timestamptz)
language plpgsql security definer set search_path = public as $catalog$

declare
  v_quote public.natori_quotes%rowtype;
  v_now timestamptz := now();
begin
  select * into v_quote
  from public.natori_quotes
  where token_hash = p_token_hash
  for update;

  if not found then
    return query select 'not-found'::text, null::uuid, null::uuid, null::timestamptz;
    return;
  end if;
  if v_quote.superseded_at is not null then
    return query select 'superseded'::text, v_quote.id, v_quote.project_id, v_quote.accepted_at;
    return;
  end if;
  if v_quote.accepted_at is not null then
    return query select 'already-accepted'::text, v_quote.id, v_quote.project_id, v_quote.accepted_at;
    return;
  end if;
  if v_quote.expires_at < v_now then
    return query select 'expired'::text, v_quote.id, v_quote.project_id, null::timestamptz;
    return;
  end if;

  -- active_quote_id を同じトランザクションでロックしてから承諾する。別版の発行と
  -- 競合した場合、quote 側だけ accepted になる半端な状態を残さない。
  perform 1 from public.natori_projects
  where id = v_quote.project_id and active_quote_id = v_quote.id
  for update;
  if not found then
    return query select 'superseded'::text, v_quote.id, v_quote.project_id, null::timestamptz;
    return;
  end if;

  update public.natori_quotes set accepted_at = v_now where id = v_quote.id;
  update public.natori_projects
  set quote_accepted_at = v_now,
      quote_accepted_amount = v_quote.amount,
      amount = v_quote.amount,
      next_action = '見積もり承諾済み・支払い依頼を送る',
      note = concat_ws(
        E'\n\n',
        nullif(note, ''),
        '【見積もり承諾 ' || to_char(v_now at time zone 'Asia/Tokyo', 'YYYY-MM-DD') ||
        '】' || to_char(v_quote.amount, 'FM999,999,999') || '円（承諾ページより）'
      )
  where id = v_quote.project_id and active_quote_id = v_quote.id;

  if not found then
    return query select 'superseded'::text, v_quote.id, v_quote.project_id, null::timestamptz;
    return;
  end if;

  return query select 'ok'::text, v_quote.id, v_quote.project_id, v_now;
end;

$catalog$;
revoke all on function public.natori_accept_quote(text) from public,anon,authenticated;
grant execute on function public.natori_accept_quote(text) to service_role;

