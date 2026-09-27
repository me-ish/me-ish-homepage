# Natori Phase T 実装・試験結果

**初回Phase Tの必須実Storage試験は完了。Draft PRで停止し、本番適用はしていない。**

2026-09-27 UTC。GitHub-hosted Linux上に一時Supabase DB/Auth/Storageを作り、架空データによる現行設定と限定policy候補の比較を実行した。通信隔離17件、現行35件、候補35件の**計87件成功、失敗0、skip 0**。2つのカタログ照合と専用リソースの後始末も成功した。

これはPhase 0Aの本番修正案の承認ではない。作品応募の匿名writerと相談TUSの経路互換性を解決するまで、候補SQLを本番へ適用してはいけない。

## 開始点・GitHub成果物

| 項目 | 確認結果 |
|---|---|
| Repository | `me-ish/me-ish-homepage` |
| 開始main | `21d4e34587d062cebe361acfb6557ad15daa69e3`（指定SHAと一致、PR #94反映済み） |
| 計画の基準からの関連差分 | `991f5ae…`以降はPR #94のNode 22指定統一。最新mainを採用し、巻き戻しなし |
| 作業branch | `codex/natori-phase-t`。開始時に同名branch/PRなし |
| Draft PR | [#95](https://github.com/me-ish/me-ish-homepage/pull/95)、base=`main` |
| 初回全件成功の実装head | `b8a02bc165750190b644ed2730e583f2ab3e63b0` |
| 実際にcheckoutして試験したSHA | `e9c5263015e2cfbfafbb69c9f6f8bf10045fb56f`（PR merge ref。mainへmergeしたという意味ではない） |
| Phase T run | [36283081844 / attempt 1](https://github.com/me-ish/me-ish-homepage/actions/runs/36283081844)、成功 |
| 既存CI run | [36283081884](https://github.com/me-ish/me-ish-homepage/actions/runs/36283081884)、5 jobすべて成功 |
| 非機密artifact | `natori-phase-t-36283081844-1`、artifact ID `10919566988`、7日保管 |

この結果書を記録するcommitは上記実装headの後続となる。**結果書更新後の最終head、再検証run、実試験SHAはPR本文にも記録する**。SHAはartifactの`versions.txt`でheadとcheckoutを分けて照合できる。報告対象の成功runを自己参照するためだけにcommitを繰り返さない。

## 実行場所を変えた理由

一次資料は`Natori_Improvement_Plan_2026-09-26.md`のPhase T / 0A、F01、NEW-01、テスト戦略、本番保護条件。
今回の指示に合わせ、PCの`C:\me-ish-next`やローカルDockerへの依存をなくし、ChatGPTクラウドWorkからGitHub Actionsを起動する構成にした。専用の一時環境はPR段階で実行・破棄できる。既存Vercel Previewや新しいクラウドSupabaseを試験先にしない。

## 接続権限・自動処理

| 操作 | 実績 |
|---|---|
| Repository / main / 作業規約の読み取り | 成功。root `AGENTS.md` / `CLAUDE.md`を確認 |
| 作業branch・ファイル・workflowの作成更新 | 成功。認証済みGitHub接続でtree/commit作成、親commitを指定して非強制ref更新 |
| Draft PR作成 | 成功。#95はDraftのまま |
| Actions run/job/log/artifact取得 | 成功。実試験結果と取得artifactを照合 |
| shellのgit push | shellに認証がないため未使用。GitHub接続によるfast-forward更新を使用し、権限回避・force更新なし |
| Vercel自動処理 | このbranchの自動Preview（target=null）を確認。試験には使用していない |

既存CIは変更していない。`pull_request`でtypecheck/lint/audit/test/E2Eが動き、結果は後述。
確認した最新Productionは`dpl_6DjayH2fTxDyeyeWjNJQBxc31Usb`、mainの開始SHA、READY。作業中のmain再取得でも同じSHA。
Vercel `get_project`接続は引数不整合で設定を取得できず、Production branch設定値そのものは未確認。deployment履歴ではmain→Production、作業branch→Previewを確認した。Production対象branch、alias、設定、手動deployは変更していない。

## 変更ファイル（13件、全件テスト・文書のみ）

| ファイル | 役割 |
|---|---|
| `.github/workflows/natori-phase-t.yml` | PRトリガー、最小権限、時間/同時実行制限、証跡artifact |
| `scripts/natori-phase-t/run.sh` | 取得→専用stack起動→通信封鎖→比較→後始末 |
| `scripts/natori-phase-t/supabase/config.toml` | DB/Auth/Storageの最小構成。既存migration/seed無効 |
| `scripts/natori-phase-t/fixtures/catalog.json` | 読み取り確認済みStorageカタログの非機密fixture |
| `scripts/natori-phase-t/build-fixture.mjs` | fixtureから隔離DB専用SQLを生成 |
| `scripts/natori-phase-t/fixtures/candidate.sql` | 広い4 write policyを除去するテスト候補 |
| `scripts/natori-phase-t/catalog.sql` | 適用後カタログの読み取り |
| `scripts/natori-phase-t/verify-catalog.mjs` | policy/GRANT/RLS/bucketの厳密照合 |
| `scripts/natori-phase-t/guard.mjs` | 接続先の通信前検査、redirect禁止 |
| `scripts/natori-phase-t/isolation.mjs` | URL guard / OS通信制御 / 子プロセスの17件 |
| `scripts/natori-phase-t/storage.mjs` | 実Auth・実Storage比較、各35件 |
| `scripts/natori-phase-t/README.md` | 再実行・隔離境界・正規経路・制約 |
| `docs/natori/Natori_Phase_T_Result.md` | 本結果書 |

製品コード、UI、既存workflow、製品package/lockfile、本番用`supabase/migrations`は変更なし。SQLの投入先は当該ジョブの隔離DBだけ。本番DDL/データ/Storage policy変更、メール送信、Stripe操作、Webhook送信はしていない。

## 隔離・本番保護の実装と検証

- CLI/コンテナ取得を行う構築段階と、試験段階を分離。構築時のDB公開portはloopback bind。試験前に全サービスを専用`--internal` networkへ移し、構築networkから切断したことを検査する。
- 非rootの試験containerはcapabilities全剥奪、no-new-privileges、read-only root、Docker socketなし。network namespaceのIPv4 OUTPUTは専用Kong IP:8000だけ許可し、他は拒否。IPv6 OUTPUTもDROP。子プロセスも同じ制限を継承する。
- 設定guardはprod風Supabase/Stripe/mail/DB URLなどをtransport呼出0回で拒否。kernel試験では予約外部IP、host gateway、別port、稼働loopback listener、Docker DNS、IPv6、子プロセスを確認した。認可拒否のStorage試験とネットワーク否定試験は別判定。
- 証跡のIPv4 OUTPUTは許可先`172.30.250.5:8000`への510 packetを許可、その他8 packetを拒否。IPv6 OUTPUT DROPも記録。APIが実際に到達可能であることを正試験で確認した。
- 実行時の専用configと資格情報は`RUNNER_TEMP`の限定ファイル。新規Auth userは`example.invalid`の架空利用者。実顧客・実作品・実token・本番Secrets・repoの`.env`・`supabase/.temp`・リンク設定を使わない。
- fixture投入は専用名とlabelを確認したDB container内のUnix socketだけ。Storage table ownerの管理権限はfixture作成に限定し、HTTP認可試験はanon/user/serviceの各JWTで行う。
- 署名URLはcontainerのtmpfsだけに保持。ログは固定試験名・件数・安全なエラーコードのみ。raw CLI log/config/資格情報はartifact対象外。取得したartifactにJWT、secret key、署名tokenの文字列がないことも検査した。
- cleanupは専用project ID・container・2つのnetwork・専用firewall chainのみ。成功runのcleanup exit=0。新規有料資源、外部公開URL、トンネル、共有runnerなし。

上限はPRごと同時1ジョブ、22分、stack起動9分、Storage各3分、通信10秒、CLI download retry1回。試験の自動retryなし。Auth readinessだけ最大30回/40秒。手動rerunは同一原因1回までとし、再失敗時は原因を修正する。

## 現行定義の照合

2026-09-27、CIとは別の読み取り接続から本番catalogの必要最小限を取得した。`pg_policies`、RLS有効フラグ、roleのUSAGE/CRUD GRANT、対象`storage.buckets`の設定列だけ。業務行、`storage.objects`の行、Auth user、実ファイルは取得していない。読み取り用接続・project refをCIへ渡していない。

- **7 bucket、16 objects policy、anon/authenticated/service_roleのGRANT、RLS有効**を再現。現行・候補とも隔離DBの実カタログとの厳密比較に成功した。
- F01：`Allow Insert 1exduyn_0`はPUBLIC INSERT / WITH CHECK true。対象bucketの存在・MIME/サイズ条件を満たす新規objectへ匿名書込が可能。
- NEW-01：artworksのPUBLIC UPDATE/DELETEに所有者条件なし。PUBLIC SELECT/INSERTも存在する。
- artworks/avatars/bannersはpublic。ナトリ3 bucketとprocessing-metaはprivate。privateというbucket属性だけでは他のpolicyを無効化しない。processing-metaの既存SELECT policyもfixtureに残す。
- 候補は広いwrite policy 4個だけ除去し、12個の残存policy、公開SELECT、avatar/banner owner条件、GRANT、bucket設定を保持する。許可policyのOR関係を考慮し、制限policyの追加だけで直ったとは判定しない。

その他bucket・業務table/RPC・全migration履歴・本番gateway/Storage配備版まで同一であるとは主張しない。詳細なbucket MIME/サイズ、policy式はfixtureとREADME参照。

## 実試験結果

| 検証群 | 実行 | 成功 | 失敗 | skip |
|---|---:|---:|---:|---:|
| 通信隔離・誤接続防止 | 17 | 17 | 0 | 0 |
| 現行設定の実Storage | 35 | 35 | 0 | 0 |
| 限定候補の実Storage | 35 | 35 | 0 | 0 |
| **合計** | **87** | **87** | **0** | **0** |

別ゲート：カタログ照合2件成功、DB/Auth/Storage起動成功、cleanup成功。既存CI：unit **123 files / 1,144 tests成功**、E2E **13成功 / 4既存skip**、typecheck/lint/audit成功。既存E2Eのskip 4件は今回変更せず、Phase Tのskip 0件と区別する。Work内でも5 Node module / bash構文確認を行ったが、完了判断はActions上の実Storage結果による。

| シナリオ | 現行設定 | 限定候補 | 実体の確認 |
|---|---|---|---|
| 匿名の任意新規書込（7 bucket） | 成功してしまう | RLS拒否 | 成功時bytes一致、拒否時不存在 |
| 無権限authenticatedのナトリprivate新規書込（3 bucket） | 成功してしまう | RLS拒否 | 同上 |
| 第三者のartworks PUT/DELETE（anon・別user） | 更新/削除される | 拒否/対象0件 | 事前読取、成功時変更/不存在、拒否時元bytes維持 |
| serviceの必要CRUD・artworks copy・processing-meta書込 | 成功 | 成功 | readback / delete後不存在 |
| avatar/bannerのowner操作・他user操作 | 自分のCRUD成功、他人の変更拒否 | 同じ | bytes不変・削除結果照合 |
| 公開画像とprivate資料の読取 | 公開画像成功、privateの無権限読取拒否 | 同じ | 同一既存objectのservice読取も成功 |
| 署名upload/download（ナトリ3 bucket） | 成功 | 成功 | bytes一致、署名path改変拒否 |
| 正規署名TUS `/resumable/sign` | 成功 | 成功 | 署名のみのPOST/PATCH・bytes一致、無効署名拒否 |
| 非sign TUS + anon JWT + x-signature | 広いINSERTにより成功 | RLS拒否 | 成功時bytes一致、拒否時不存在 |
| 切替前の架空ファイル・署名読取URL | 取得成功 | 同じファイル/URLで取得成功 | bytes不変、再発行なし |
| 無効JWT / bucket不存在 control | 各々の原因を検出 | 同じ | これらをRLS拒否の成功として代用しない |

Storage DELETEはRLSで対象行が絞られるとHTTP 200 + 空配列になる。その場合も事前の実体存在/actor読取、空結果、事後bytes不変を併用し、HTTPだけで成功扱いにしない。起動失敗・認証不足・network障害は必須試験のskipへ変換しない。

## 使用バージョン

| 要素 | 成功runの版 / 固定方法 |
|---|---|
| Supabase CLI | **2.118.0**、tar SHA256 `f6089a86fb9d9221c958193a277338daddd6822f706929943812fa32e106c86d` |
| Node | 既存`.node-version`の22を使用、実行版 **22.23.2**。同じ完全版の試験container |
| Runner | `ubuntu-24.04`、image `20260920.314.1` |
| Docker | client/server **28.0.4** |
| PostgreSQL | **17.6**、image `17.6.1.171` |
| Auth / Storage / REST / Kong | gotrue **v2.197.0** / storage-api **v1.77.0** / postgrest **v16.3** / kong **2.8.1** |
| Host補助tool | Python **3.12.3**、iptables **1.8.10** nft |
| Actions | checkout/setup-node/upload-artifactをworkflow内のcommit SHA固定 |

CLIがservice imageのタグを指定する。実取得digestは以下。hosted runnerのDocker/OS patchはGitHub管理であり、VM image全体の永久固定ではない。毎runの`versions.txt`で差を把握する。製品依存追加/更新なし。

| Image | 実取得SHA256 digest |
|---|---|
| storage-api | `3999cfa4f3286f945fa68069fc9b8b6bf3929a6bd53916dcf2e8c209801173c0` |
| postgrest | `ec0e25a4e24b0a3bc5e4f011369bfc736bd1b19f513bd01079b86329a7636962` |
| gotrue | `1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b` |
| kong | `1b53405d8680a09d6f44494b7990bf7da2ea43f84a258c59717d4539abf09f6d` |
| postgres | `658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9` |
| node | `48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9` |

## 失敗を修正した経緯

初回から成功していたわけではない。以下は各commitの実行であり、無制限自動retryではない。既存CIの条件や必須Storage試験を弱めていない。

| Run | 失敗と対応 |
|---|---|
| [36281804491](https://github.com/me-ish/me-ish-homepage/actions/runs/36281804491)、[36282005401](https://github.com/me-ish/me-ish-homepage/actions/runs/36282005401)、[36282115337](https://github.com/me-ish/me-ish-homepage/actions/runs/36282115337) | bootstrap失敗。秘密を出さない診断を追加し、internal network上でのhost DB接続失敗を特定。loopback bindの構築networkと通信封鎖後の試験networkを分離 |
| [36282328544](https://github.com/me-ish/me-ish-homepage/actions/runs/36282328544) | fixture作成時のStorage table所有権不足。専用DB内Unix socketの管理roleに限定して修正 |
| [36282457933](https://github.com/me-ish/me-ish-homepage/actions/runs/36282457933) | `auth.uid()`のdeparseがsearch_path依存。明示search_pathを使用し、比較条件は緩めず修正 |
| [36282565908](https://github.com/me-ish/me-ish-homepage/actions/runs/36282565908) | email/password provider無効で架空userログイン422。公開signup禁止を保ち、admin作成済userのpasswordログインを有効化 |
| [36282674179](https://github.com/me-ish/me-ish-homepage/actions/runs/36282674179) | 現行34成功、候補33成功/1失敗。非sign TUS経路の403を検出。固定Storage版の署名routeを照合し、正規署名経路の正試験を追加。元経路はpolicy依存を示す比較試験として保持 |
| [36283081844](https://github.com/me-ish/me-ish-homepage/actions/runs/36283081844) | 全87件・2 catalog・cleanup成功 |

## 正規経路の確認範囲とPhase 0Aへ渡す残課題

Storage primitiveとして、管理serviceのCRUD/copy、private資料の署名upload/read、署名TUS、owner avatar/banner CRUD、公開画像読取を確認済み。現行の製品API・UI全体を動かしたE2Eではない。詳細は[READMEの正規経路表](../../scripts/natori-phase-t/README.md#正規経路と0aへの注意点)。

1. **作品応募の匿名直upload互換性が未解決。** `src/app/[locale]/entry/FormWrapper.tsx:273`のartworks upload(upsert)は現行の広いpolicyに依存する。先に認可/署名adapterと既存応募UIの回帰を設計・実装する必要がある。候補の本番適用は不可。
2. **相談TUSの本番相当gateway経路を確定する。** 現行`ConsultationThread.tsx`は`/storage/v1/upload/resumable`へx-signatureのみを送る。隔離Storage v1.77.0は`/resumable/sign`を署名routeとして登録する。本番gatewayによるrewrite・本番Storage版は未確認。正規署名primitiveの成功を現行UI互換性の保証に置き換えない。署名だけで通る経路を隔離環境で合わせ、ブラウザ・小/大ファイル・中断再開を0Aで確認する。
3. **署名発行前の業務認可は未試験。** 管理API権限、相談token、納品台帳/ready/受取、応募→案件作成などは別Phaseの対象。今回は全業務フローやStripe/実メールを追加していない。
4. **Colabの実credential roleは未確認。** `colab_stegano_batch.py`のservice相当primitiveは成功。`colab_wm_batch.py`の`SUPABASE_KEY`がどのroleかはSecretsを読まず未確認とする。0A前に正規バッチの権限契約を確認する。
5. **本番反映時の再照合が必要。** 今回のcatalog snapshot以降のpolicy/GRANT/bucket差分を、実データ不要の読み取りで再確認する。owner path・既存ファイル・URL・tokenを保持し、互換コード→検証→限定policy適用の順序を別途承認する。

候補SQLは比較実験であり、本番migrationへコピーする承認ではない。本番の既存案件、quote、accepted_at、paid_at、transaction、delivery、consultation、Storage object、通知履歴、token/URL/statusは変更していない。

## 再実行と停止点

1. Draft PR #95の **Actions → Natori Phase T** を開く。関連ファイルの通常commit/pushで`pull_request`が起動するため、初回実行のためのmain mergeは不要。
2. 同じSHAの再検証は **Re-run jobs** を1回まで使用する。再失敗なら原因を修正し、失敗をskipしない。
3. `versions.txt`のhead/checkout SHA、`isolation.json` / `current.json` / `candidate.json`の17/35/35成功・failed=0・skipped=0、catalog照合2件、cleanup exit=0を確認する。認証情報を入力・共有する必要はない。
4. 同じheadの既存CIも確認する。既存E2E skip4件をPhase Tの成功件数へ混ぜない。

実行手順と詳細な保護条件は[`scripts/natori-phase-t/README.md`](../../scripts/natori-phase-t/README.md)。このWorkの停止点は**Draft PRと実試験報告**。mainへのmerge、auto-merge、本番昇格、Phase 0Aの適用は行わない。
