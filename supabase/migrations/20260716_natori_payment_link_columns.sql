-- 支払いリンクの追跡カラム。
-- payment_link_id: 最後に発行した Stripe Payment Link の ID。支払い依頼メールを
--   再送（再見積もり）する際に旧リンクを stripe.paymentLinks.update(active: false)
--   で無効化するために保持する。
-- quoted_amount: 支払いリンクを発行した時点の確定金額（円）。Webhook の入金反映で
--   session.amount_total と照合し、不一致なら rough に進めず要確認扱いにする。
-- どちらも nullable（支払いリンク未発行の案件・既存案件は null のまま）。

alter table public.natori_projects
  add column if not exists payment_link_id text,
  add column if not exists quoted_amount integer;
