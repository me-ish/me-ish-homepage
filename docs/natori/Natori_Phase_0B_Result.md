# Natori Phase 0B — 管理対象 owner と操作主体 operator の分離

更新日: 2026-09-27。対象: F18、F23 の owner 混同部分のみ。

## 結論と今回の境界

管理画面を使うスタッフや、共有管理 Cookie と同居する一般ログインによって、表示・登録する案件の持ち主が変わる問題を修正する。表示・保存先は公開受付と同じ `NATORI_OWNER_USER_ID` に固定し、操作を許すかどうかは従来の管理者・スタッフ・共有管理 Cookie で判定する。

開始 main: `942a55d7e1359be11243e676a41d12425ae55a5d`。作業ブランチ: `codex/natori-phase-0b`。
Phase 0A の取り込み済み main から分離した worktree で作業。依存・lockfile・Node 指定の変更なし。Phase 0A の Storage policy は変更しない。

実装・Draft PR・CI 検証までをこの Work の範囲とする。**本番への適用は未実施。DB migration、既存行の移動・削除、トークン再発行、メール・Stripe 操作は行わない。**

## 設計

- `trustedNatoriOwner.ts`: 公開受付と管理経路が同じ設定検証を使用。空白・大文字を正規化し、UUID 形式を検証。ログイン ID や「DB で最初に見つけた owner」への fallback を廃止。
- `requireNatoriAdmin.ts`: 認可結果を `auth-user/userId` または `shared-key/null` として返す。共有 Cookie で許可した場合、同居するログインユーザーへ操作を誤帰属させない。既存の管理用 allowlist と Cookie の HMAC 検証は維持。
- `natoriOwner.ts`: 認可後に固定 owner を解決。未認可は 401、owner 設定の不足・形式不正は 503。設定エラーを「案件なし」「プロフィールなし」「料金設定なし」の成功応答へ変換しない。
- `natoriManagementScope.ts` / `natoriManagementRoute.ts`: リクエスト単位の AsyncLocalStorage。認可済み owner/operator を下位 service へ渡し、並行リクエスト間で混ぜない。共有のプロセス全体キャッシュに認証情報を保持しない。
- 案件一覧 reader: `natori_owner_unavailable` の日本語説明を既存の画面エラー表示まで伝える。その他の未知の失敗は従来の一般エラーを維持。
- 管理 API: projects/events/profile/pricing、delivery-files、consultation、estimate-draft、external-inquiry、structured-quote、order-mail、project-activity、project-links、project-thumbs を同じ境界で包む。CSRF・入力検証・既存 owner 条件は維持。
- `consultation-file`: 管理者による projectId 経路だけを境界で包む。依頼者 token 経路は従来の token 検証を維持し、管理設定への依存を追加しない。
- 管理案件作成: HTTP 入力の userId を採用せず、service でも固定 owner を強制。公開 legacy 起票は、公開専用の信頼済み設定解決から既存 RPC を呼ぶ。古いタブ・ブックマークを廃止しない。設定不備なら legacy route も画像保存・起票・通知より前に停止。
- owner と無関係な公開 portfolio、links content、page-events、依頼者向け quote/delivery/consultation token 検証は、今回の固定 owner 境界へ機械的に移さない。

管理 API の変更操作には request ID・operation 名・固定 owner・operator・開始/HTTP 応答/例外を構造化ログとして残す。本文、顧客名、メールアドレス、Cookie、token、署名 URL は記録しない。これは**操作試行の運用ログ**であり、業務 transaction と原子的に保存される永続監査台帳ではない。HTTP 200 を「メール送信済み」「入金確定」等の証明とは扱わない。後続の通知・operation 設計で必要なら永続化を追加する。

## 本番の読み取り確認

2026-09-27、専用の Phase 0A テスト案件から公開受付の owner グループを特定し、件数のみ集計した。顧客の本文・メール、Auth ユーザー一覧、実ファイル、設定値・秘密情報は取得していない。

| owner グループ | 案件総数 | deleted_at が NULL | paid_at がある行 | 予定 | プロフィール | 料金設定 |
|---|---:|---:|---:|---:|---:|---:|
| 公開受付と同じ owner | 17 | 16 | 14 | 1 | 0 | 3 |
| 別 owner | 0 | 0 | 0 | 1 | 0 | 3 |

