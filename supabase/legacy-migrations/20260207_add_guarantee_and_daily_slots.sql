-- 展示保証: entries に回数/期間を追加
ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS guarantee_total integer,
  ADD COLUMN IF NOT EXISTS guarantee_remaining integer,
  ADD COLUMN IF NOT EXISTS guarantee_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS guarantee_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS guarantee_extended_count integer;

COMMENT ON COLUMN public.entries.guarantee_total IS '表示保証の総回数';
COMMENT ON COLUMN public.entries.guarantee_remaining IS '表示保証の残回数';
COMMENT ON COLUMN public.entries.guarantee_period_start IS '表示保証の開始日時';
COMMENT ON COLUMN public.entries.guarantee_period_end IS '表示保証の終了日時';
COMMENT ON COLUMN public.entries.guarantee_extended_count IS '保証未消化による延長回数';

-- 日替わりの確定スロット
CREATE TABLE IF NOT EXISTS public.entry_daily_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id bigint NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  display_date date NOT NULL,
  slot_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entry_daily_slots_date_slot_unique UNIQUE (display_date, slot_index),
  CONSTRAINT entry_daily_slots_date_entry_unique UNIQUE (display_date, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_entry_daily_slots_date ON public.entry_daily_slots(display_date);
CREATE INDEX IF NOT EXISTS idx_entry_daily_slots_entry ON public.entry_daily_slots(entry_id);

ALTER TABLE public.entry_daily_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entry_daily_slots_select_public" ON public.entry_daily_slots
  FOR SELECT USING (true);

