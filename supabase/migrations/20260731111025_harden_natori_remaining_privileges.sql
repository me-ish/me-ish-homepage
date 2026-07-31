-- Normalize the Stripe webhook idempotency ledger ACL after Supabase default
-- table privileges have been applied. This migration changes privileges only;
-- it does not alter rows, RLS, or policies.

begin;

revoke all privileges
on table public.processed_stripe_events
from public, anon, authenticated, service_role;

grant select, insert, delete
on table public.processed_stripe_events
to service_role;

commit;