`paid_at` の件数は入金の再照合結果ではない。deleted_at の有無も業務 status とは区別する。

**予定 1 件と料金設定 3 件が別 owner に存在するため、本番切替には確認が必要。自動的に移動・合算・削除しない。** 固定 owner のデータはすでに存在するが、どちらの設定を業務で使用しているかは、この集計だけでは決めない。表示対象変更により必要な予定・料金設定が見えなくならないことを、切替前にナトリ先生の運用と照合する。

## 検証

### 自動試験

- 単体: 認可・固定 owner・未設定/不正 UUID・401/503・同時実行の分離・操作ログに payload を含めないこと・予期しない例外を成功へ変換しないこと。
- legacy: 未設定時に画像・案件・通知を開始しない。既存 RPC 経路と owner を確認。F23 の冪等性・通知失敗は Phase 3A に残す。
- 実 Supabase: GitHub-hosted Linux の Phase T 隔離環境を再利用。DB/Auth/Storage、SSR cookie client、実 `auth.getUser()`、実 API handler、service-role DB クエリを使用。
- owner・staff 2 名・一般ユーザーの架空 Auth アカウントと複数 owner の架空行を使用。同じ案件表示、共有 Cookie + 別ログイン、非管理者拒否、同時認証分離、新規作成、他 owner の更新拒否と全列不変、確定列を保った正常更新、legacy 起票、設定不備時の無書込を試験。
- 作成 RPC は `supabase/legacy-migrations/202607200001_natori_beta_safety.sql` から対象関数だけを厳密に抽出。全 migration や本番 seed は実行しない。
- `scripts/natori-phase-0b/fixture.sql` は今回の所有者境界に必要な最小テーブル。実本番スキーマ全体・アプリ RLS の再現ではない。service role によるサーバーの owner 絞り込みを検証する。クライアントからの直接 table access は fixture で拒否。
- Next の `cookies()` だけを request-local adapter に差し替える。Supabase SSR client / Auth / DB は本物。実ブラウザの Cookie 保存、middleware、ページ描画をこの試験で実証したとは扱わない。
- 既存 CI、Phase T、Phase 0A の条件・skip・continue-on-error は変更しない。

ローカル検証: Vitest 126 files / 1,160 passed / 0 failed / 0 skipped、型チェック成功、変更範囲 ESLint 成功。既存 jsdom の navigation 未実装メッセージは試験失敗なし。追加した案件 reader の検証は 7 件成功（既存 4 件 + 新規 3 件）。最終差分の合計は CI で再確認する。Work の Node は 24.19.0、Actions は既存 `.node-version` の 22 系。依存は既存 lockfile を使用。Supabase CLI 2.118.0 と固定 checksum、実際の Node/Docker/DB/image digest は Phase T artifact の `versions.txt` に記録する。

### 通信と実行制限

ツール・イメージ取得と試験段階を分離。Phase T の internal Docker network と kernel egress allowlist を継承し、試験プロセス・子プロセスは専用 Kong の固定 IP:8000 のみ接続可能。DNS/IPv6/外向き接続は拒否。production らしい接続先の通信前拒否、子プロセスの遮断を既存 17 件で再確認。本番 Secrets を導入せず、専用ランダム認証情報は一時マウントのみ。

workflow は PR の opened/synchronize/reopened/ready_for_review、contents:read、25 分上限、同一 PR の古い run をキャンセル。追加 integration は 240 秒上限・自動再試行なし。既存 cleanup がこの job の dedicated resources のみを停止。生成 bundle・fixture・認証情報は Git/公開成果物へ含めない。

## 再実行

1. 作業ブランチから main 向け Draft PR を作成・更新する。main 取り込みは初回試験に不要。
2. GitHub Actions の **Natori Phase 0B / Fixed owner with real Auth and DB** を確認。失敗した場合は失敗理由を直し通常 push、または該当 run を再実行する。
3. `phase0b.json`、Storage の current/candidate、`isolation.json`、`versions.txt` を確認。環境起動・Auth 失敗は skip ではなく job failure。
4. ローカルのコード試験は `npx vitest run`、`npx tsc --noEmit`、`npm run lint`。本番 .env は不要。統合 runner は GitHub-hosted Linux 専用で、ユーザー PC/Docker は前提にしない。

