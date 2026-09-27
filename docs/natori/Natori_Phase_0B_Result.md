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


## 本番反映承認後の補足（2026-09-27）

利用者は14:02 JSTに、別 owner の過去予定（2026-06-07）と未使用の「つなぐ用」設定を引き継がないことを確認。元行の削除や移動は行わない。14:07 JSTに本番反映を承認した。承認は下記の未完確認を免除するものではない。最新の配信状況・対象 SHA は PR 本文を正とする。

通常運用は合言葉付き専用 URL。確認用クラウドブラウザにその認可がなく、一般の Google ログインへ案内したため、この方法での確認を中止した。利用者に秘密 URL の送付や Google ログインを求めない。代わりに既存 Phase T の隔離環境へブラウザ試験を追加する。これは必須 gate の省略ではなく、同じ合言葉・Cookie・ページ描画を架空データで確かめる実施方法の変更。

### 追加ブラウザ試験

- 既存 lockfile の Playwright 1.58.2、公式 `mcr.microsoft.com/playwright:v1.58.2-noble`、`.node-version` からの Node 22 を使用。image digest、実 Node 版、コピーした route/middleware の checksum を成果物に記録。依存・lockfile は変更しない。
- `prepare-browser.mjs` は管理 dashboard/projects、middleware、API、関連 feature を専用一時ディレクトリへコピー。対象 page/layout/API と認可コードは無変更。最上位 shell からのみ外部フォント・解析・ギャラリー overlay を除外するため、サイト全体の視覚比較や本番 OAuth の試験とは扱わない。
- 合言葉経路は実 middleware で Cookie を発行し、URL からのキー除去、HttpOnly/Secure/SameSite、別画面への遷移、同一ブラウザ内での再オープンを確認。Cookie 注入でこの経路を代替しない。
- 本人・スタッフ2名・一般ユーザーは使い捨て Auth。テスト専用 form/route で実 `signInWithPassword` と本物の Next `cookies()` を使う。テスト専用 route は `scripts` 配下で組み立てる一時 app のみに存在し、製品 app へ追加しない。Auth/API/DB のモックや `cookies()` adapter は使わない。
- 合言葉 + 一般ログイン、スタッフのログアウト・再ログイン、匿名/一般ユーザー/誤キー拒否、設定不足/不正値の HTTP 503 と画面のエラー詳細表示、前後の業務行不変を確認。loopback 接続の対照試験を含め13シナリオを予定。実結果は Actions 完了後に PR へ記録し、作成だけで成功としない。
- 既存の17隔離試験・35+35 Storage・19 Auth/DBは維持。ブラウザ段階だけ同じ network namespace 内の `127.0.0.1:3000` とその応答を追加許可。一般の loopback、DNS、外部宛先、host gateway は遮断したまま、17隔離試験を再実行する。新コンテナとその子プロセスも同じ kernel 制限を継承。公開 port/トンネルなし。
- ブラウザ用コンテナは非 root、cap-drop、read-only root、4 GiB/2 CPU/pids256、実行600秒・再試行なし。全 workflow は従来どおり25分・同時実行制限あり。cleanup はこの job のラベル付き専用コンテナだけを対象。
- Next の生ログ・trace・storageState・credential file を artifact に含めない。架空案件画面のスクリーンショットと件数/固定エラーコードのみ公開。起動失敗は skip でなく失敗。

### 本番の追加読み取り

同じ専用テスト案件に基づく集計で、owner の Auth 存在を boolean で確認した。案件は18件、別 owner の案件は0件。現在の本番配信が ready になった後の新規2件は同じ owner に属し、最新の作成時刻は2026-09-27 13:30:51 JST。これは稼働中経路と既存案件の整合根拠であり、次回配信用の設定値を直接取得した証明ではない。顧客本文・メール・Auth一覧・秘密値は取得していない。


ブラウザ起動時の安全確認では、Next 15.5.25 の `NextURL` が loopback IP を `localhost` に正規化するため、初期指定の `127.0.0.1` と origin が一致せず停止する問題を検出した。テスト URL を `http://localhost:3000` に統一し、Node の localhost 解決は IPv4 優先、Chromium は localhost を127.0.0.1へ固定。kernel の接続許可先は127.0.0.1:3000のままとし、別originへのredirectを許可する修正はしない。正式データや認可処理の修正ではなく、隔離環境内の住所の整合修正である。

## 追加確認の結果（2026-09-27、Phase 0B 取り込み前）

この節は上記の「予定」「未確認」の最新状態を補足する。本番反映承認は継続しているが、**本番取り込みは保留**。今回も製品コード、本番設定、既存行、Storage policy を変更していない。

### 管理ブラウザ gate

