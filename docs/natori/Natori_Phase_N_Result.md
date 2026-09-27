# Natori Phase N — 承諾・受取とメール通知の分離

更新日: 2026-09-27。開始main: `31b43bb65923a853448d4ae65e2cc3580c126bc4`。作業ブランチ: `codex/natori-phase-n`。

## 対象と現状

統合改善計画のPhase N。見積り承諾→作家通知、納品受取→作家通知、納品受取→依頼者控えの3通知に限定する。F12を扱い、F03/F05/F09/F22/F02/F16/F08の後続接続先を用意する。他の通知をこのWorkで移行したとは扱わない。

現段階は実装・検証中のDraft。**本番DB migration、main取り込み、本番配信、新設定の有効化、実メール送信は実施していない。** 前Phaseの本番承認をPhase Nへ拡張していない。

## 変更

- `natori_notification_jobs`: 1行/attempt。確定事実と初回通知を同じDB transactionで保存。既存RPCを新しいinvoker wrapperから呼び、旧署名・ロック・判定を維持する。
- 業務確定HTTP応答の後にNext.js `after()`で最大2通知を送る。プロセス中断でも台帳から管理者が再試行できる。初回は新しい定期Cron/別キューを導入しない。
- payload・宛先・BCC・Reply-Toは初回送信前に固定。通知ごとの同じprovider keyで再照会・再試行。受付成功後のDB記録中断は`unknown`として扱う（台帳上` sending`のlease失効も同等）。
- 2分leaseとclaim tokenにより古いworkerの状態上書きを拒否。自動claim最大3回、手動を含め8回。明確な未受付の場合のみ新attemptを作成し、最大5attempt。未知の結果は新keyに交換しない。
- Resendの24時間のkey保持に対し23時間で自動/通常手動再送を停止。期限超過・上限到達は送信事業者側の確認が必要。再送失敗で過去の成功日時を消さない。
- 管理ホームに通知状態・最終受付・メールだけの再試行を追加。認証/合言葉、固定owner、CSRF、レート制限を通す。メール本文・宛先・provider ID・tokenをブラウザへ返さない。
- 業務状態、原回答、合意条件、入金、quote snapshot、token/URL、Storage、既存メール履歴を一括変更しない。既存accepted行に履歴がないという理由で新規通知を作らない。

## 本番定義との照合

本番は関数カタログのみ読み取った。業務行・Authユーザー・実ファイルは取得していない。

| 関数 | 空白除去後body MD5 | fixtureとの対応 |
|---|---|---|
| `natori_accept_quote(text)` | `f04bea47a77f376d5b10573807833498` | カタログsnapshotをテスト専用SQLに保存。baselineとの差はコメントとnote区切りのエスケープ表現。現行定義を維持し、本番関数は書換えない |
| `natori_accept_delivery_v1(text)` | `841ce71cf8887f868d1da2f328d69503` | 既存migrationと一致 |
| `record_natori_delivery_activity()` | `5df1d245d512c66342fccd54789ed5ec` | 既存migrationと一致。実際のactivity triggerも隔離試験へ組み込む |

いずれもEXECUTEはpostgres/service_roleのみ。新RPCはsecurity invoker、空search_path、明示service_role限定。新tableはRLS有効、anon/authenticated/PUBLICの権限なし。

## 試験環境と再実行

Phase Tを引き継ぎ、GitHub-hosted Ubuntu 24.04で一時Supabase DB/Auth/Storageを起動する。CLI **2.118.0**（既存SHA256固定）、Nodeは`.node-version`、SDK/ツールは既存lockfileのまま。追加製品依存なし。イメージdigestと試験SHAはActions artifact `versions.txt`に残す。

`Natori Phase N` workflowはmain向けPRのopened/synchronize/reopened/ready_for_reviewで動く。mainへ先にマージする必要はない。GitHubの同一run再実行は、そのrunのSHAで検証する。最新コードはPR更新に伴う新runを確認する。

