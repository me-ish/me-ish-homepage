# Etorie P1-09 リリース確認手順

作成日: 2026-08-02

## 1. 目的

P1-09「正式見積 snapshot と発行ガード」を、安全にマージ・本番反映するための最終確認手順を固定する。

この手順では、本番Supabaseへの変更は明示承認後にのみ実施する。

## 2. 対象

- PR: `#12 P1-09 正式見積 snapshot と発行ガード`
- branch: `feat/etorie-p1-09-quote-snapshot`
- test Supabase: `rlpljepcdreenjwwxrmg`
- production Supabase: `lvnfspyainrxtztjytbo`

## 3. マージ前のローカル確認

```powershell
cd C:\me-ish-next
git switch feat/etorie-p1-09-quote-snapshot
git pull --ff-only origin feat/etorie-p1-09-quote-snapshot
npm test
npm run typecheck
npm run build
```

全コマンドが成功すること。

## 4. 手動E2E確認

### 4.1 正常発行

1. テスト環境で、structured依頼データを持つ案件を開く。
2. 見積候補の明細、合計、宛先、件名、本文を確認する。
3. attention項目がある場合は確認チェックを入れる。
4. 正式見積を発行する。
5. 画面にquote IDとversionが表示されることを確認する。
6. 受信メールに承諾リンクが含まれることを確認する。
7. 承諾リンクを開き、表示金額と明細が発行内容と一致することを確認する。
8. テストDBで次を確認する。
   - `natori_quotes.request_snapshot` が保存されている
   - `natori_quotes.pricing_snapshot` が保存されている
   - `amount = pricing_snapshot.total`
   - `active_quote_id` が発行quoteを指す
   - project statusが`quoted`

### 4.2 改訂発行

1. 同じ案件で新しい発行操作を行う。
2. versionが1増えることを確認する。
3. 旧quoteの`superseded_at`が設定されることを確認する。
4. 旧承諾リンクが無効、新承諾リンクが有効であることを確認する。

### 4.3 非retryableエラー

1. 宛先やpayloadを不正にした状態で送信する。
2. 400または409のエラーになることを確認する。
3. フォーム固定が解除され、宛先・件名・本文を編集できることを確認する。
4. 修正後に新しい発行操作を開始できることを確認する。

### 4.4 retryableエラー

テスト環境でメール送信失敗または通信結果不明を再現できる場合のみ実施する。

1. 初回送信後、画面に再試行案内が出ることを確認する。
2. 宛先・件名・本文が固定されることを確認する。
3. 「同じ内容で再試行」を実行する。
4. quote versionが増えないことを確認する。
5. 同じ承諾リンクが使用されることを確認する。
6. 案件メモの送信履歴が重複しないことを確認する。
7. 同一quoteメールが重複配信されないことを確認する。

## 5. 本番migration適用前確認

次のmigrationだけがP1-09対象であることを確認する。

- `20260801234935_etorie_quote_snapshots_retry.sql`
- `20260802002947_harden_quote_snapshot_numeric_validation.sql`

適用前に必ず以下を確認する。

1. 本番project refが`lvnfspyainrxtztjytbo`である。
2. test project ref `rlpljepcdreenjwwxrmg`と取り違えていない。
3. migration履歴に同じversionが存在しない。
4. 本番DBバックアップまたは復旧手段が確認できている。
5. 適用担当者から明示承認を得ている。

## 6. 本番反映順序

明示承認後、次の順序で実施する。

1. PRをReady for reviewへ変更
2. 最終レビュー
3. Production deploymentを開始しない状態を確認する
4. 本番SupabaseへP1-09 migrationを適用
5. `natori_issue_quote_v1`、追加列、trigger、権限が利用可能であることを確認する
6. PRをマージしてProduction deploymentを開始する
7. Production deploymentの成功確認
8. 管理画面で1件の最小動作確認
9. quote発行・承諾ページ・案件状態を確認

Vercelが`main`へのマージを契機に自動Production deploymentする場合、**migrationをマージ前に適用する**。新コードは新RPCを呼ぶため、アプリケーションを先に公開してはならない。

今回のmigrationは既存経路を壊さない後方互換の追加変更として設計しているが、適用直前に改めて差分を確認する。migration適用後、アプリのマージを中止した場合も、追加列・function・triggerを慌てて削除せず、そのまま保持して原因を確認する。

## 7. ロールバック判断

次の場合は新規発行操作を停止し、原因確認を優先する。

- `natori_issue_quote_v1`が存在しない、または権限エラーになる
- 正常payloadがDB業務エラーで拒否される
- quote versionが重複・飛び越し・意図せず増加する
- 旧quoteがsupersedeされない
- 承諾リンクと保存token hashが一致しない
- snapshotまたは金額が発行内容と異なる

P1-09 migrationは列・index・function・triggerを追加するため、障害時に安易なdown migrationは行わない。既存legacy経路への切り戻し可否を確認し、データ保全を優先する。

## 8. 完了条件

以下をすべて満たした時点でP1-09完了とする。

- ローカルtest・typecheck・build成功
- 手動E2E正常発行成功
- 改訂発行と旧quote無効化を確認
- retryable / nonretryable挙動を確認
- PR最終レビュー完了
- 明示承認後、本番migrationを先行適用
- 明示承認後にマージ
- Production最小動作確認成功