## 本番反映前の必須条件と順序

1. 対象 SHA の必須 CI・Phase 0B 実試験・Phase 0A 回帰が成功していること。
2. `NATORI_OWNER_USER_ID` が本番に設定され、存在する Auth owner / 現行公開受付と一致することを秘密値を出さず確認。UUID 形式の成功だけでは誤設定された別 owner の安全性を証明できない。
3. 上記の別 owner の予定・料金設定の扱いを決める。必要なら別の限定移行手順を作成し、個別承認・比較・バックアップ後に実行。この PR は既存 user_id を変更しない。
4. 隔離または安全な検証先で、本人・スタッフのブラウザから同一案件一覧を確認。共有管理 Cookie と別ログインの組み合わせ、ログアウト/再ログイン、503 の画面表示も確認。自動 API integration のみでこの gate を省略しない。
5. 承認後に main 取り込み・通常の配信。DB expand/backfill/contract は今回不要。owner 設定を先に確認してからアプリを切り替える。
6. 本番は読み取り確認を優先。既存案件・旧 token/URL・入金/受取記録を比較。実メール・決済を確認のために発生させない。

### Rollback

DB 変更なしなのでデータの巻き戻しは不要。ただし旧 session-first owner 解決へそのまま戻すと再び誤所属の危険がある。異常時は管理の書込を停止し、固定 owner を維持する修正版または確認済み設定へ戻す。既存行の一括移動・token 再発行で帳尻を合わせない。設定変更が必要なら対象 owner と正式案件を再照合する。

## 未完了・後続へ渡す事項

- 本番の別 owner 予定・料金設定の必要性確認、設定値の存在と照合、実ブラウザの管理操作確認、本番適用は未実施。
- F23 全体、通知状態分離、決済/見積り/納品の状態整合性は後続 Phase。本変更で解消したと主張しない。
- Safari ホーム画面版の添付白画面（PWA-01）は利用者承認済みの別課題。今回変更しない。
- Phase 0A の残存テストファイル cleanup は混ぜない。既存ファイル・リンクを維持。


## GitHub 実行証跡

[Draft PR #97](https://github.com/me-ish/me-ish-homepage/pull/97)。初回実装 head: `33d75a347472b6fca20cfe1bf3495173c691c65e`、Actions が実行した PR merge SHA: `5281f347b32db1050e9181cce962daa686d0b5f5`。本番 merge ではなく PR 試験用の合成コミット。

| 検証 | run | 実際の結果 |
|---|---|---|
| Phase 0B | [36295109496](https://github.com/me-ish/me-ish-homepage/actions/runs/36295109496) | 実 Auth/DB 19 成功・0 失敗・0 skip。隔離 17 + Storage baseline 35 + candidate 35 も成功。専用リソース cleanup 成功 |
| Phase 0A 回帰 | [36295109492](https://github.com/me-ish/me-ish-homepage/actions/runs/36295109492) | 隔離 17、Storage 35 + 35、実 server adapter 24 + 24、cutover approval/drift guard 成功。0 失敗・0 skip |
| Phase T | [36295109604](https://github.com/me-ish/me-ish-homepage/actions/runs/36295109604) | job 成功 |
| 既存 CI | [36295109479](https://github.com/me-ish/me-ish-homepage/actions/runs/36295109479) | 型・Lint・Audit・Vitest 1,160 件成功。E2E と最終差分の結果は PR の検証欄で確認 |

Phase T の current/baseline は監査時の広い policy を再現した架空環境を指す。本番は Phase 0A 適用後であり、現在の本番がその広い policy のままであるという意味ではない。

初回 CI 後の差分は、設定エラーの日本語表示、対応する reader 試験 3 件、専用 workflow の該当 path、実行バージョン記録への SSR 追加、この証跡のみ。最終 head に対して再度 CI を実行し、その SHA・結果を PR 本文へ記録する。証跡文書に自身の将来の commit SHA を埋め込むための繰り返し commit は行わない。

CLI の通常 push は GitHub 認証が利用できず失敗したため、接続済み GitHub の Git API で同一 tree（`a21e61fa2845361b3cfe2fc5503a75aba45861da`）を保存した。branch 作成および後続更新は通常の親子関係を維持し、force 更新なし。認証情報の取り出し・権限迂回なし。
