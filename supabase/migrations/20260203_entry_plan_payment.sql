-- Entry plan payment tracking (for paid display plans)

ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS plan_payment_status text,
  ADD COLUMN IF NOT EXISTS plan_payment_amount_yen integer,
  ADD COLUMN IF NOT EXISTS plan_payment_session_id text,
  ADD COLUMN IF NOT EXISTS plan_payment_paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS plan_payment_checkout_created_at timestamp with time zone;

UPDATE public.entries
SET plan_payment_status = CASE
  WHEN is_for_sale = true AND COALESCE(display_plan, 'free') <> 'free' THEN 'pending'
  ELSE 'unneeded'
END
WHERE plan_payment_status IS NULL;

ALTER TABLE public.entries
  ALTER COLUMN plan_payment_status SET DEFAULT 'unneeded',
  ALTER COLUMN plan_payment_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'entries_plan_payment_status_chk'
  ) THEN
    ALTER TABLE public.entries
      ADD CONSTRAINT entries_plan_payment_status_chk
      CHECK (plan_payment_status IN ('unneeded', 'pending', 'paid'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_entries_plan_payment_status
  ON public.entries (plan_payment_status);