構築時のみツール/イメージを取得し、その後全stackをinternal networkへ移す。試験プロセスと子プロセスには、専用Kong IP:8000と同じnamespaceの捕捉サーバ127.0.0.1:3101だけを許可する。外部providerへの通信は行わない。To/BCC/Reply-Toは架空アドレスの明示allowlist。ログ・artifactへ本文、宛先、認証情報を出さない。上限25分、PRごと同時1run、後始末は専用ラベル/プロジェクトのみ。

試験では製品のResend HTTP送信関数をそのまま呼ぶが、**隔離試験コード内だけ**で通信をローカル捕捉サーバに接続する。捕捉サーバは同key同payloadの受付再現、明確な拒否、受付後応答切断を行う。本番コードに任意provider URL設定は追加しない。

実DBのtransaction、競合、lease、再試行を確認する試験であり、**外部Resendの実受付や実際の受信箱到着を証明する試験ではない**。

## 検証結果

- ローカル型チェック: 成功。
- 関連既存unit/APIテスト: 5ファイル49件成功、失敗0、skip0。
- 隔離DB/HTTP捕捉試験: Actions実行待ち。結果を後追記する。
- ブラウザ: 準備中。実機Safariは未確認。

## 本番移行の順序・停止条件

1. 本番反映承認と最新main/本番SHA、上記旧RPC定義の再照合。差分があれば停止する。
2. **Expand**: 追加migration `20260927073530_natori_acceptance_notifications.sql`のみを適用。既存migrationを全再実行しない。新tableが空であること、RLS/GRANT/RPCが想定どおりであることを確認。
3. **Compatibility deploy**: 新コードを両フラグ未設定（既定OFF）で配信し、既存経路との互換を確認する。
4. **隔離外部メールgate**: 承認済みテスト送信先だけを使う別の安全な試験設定で3通知を実Resendへ送信し、provider受付と受信箱到着を別々に確認。To/BCC/Reply-Toも全件確認。現在は資格情報/宛先/送信承認を要求していないため未実施。このgateをローカル捕捉で代替しない。
5. **Cutover**: `NATORI_ACCEPTANCE_OUTBOX_ENABLED=1`に加え、既存送信元/作家通知先設定を明示する。新senderは個人メールアドレスへの暗黙fallbackを使わない。確認後`NATORI_NOTIFICATION_SENDING_ENABLED=1`を有効にする。両設定はserverのみ。切替途中に確定した通知はpendingとして管理ホームから処理できる。
6. 新旧senderが同一通知を送らないこと、確定応答、pending/unknown件数を確認。正式案件を承諾・受取する動作試験に流用しない。
7. 安定後も旧RPC/column/履歴はこのPhaseでは削除しない。**Backfillなし、contractなし**。

## Rollback・運用

- 切替前: additive DBを残してアプリだけ戻せる。
- 切替後: まず`NATORI_NOTIFICATION_SENDING_ENABLED=0`で送信停止。outboxは有効のまま確定事実とpendingを保持する。単純な旧版rollbackやoutbox OFFを通常の復旧手段にしない。
- 新sender障害時はlease失効後に管理ホームで「状態を更新」→対象の「メールだけ再試行」。承諾/受取APIを再実行して通知を作り直さない。
- `sent`はprovider受付済み。迷惑メール振分け/後日bounce/相手が未読であることと区別する。
- 23時間超unknownはprovider管理画面で既存受付を照合する。証拠なしに新keyで再送しない。このWorkでは強制送信/結果確定ボタンを作らない。
- 管理表示の取得失敗を「通知なし」に見せない。管理画面の詳細は最新100試行が上限であり、超過時は明示する。
- 外部メール試験、iPhone Safari実機、最終本番承認は本番切替前の残条件。納品実体/readyのF04・U04、見積り発行・支払・相談通知は後続Phaseで接続する。

参照: [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)、[Next.js after](https://nextjs.org/docs/app/api-reference/functions/after)、[Supabase Functions](https://supabase.com/docs/guides/database/functions)。
