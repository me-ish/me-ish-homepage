# Natori Phase N — 承諾・受取とメール通知の分離

更新日: 2026-09-27。開始main: `31b43bb65923a853448d4ae65e2cc3580c126bc4`。作業ブランチ: `codex/natori-phase-n`。

## 対象と現状

統合改善計画のPhase N。見積り承諾→作家通知、納品受取→作家通知、納品受取→依頼者控えの3通知に限定する。F12を扱い、F03/F05/F09/F22/F02/F16/F08の後続接続先を用意する。他の通知をこのWorkで移行したとは扱わない。

実装と隔離環境での必須試験を完了し、[Draft PR #98](https://github.com/me-ish/me-ish-homepage/pull/98) に保存した。**本番DB migration、main取り込み、本番配信、新設定の有効化、実メール送信は実施していない。** 前Phaseの本番承認をPhase Nへ拡張していない。Phase N全体の本番完了ではなく、レビュー可能な実装成果である。

製品コードの検証headは `ad6e7655f43146f2f8436b3944650e631cf44835`、Actionsが実際にcheckoutしたPR merge SHAは `c86973774677161187a645893faa0c81c58df75e`。以降はこの報告書だけの追記であり、製品コード・migration・試験コードは同一。最新PR head/ChecksはPR上で確認する。開始後のmainは上記開始SHAのまま。

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

Phase Tを引き継ぎ、GitHub-hosted Ubuntu 24.04で一時Supabase DB/Auth/Storageを起動する。CLI **2.118.0**（既存SHA256固定）、Nodeは`.node-version`から **22.23.2**、Supabase JS **2.76.1**、SSR **0.8.0**、esbuild **0.28.1**、Playwright **1.58.2**。SDK/ツールは既存lockfileのまま。追加製品依存なし。イメージdigestと試験SHAはActions artifact `versions.txt`に残す。

`Natori Phase N` workflowはmain向けPRのopened/synchronize/reopened/ready_for_reviewで動く。mainへ先にマージする必要はない。GitHubの同一run再実行は、そのrunのSHAで検証する。最新コードはPR更新に伴う新runを確認する。

構築時のみツール/イメージを取得し、その後全stackをinternal networkへ移す。試験プロセスと子プロセスには、専用Kong IP:8000と同じnamespaceの捕捉サーバ127.0.0.1:3101を許可する。ブラウザ段階では同namespaceのNext用127.0.0.1:3000だけを追加し、通信の否定試験を再実行する。外部providerへの通信は行わない。To/BCC/Reply-Toは架空アドレスの明示allowlist。ログ・artifactへ本文、宛先、認証情報を出さない。上限25分、PRごと同時1run、後始末は専用ラベル/プロジェクトのみ。

試験では製品のResend HTTP送信関数をそのまま呼ぶが、**隔離試験コード内だけ**で通信をローカル捕捉サーバに接続する。捕捉サーバは同key同payloadの受付再現、明確な拒否、受付後応答切断を行う。本番コードに任意provider URL設定は追加しない。

実DBのtransaction、競合、lease、再試行を確認する試験であり、**外部Resendの実受付や実際の受信箱到着を証明する試験ではない**。

## 検証結果

| 検証 | 結果 | Actions |
|---|---|---|
| Phase N 実DB/HTTP捕捉 | **23成功 / 0失敗 / 0skip** | [36305583065](https://github.com/me-ish/me-ish-homepage/actions/runs/36305583065) |
| Phase N 実Next/Chromium | **7成功 / 0失敗 / 0skip** | 同上 |
| 通信隔離 | 17成功 / 0失敗 / 0skip。通信許可port追加後にも同じ17件を再実行 | 同上 |
| 実Storage基盤 | 現行35成功・候補35成功、失敗/skip 0 | 同上 |
| 通常CI unit | 126ファイル **1,163成功 / 0失敗 / 0skip** | [36305583078](https://github.com/me-ish/me-ish-homepage/actions/runs/36305583078) |
| 既存E2E | 15成功 / 0失敗 / **既存4skip**（変更なし） | 同上 |
| Type Check / Lint / Security Audit | 成功 | 同上 |
| Phase 0B 回帰 | 実Auth/DB 19成功、ブラウザ13成功、失敗/skip 0 | [36305583027](https://github.com/me-ish/me-ish-homepage/actions/runs/36305583027) |
| Phase T | 成功 | [36305583062](https://github.com/me-ish/me-ish-homepage/actions/runs/36305583062) |
| Vercel自動Preview | 検証headでbuild成功。本番配信ではない。安全なDB試験環境にも流用していない | PRのVercel check |
| Phase 0A | 下記参照。既知のgallery競合1件が再発 | [36305583052](https://github.com/me-ish/me-ish-homepage/actions/runs/36305583052) |

**Phase Nの重要な成立シナリオ**:

- 見積り承諾6並列で確定1回・通知1件、納品受取6並列で完了1回・通知2件・activity1件。
- 通知保存失敗は同transactionの確定/完了/activityもrollback。DB確定後の応答喪失は実際の確定記録を照会して成功を返す。未確定のDB障害を成功扱いにしない。
- provider拒否後の再試行は新attemptだけを作成。過去attemptと業務行を保持。
- provider受付後の応答切断、受付後DB記録失敗は同key/payloadで復旧し、重複メールを作らない。再試行時のAPI key不備でも過去のunknownを未送信扱いに変更しない。
- 中断worker・lease失効・古いworkerのstart/finishを検証。23時間超unknownと回数上限ではproviderへ通信しない。
- 導入前accepted行は新規通知0件。既存未入金/期限切れ/アーカイブ等の拒否判定を維持。
- DB/RPCは匿名と実Authの無権限ユーザーを拒否。管理APIは未認証、CSRF不備、他owner案件を拒否。本文・宛先・provider IDを応答に含めない。
- 未送信を成功履歴より先に表示し、50件ずつページングする。
- 実ブラウザでメール失敗後も承諾/受取の成功表示が残り、ページ再訪でも確定が保たれる。管理ホームからメール1件だけを再試行し、業務データが変わらない。
- 390px幅で操作・横はみ出しを確認。通知欄のスクリーンショットも目視確認。これはiPhone Safari実機試験ではない。

HTTP捕捉結果: DB試験で13 provider requests / 9 distinct accepted messages、ブラウザで4 requests / 1 accepted message。既知の送信拒否・同key再試行を含むため、request数と受付数は一致しない。**外部の実メール送信件数は0**。

証跡: artifact `natori-phase-n-36305583065-1`（保持7日）、`versions.txt`、`phasen.json`、`phasen-browser.json`、`phasen-notification-mobile.png`、catalog/通信カウンタ。artifact digest `sha256:841c682aeb55ed2d03882d62b786a6dc9023d3c226dd8df1fdd048c03ed2d474`。根拠となるsummaryはActionsログにも残る。専用コンテナ/ネットワークのcleanup exit=0。

**既知のgallery問題の扱い**: Phase 0A `after/concurrent-observed-natural` が、公開画像の同時処理中のStorage download 500を受け `FINISH_HTTP_503` となった。before 26成功、after 25成功/1失敗/0skip。2026-09-27のユーザー方針「me-ishギャラリー側は今回重要視せず進行可」を適用し、Phase Nへ修正を混ぜない。テストは失敗のまま正直に残し、skip/continue-on-error/期待値緩和をしていない。**全workflowが緑という報告はしない**。ナトリの確定・通知、共有Auth/Storage認可の失敗と取り違えない。

**途中で修正した検証上の問題**:

1. 初回通常CIの2失敗は、旧RPC名を固定したソース検査と新migrationのmanifest登録不足。旧RPC維持の検査を追加したうえで更新し、新migrationを末尾に登録。既存 `20260923122157_natori_estimate_drafts_and_issuance.sql` の不足checksum 1件も、SQLを変更せず登録。既存migrationの並べ替え/再実行はしていない。静的migration検査も0失敗。
2. 2回目専用run `36305175799`: 22成功、ページング用fixtureの一括INSERT 1失敗。未指定値にDB defaultを使用するよう修正。失敗を理由にブラウザ試験をskipして成功扱いにせず、そのrunを失敗終了した。
3. 同headのVercel Previewは`lint_or_type_error`。Next buildが生成する引数検査を確認し、GETのRequest引数を必須へ修正した。修正後のPreview build成功を確認。`next typegen`/通常tscのみではこのbuild検査を代替しない。
4. ローカルはNode 24.19.0で補助的に型/unit/静的検査を実行。リリース判断には、既存`.node-version`のNode 22.23.2で実行した上表のActions結果を使う。

## 主な変更ファイル

| 領域 | ファイル |
|---|---|
| DB | `supabase/migrations/20260927073530_natori_acceptance_notifications.sql`、`supabase/baseline/manifest.json` |
| 確定・通知server | `src/features/natori/server/{quoteAcceptService,deliveryService,acceptanceNotifications,scheduleAcceptanceNotifications,notificationManagement}.ts` |
| API | `src/app/api/natori/{quote/accept,delivery/accept,admin/notifications}/route.ts` |
| 管理UI | `src/features/natori/components/dashboard/NotificationStatusPanel.tsx`、`src/app/[locale]/natori/dashboard/page.tsx` |
| 型・既存回帰 | `src/types/supabase.ts`、`src/features/natori/types/notifications.ts`、`src/lib/__tests__/etorie-p1-12-delivery-atomicity.test.ts` |
| 専用試験 | `.github/workflows/natori-phase-n.yml`、`scripts/natori-phase-n/*`、`scripts/natori-phase-t/run.sh`、`scripts/natori-phase-0b/prepare-browser.mjs` |
| 報告 | 本ファイル |

全差分は[PR #98 Files](https://github.com/me-ish/me-ish-homepage/pull/98/files)。既存workflow条件、製品依存/lockfile、既存migration本文は変更していない。

## 本番移行の順序・停止条件

1. 本番反映承認と最新main/本番SHA、上記旧RPC定義の再照合。差分があれば停止する。
2. **Expand**: 追加migration `20260927073530_natori_acceptance_notifications.sql`のみを適用。既存migrationを全再実行しない。新tableが空であること、RLS/GRANT/RPCが想定どおりであることを確認。
3. **Compatibility deploy**: 新コードを両フラグ未設定（既定OFF）で配信し、既存経路との互換を確認する。
4. **隔離外部メールgate**: 承認済みテスト送信先だけを使う別の安全な試験設定で3通知を実Resendへ送信し、provider受付と受信箱到着を別々に確認。To/BCC/Reply-Toも全件確認。現在は資格情報/宛先/送信承認を要求していないため未実施。このgateをローカル捕捉で代替しない。
5. **Cutover**: `NATORI_ACCEPTANCE_OUTBOX_ENABLED=1`に加え、既存送信元/作家通知先設定を明示する。新senderは個人メールアドレスへの暗黙fallbackを使わない。確認後`NATORI_NOTIFICATION_SENDING_ENABLED=1`を有効にする。両設定はserverのみ。Vercelの環境変数変更には新しいdeploymentへの反映が必要で、対象SHAとflagの組を記録する。切替途中に確定した通知はpendingとして管理ホームから処理できる。
6. 新旧senderが同一通知を送らないこと、確定応答、pending/unknown件数を確認。正式案件を承諾・受取する動作試験に流用しない。
7. 安定後も旧RPC/column/履歴はこのPhaseでは削除しない。**Backfillなし、contractなし**。

## Rollback・運用

- 切替前: additive DBを残してアプリだけ戻せる。
- 切替後: まず`NATORI_NOTIFICATION_SENDING_ENABLED=0`で送信停止。outboxは有効のまま確定事実とpendingを保持する。単純な旧版rollbackやoutbox OFFを通常の復旧手段にしない。
- 新sender障害時はlease失効後に管理ホームで「状態を更新」→対象の「メールだけ再試行」。承諾/受取APIを再実行して通知を作り直さない。
- `sent`はprovider受付済み。迷惑メール振分け/後日bounce/相手が未読であることと区別する。
- 23時間超unknownはprovider管理画面で既存受付を照合する。証拠なしに新keyで再送しない。このWorkでは強制送信/結果確定ボタンを作らない。
- 管理表示の取得失敗を「通知なし」に見せない。管理画面の詳細は未解決を先に、通知ごとの最新状態を50件ずつ表示し、前/次ページで全件を確認する。
- **残条件**: 実メール試験用の安全な設定と許可済み送信先を確定し、実Resend受付/受信を確認する。iPhone Safari実機で管理通知欄を確認する。最終本番承認を得る。これらは本番切替前のgateであり、今回の隔離試験だけで完了にしない。納品実体/readyのF04・U04、見積り発行・支払・相談通知は後続Phaseで接続する。

参照: [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)、[Next.js after](https://nextjs.org/docs/app/api-reference/functions/after)、[Supabase Functions](https://supabase.com/docs/guides/database/functions)。
