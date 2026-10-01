-- Dedicated Phase T fixture only, following its already verified sandbox guard.
do $$ begin
 if current_setting('phase_t.sandbox',true) is distinct from 'ephemeral' then raise exception 'Sandbox required'; end if;
end $$;
alter table public.natori_projects add column payment_quote_id uuid references public.natori_quotes,
 add column stripe_payment_session_id text,add column payment_link_status text;
alter table public.natori_payment_transactions add column quote_id uuid references public.natori_quotes,
 add column stripe_session_id text unique;
create table public.processed_stripe_events(event_id text primary key,received_at timestamptz default now());
alter table public.processed_stripe_events enable row level security;
revoke all on public.processed_stripe_events from public,anon,authenticated;
grant select,insert,delete on public.processed_stripe_events to service_role;
