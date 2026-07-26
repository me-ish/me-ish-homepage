-- Backfill sales metadata for projects that were already completed before
-- paid_at / paid_amount / completed_at became required for results reporting.
--
-- New completion paths populate these fields transactionally. This migration
-- only repairs legacy completed rows and keeps the stricter results filter.

update public.natori_projects
set
  payment_confirmed_at = coalesce(
    payment_confirmed_at,
    (due_date::date + time '12:00') at time zone 'Asia/Tokyo'
  ),
  paid_at = coalesce(
    paid_at,
    payment_confirmed_at,
    (due_date::date + time '12:00') at time zone 'Asia/Tokyo'
  ),
  paid_amount = coalesce(paid_amount, quoted_amount, amount),
  completed_at = coalesce(
    completed_at,
    paid_at,
    payment_confirmed_at,
    (due_date::date + time '12:00') at time zone 'Asia/Tokyo'
  )
where status = 'completed'
  and (
    payment_confirmed_at is null
    or paid_at is null
    or paid_amount is null
    or completed_at is null
  );
