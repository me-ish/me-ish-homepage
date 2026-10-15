-- PAY-05: a paid Stripe session that cannot be matched to a quote, amount or request type is a permanent business
-- condition, not a database outage. Record it durably as needing review so the webhook can acknowledge it
-- (Stripe stops redelivering) while the administrator can still find it. Project state is never advanced.
begin;

alter table public.natori_payment_transactions drop constraint natori_payment_transactions_status_check;
alter table public.natori_payment_transactions add constraint natori_payment_transactions_status_check
  check (status in ('received', 'amount_mismatch', 'quote_mismatch', 'duplicate_payment', 'manual', 'needs_review'));

create function public.natori_record_unresolved_stripe_payment_v1(p_project_id uuid, p_session_id text,
  p_amount integer, p_reason text)
returns table(result text, new_event boolean)
language plpgsql security definer set search_path='' as $$
declare p public.natori_projects%rowtype; inserted integer:=0; entry text; t timestamptz:=now();
begin
  if nullif(trim(p_session_id),'') is null or p_reason is null
    or p_reason not in ('project_type_unconfirmed','amount_unavailable','quote_unavailable')
    or (p_amount is not null and p_amount<0) then
    return query select 'invalid-input', false; return; end if;
  select * into p from public.natori_projects where id=p_project_id for update;
  if not found then return query select 'not-found', false; return; end if;
  insert into public.natori_payment_transactions(project_id, quote_id, stripe_session_id, amount, status, received_at, note)
    values(p.id, null, p_session_id, coalesce(p_amount,0), 'needs_review', t, p_reason)
    on conflict (stripe_session_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted=1 then
    entry:='【要確認: 照合できない入金（Stripe） '||to_char(t at time zone 'Asia/Tokyo','YYYY-MM-DD')||'】'||
      case p_reason when 'project_type_unconfirmed' then '依頼種別が未確定'
        when 'amount_unavailable' then '金額を取得できない' else '見積IDがない（旧リンク）' end||
      ' / '||coalesce(p_amount::text||'円','金額不明')||' / session: '||p_session_id;
    update public.natori_projects set note=concat_ws(E'\n\n', nullif(note,''), entry) where id=p.id;
  end if;
  return query select 'recorded', inserted=1;
end $$;

do $$ declare f record; begin
  for f in select oid::regprocedure::text as signature from pg_proc where pronamespace='public'::regnamespace
    and proname='natori_record_unresolved_stripe_payment_v1' loop
    execute 'revoke all on function '||f.signature||' from public,anon,authenticated,service_role';
    execute 'grant execute on function '||f.signature||' to service_role';
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
