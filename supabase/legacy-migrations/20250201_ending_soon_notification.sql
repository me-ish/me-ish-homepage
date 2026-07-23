-- 展示終了予告メール送信済みフラグ
-- entries テーブルに ending_soon_notified_at カラムを追加

ALTER TABLE entries
ADD COLUMN IF NOT EXISTS ending_soon_notified_at TIMESTAMPTZ DEFAULT NULL;

-- インデックス（Cronで未通知の作品を効率的に検索するため）
CREATE INDEX IF NOT EXISTS idx_entries_ending_soon_notification
ON entries (display_end_at, ending_soon_notified_at)
WHERE display_ready = true AND ending_soon_notified_at IS NULL;

COMMENT ON COLUMN entries.ending_soon_notified_at IS '展示終了5日前の通知を送信した日時';