head `3d7dc175730d08ecd70781a51f0030defef8c7b5`、実 checkout `7b870694ef28b8b1e6cc749027c337577835623d` の [Phase 0B run 36299289313](https://github.com/me-ish/me-ish-homepage/actions/runs/36299289313) で、実 Auth/DB 19件、実ブラウザ13件、Storage35+35件、通信隔離17件をブラウザ導入前後で各1回、すべて成功・0失敗・0skip。共有管理URLからの実Cookie発行、本人/スタッフ、同居ログイン、再ログイン、503画面表示まで確認済み。iPhone Safariや本番Google OAuthの実機検査とは区別する。Nextの読み上げ用alertはmain外にあるため、業務エラーの不存在確認は案件画面のmain内を対象にした。

### 1. 同時画像保存の追加診断

先行 [run 36297633204](https://github.com/me-ish/me-ish-homepage/actions/runs/36297633204) の `before/concurrent-finish FINISH_HTTP_503` は原因未確定。対象はme-ishギャラリー受付であり、ナトリ相談添付ではない。該当製品service/routeは開始mainから無変更で、本番障害・データ消失を確認したものではない。

`scripts/natori-phase-0a/observe-storage.ts` を追加し、実Storage通信をそのまま通しながら、同時確定の各処理について主体番号・処理区分・HTTP status・所要時間・固定エラー分類だけを記録する。URL/ファイル名/本文/認証情報は記録しない。対象originは既存の隔離Kongに固定し、通信制限を維持。HTTPの失敗を成功へ書き換えず、認可や製品コードも差し替えない。2処理の完了を両方待ってから判定する。

追加検査は、通常の同時開始24組と、保存リクエストを同時に送る12組。各組は新しい架空画像予約を使い、1組2回の確定を実行する。回数を先に固定し、失敗が出ればその系列を停止して失敗として残す。「成功するまで再試行」ではない。同時送信を揃える待機は5秒上限、既存integrationの240秒・workflowの25分上限も維持する。

head `fe89d584b2bd327c73035dc42cb5079cc3ad636a`、実 checkout `d3cffe5bb038c4738e8645707a27e8d5023d600f` の [run 36300268877](https://github.com/me-ish/me-ish-homepage/actions/runs/36300268877) で実行した。

| 隔離環境内のpolicy状態 | 通常の同時開始 | 保存リクエストを同時送信 | integration全体 |
|---|---:|---:|---:|
| 制限前の再現 | 24組成功 | 12組成功 | 26成功 / 0失敗 / 0skip |
| Phase 0A制限後の再現 | 24組成功 | 12組成功 | 26成功 / 0失敗 / 0skip |

追加分は計72組・144回の確定でHTTP200。保存先の実ファイルが元画像と一致し、一時ファイルが片付くことも確認した。既存の同時確定試験、隔離17件、Storage35+35件、cutover承認/drift guardも成功した。前後とは隔離policyの前後であり、製品の不具合修正前後ではない。

この先行runでは再現しなかったが、成功だけで解消扱いにはしなかった。結果文書を追加した次のrunで、同じ試験コードが下記のエラーを採取した。検査の期待値を緩めたり、失敗を消したりしていない。

#### 最終検査での再現と原因の切り分け

head `61bf4952f0832f0c72240c434f91ca40c07dd3e6`、実 checkout `3c0833fbc009d2b18ad235011f99092a07fa07ce`、[run 36300566184](https://github.com/me-ish/me-ish-homepage/actions/runs/36300566184)。直前headとの差分は結果文書だけ。試験・製品コードは同一。

- 制限前: 26成功 / 0失敗 / 0skip。追加36組は成功。
- 制限後: **24成功 / 2失敗 / 0skip**。自然開始の2組目、保存リクエスト同期の10組目で `FINISH_HTTP_503`。それぞれ失敗時点でその系列を停止した。
- 隔離17、Storage35+35、cutover承認/drift guardは成功。認可拒否を正常系の失敗として誤認した結果ではない。

取得できた実通信は次の順序だった。同じ架空予約・同じ画像bytes・`upsert:false` の2処理に対するもの。

| 段階 | 自然開始で再現した組 | 同期開始で再現した組 |
|---|---|---|
| 2処理の最初の公開ファイル確認 | どちらもNoSuchKey | どちらもNoSuchKey |
| 一時ファイルの情報/bytes取得 | どちらも200 | どちらも200 |
| 先に応答したStorage upload | 開始52ms、7ms後に200 | 開始50ms、6ms後に200 |
| 直後の公開ファイル情報 | 200 | 200 |
| 直後の公開ファイルbytes取得 | 開始62ms、500 InternalError | 開始60ms、500 InternalError |
| もう一方のStorage upload | 開始51ms、219ms後に200 | 開始50ms、287ms後に200 |
| もう一方の最終bytes取得 | 200、署名対象bytesに一致 | 200、署名対象bytesに一致 |

**確定APIが503になる直接の経路は、重なったStorage書込中に、metadataは読めるが実体downloadが500になることだった。** `finishEntryUpload` はupload後に `readPublished` で一度だけ実体を読み、ここでstorage-errorとなれば即503を返す。後から完了した処理では実体が取得でき、元画像との一致も確認できた。

これは隔離Storageで再現した事実であり、Storage内部でなぜ2つのuploadが200になるか、元の先行runも完全に同じ内部原因だったか、本番で同じ事象が起きたかまでは証明しない。既存ファイルや入金・相談のデータ破壊は観測していない。

次の修正候補は、対象の署名済みファイルを検証する最終読取に、短い上限付き待機・再確認を設けること。サイズ/MIME/hashの一致を成功条件として維持し、認可・署名不正・不一致をretryで隠さず、上限後の実障害は503のままにする。書込の無制限再試行、`upsert:true`、権限緩和、プロセス内だけのmutexを複数サーバー間の排他と見なす対応は採らない。修正時は今回の実同時実行に加え、一時的download失敗からの回復・永続失敗・bytes不一致の否定試験が必要。**今回は確認作業なので、この製品修正は実施していない。**

### 2. 本番設定と案件の照合

接続済みVercelから `me-ish.art` の実配信を確認。本番は引き続き `dpl_E6teYHzNwBqv2PsqBxyMHgXMkkRZ`、main `942a55d7e1359be11243e676a41d12425ae55a5d`、READY。PR #97はDraft・未merge。本番設定や本番データへの書込なし。

Supabaseは既知の専用テスト案件の作成時刻を参照点に、件数・一致判定だけを読み取った。参照案件1件、Auth owner存在=true、案件総数18件、同一owner18件、別owner0件。paid_atのある同一owner行は15件だが、これはStripe入金の照合ではない。実ユーザーの本文・メール・Auth一覧・実ファイルは取得していない。

今回の厳密な集計では、現行配信ready後に作成され `request_data` に `schemaVersion` を持つ行は1件で、同じownerに一致する。以前の「配信後の構造化受付2件」というPR表記は、この条件を満たす確認済み件数として使わず、今回の1件に訂正する。業務行の内容や変更履歴は追加取得しておらず、件数差の理由は断定しない。

現行本番の公開受付は `NATORI_OWNER_USER_ID` を必須とし、session/DB探索fallbackがない。Phase 0Bでも同じ設定名・正規化・UUID検証を使うため、稼働中の保存先と既存案件が整合する根拠はある。一方、現在接続されているVercelツールには環境変数の一覧/対象環境/値を照合する操作がなく、project/deployment取得結果にも当該設定は含まれない。Workに認証済みVercel CLIもない。別の資格情報の探索や.env読取で補わない。

当初は次回配信に適用されるProduction設定の直接照合が未完だったが、**2026-09-27の利用者によるブラウザ確認許可とログイン協力の後、直接照合を完了した**。Vercelの対象プロジェクト `me-ish-homepage-vsiv` の [Environment Variables](https://vercel.com/me-ishs-projects/me-ish-homepage-vsiv/settings/environment-variables) で `NATORI_OWNER_USER_ID` を検索し、対象が **Production** の設定を確認した。Previewの別ブランチ用設定は対象外。設定変更・保存・再配信は行っていない。

Productionの非秘密識別子は公開せず、比較用ダイジェストによるSupabaseの読み取り照合で、参照案件のownerとの一致=true、Auth存在=true、案件18件すべて一致、別owner/NULL=0件、paid_atのある一致行15件、現行配信ready後の構造化受付1件も一致を確認した。ダイジェストはこの同一性確認だけに使い、認証やセキュリティ判定には使わない。途中、作業中の照合用メモとの不一致があったため、そのメモを根拠にせず実DBとの直接比較で確定した。本番設定の不一致ではなかった。識別子自体もダイジェストも文書・PRには残さず、値は確認後に再び非表示にした。無関係なSecrets、顧客本文・メール・Auth一覧・実ファイルは取得していない。

これは確認時点で次回Production配信に使用される設定が正しいことの証拠であり、Phase 0Bを配信した証拠ではない。配信までに設定が変更された場合は同じ照合をやり直す。今回の手段で秘密値をチャットへ貼る操作、資格情報の探索、`.env`読取は行っていない。

### 本番取り込みの判断

Production owner設定の照合は完了。同時保存503は再現と直接経路の特定まで完了したが、製品修正は未実施のため、現在はDraft・未mergeのまま。本番反映の承認は既に得ており再承認待ちではないが、異常時に停止する条件は維持する。案件/予定/料金設定の移動や削除、token再発行、本番への検査データ追加は不要。最新の試験状態はPR本文へ記録し、文書へ自己SHAを埋め込むための再commitは行わない。

直前の文書更新head `6015813aea8de3f582b07d603b5f89f3612121d8` は [Phase 0A 36300829563](https://github.com/me-ish/me-ish-homepage/actions/runs/36300829563)、[Phase 0B 36300829436](https://github.com/me-ish/me-ish-homepage/actions/runs/36300829436)、[CI 36300829416](https://github.com/me-ish/me-ish-homepage/actions/runs/36300829416)、[Phase T 36300829467](https://github.com/me-ish/me-ish-homepage/actions/runs/36300829467) がすべて成功した。ただし製品コードは変わっておらず、先行runで再現した同時保存503を解消済みとは扱わない。
