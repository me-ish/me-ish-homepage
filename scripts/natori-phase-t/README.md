# Natori Phase T — ephemeral Storage authorization comparison

このフォルダは**テスト専用**。F01/NEW-01の本番修正、Phase 0Aの承認、製品の認可APIの実装ではない。
一次資料: `Natori_Improvement_Plan_2026-09-26.md` のPhase T/0A、F01、NEW-01、§7/§8。

## 実行場所を変えた理由

ChatGPTクラウドWorkから再実行できるよう、PCの `C:\me-ish-next` / Dockerへの依存をなくした。
GitHub-hosted `ubuntu-24.04` に一回限りのSupabase DB/Auth/Storageを作り、ジョブ終了時に破棄する。
既存クラウドSupabase・Vercel Previewを試験環境にしない。Stripe、メール送信、業務フロー、UI、既存E2Eのskipは対象外。

## 再実行

1. `codex/natori-phase-t` のDraft PRを開く。`pull_request` のopened/synchronize/reopenedで実行する。
2. Actionsの **Natori Phase T → Isolated Storage authorization** を確認する。
3. 同じSHAならGitHubの **Re-run jobs** を1回まで使用する。結果は新しいrun attemptとして区別する。
4. 修正時は通常commit/pushで再実行する。mainへのmergeは不要。`workflow_dispatch`や`pull_request_target`は使用しない。
5. artifactの`versions.txt`にPR headと実際のcheckout SHA（PR merge ref）を記録する。`isolation.json`, `current.json`, `candidate.json`のfailed=0、skipped=0と2つのcatalog照合成功が必須。

Storage/認証の起動失敗はジョブ失敗。skip/continue-on-error/成功への置換はない。
既存CIもPRで別途実行されるが、その成功をPhase T成功として代用しない。

## ツールと上限

- Supabase CLI **2.118.0**、Linux amd64 tarのSHA-256を`run.sh`に固定。公式releaseを照合（2026-09-27）。
- Nodeは既存`.node-version`の**22**をsetup-nodeで解決。同じ完全バージョンの`node:<version>-bookworm-slim`を試験containerにも使用。独自のNode指定を増やさない。
- checkout/setup-node/upload-artifactはworkflow内のcommit SHAで固定。
- Supabase各イメージのタグはCLI版が指定。実取得RepoDigest、Postgres、Node、Docker、Python、iptables、runner image版を`versions.txt`に記録。hosted runnerのDocker/OS patch版はGitHub管理で、固定されたVM imageではない。
- 1 PRにつき同時1ジョブ。22分上限、起動9分、Storage各3分、通信10秒、CLIダウンロードretry1回。試験自体の自動retryは0。network切替後のAuth readiness待ちのみ最大30回/40秒。不要な全migration、npm ci、製品依存追加は行わない。
- 自動再実行ループはない。手動再実行は同一原因で1回まで、再失敗は原因を修正する。

## 隔離境界

構築中はrunnerがCLI/コンテナimageを取得する。`RUNNER_TEMP`の専用mktempディレクトリへconfigだけをコピーし、repoの`supabase/.temp`、リンク設定、`.env`、migration、seedを読まない。
ローカルDB passwordとAuthのJWT secret/API keysは実行ごとに乱数生成。架空Auth user/passwordも実行時生成する。DB bootstrapも専用コンテナ内で行い、本番資格情報を使わない。

CLI bootstrapだけはループバックbindの専用構築networkを使用する。初期化後、全containerを`--internal`の専用試験networkに接続し、構築networkから切断する。aliasを維持し、DBを使うserviceは再起動して旧接続を破棄する。全containerが試験networkのみを持ち、構築networkが空であることを検査する。外部から公開portへの転送はDOCKER-USERの専用chainでも拒否する。公開URL・トンネルなし。試験前にNode containerのnetwork namespaceのOUTPUTをdenyにし、**同じnetwork内Kong IPのTCP8000だけ**許可する。DNS、IPv6、host gateway、他portも許可しない。
テストcontainerは非root、capabilities全剥奪、no-new-privileges、readonly root、Docker socketなし。子プロセスも同じnamespaceを継承する。NodeのURL guardだけに隔離を依存しない。

`isolation.mjs`は、prod風Supabase/Stripe/mail/DB URLをtransport呼出前に拒否する試験と、実socket/UDP/子プロセスの通信拒否、許可APIへの接続成功を実施する。外部IPの否定試験は文書用予約IPを使い、本番をprobeしない。redirectも禁止。
テスト中のSQLは専用名・label検証済みDBに`docker exec`のローカルsocketで渡す。SQLfixtureは追加の`phase_t.sandbox=ephemeral` guard必須。

資格情報はruntimeの限定JSONだけ。CLI status/start/stopのraw log、config、Auth user、JWT、署名URLはログ/artifact/Gitへ出さない。artifactは件数・固定試験名・非機密catalog・バージョン・namespaceルールのみ。
EXIT trapは当該project IDのstack、当該test container/network/firewall chainだけを後始末する。`--all`/グローバルpruneなし（CLI stop内部のpruneもproject label限定）。ジョブ強制終了時もGitHub-hosted VMの破棄が最終境界となる。共有runnerへの流用は禁止。

## 定義の照合（2026-09-27、開始main `21d4e34587d062cebe361acfb6557ad15daa69e3`）

本番へは別のSupabase読み取り接続から、`pg_policies`, `pg_class`, `has_*_privilege`, 対象`storage.buckets`の設定列だけをSELECTした。業務行、storage.objectsの行、Auth user、実ファイル、Secretsは取得していない。その読み取り接続/credential/project refはCIへ渡さない。

`fixtures/catalog.json`は16個のobjects policy、anon/authenticated/service_roleのschema USAGEとCRUD GRANT、RLS有効、7 bucket設定を記録する。`build-fixture.mjs`はそれから隔離SQLを生成。適用後に`catalog.sql`で実カタログを取り直し、`verify-catalog.mjs`で厳密比較する。

- artworks/avatars/banners: public=true、bucket固有サイズ/MIME制限なし。
- natori-inquiry-refs: private、10MiB、JPEG/PNG/WebP/GIF。
- natori-consultations: private、50MiB、catalog記載画像/PDF/audio。
- natori-deliveries/processing-meta: private、bucket固有制限なし。
- F01: `Allow Insert 1exduyn_0` PUBLIC INSERT WITH CHECK true。
- NEW-01: artworks PUBLIC SELECT/INSERT/UPDATE/DELETE。UPDATE/DELETEは所有者条件なし。
- avatar/bannerの重複owner policyも現行のまま再現し、今回整理しない。

再現範囲はStorage認可に必要な定義だけ。その他bucket、業務table/RPC、API serviceの認可、全本番DDL、ファイル容量上限までの一致は主張しない。CLIはPG17を使用するが本番17.6とローカルpatch版差はversionsに残す。

`fixtures/candidate.sql`は広い4 policyだけ除去し、公開SELECT、owner path制約、GRANTを保持する。privateナトリとartworksはservice/署名による書込とする。restricted policyを足すだけでPUBLICのOR許可が消えたと誤判定しない。

## 正規経路と0Aへの注意点

| 現在コード | Storage primitiveを実試験する範囲 | このPhaseで証明しないこと |
|---|---|---|
| `src/features/natori/server/portfolioSiteService.ts` | private資料へのservice upload/read/delete | 応募フォーム、画像変換、管理認可 |
| `server/deliveryService.ts`, `data/supabaseDeliveryFiles.ts` | createSignedUploadUrl→uploadToSignedUrl相当、実体readback、署名読取 | 納品台帳/ready/受取、署名前の管理認可 |
| `server/consultationFilesService.ts`, `components/consultation/ConsultationThread.tsx` | signed uploadとTUS POST/PATCH、小ファイルreadback | token認可、finish/メッセージ、分割再開/大容量/UI |
| avatar/banner owner path | Authで発行したuser JWTで自身CRUD、他人の更新/削除拒否 | プロフィールUI |
| `src/app/admin/api/entries/[id]/approve/route.ts` | artworks copy、processing-meta upload | 承認API/Stripe/メール |
| `scripts/colab_stegano_batch.py` | service artworks CRUD、公開読取 | Colab runtime/実際のSecret設定 |
| `scripts/colab_wm_batch.py` | 読取primitive | `SUPABASE_KEY`の実際のrole（未読） |
| `src/app/[locale]/entry/FormWrapper.tsx:273` | 現行anon upload成功→候補で拒否 | **既存作品応募は候補をそのまま本番適用すると停止する** |

0Aでは作品応募の署名/認可adapterの設計とブラウザ回帰を先に行う必要がある。匿名応募者を単にauthenticated owner扱いにしない。サービスでの作品操作が通ることを、この匿名writer互換性の代替にしない。
候補は比較実験であり、本番SQLではない。既存file path、token、URL、quote、payment、案件statusの変更はゼロ。

## 判定

HTTP成功だけで判定しない。upload/update後はservice readでbytes一致、delete後は不存在を確認。拒否後も元bytesを確認する。
policy切替前の架空既存objectと署名読取URLも、切替後に同じbytesで取得できるか確認する。署名URLはcontainer内tmpfsだけに置き、出力しない。
DELETEはRLSにより200+空配列になる場合があり、事前SELECT/実体存在、空結果、事後bytes不変を合わせて拒否とする。invalid JWTとbucket不存在は別controlであり、RLS成功に加算しない。
setup失敗はfailで止める。必須実Storage成功までは結果報告を「未完了」とする。

公式確認先: [CLI 2.118.0](https://github.com/supabase/cli/releases/tag/v2.118.0)、[CLI local setup](https://supabase.com/docs/guides/local-development/cli/getting-started)、[Storage access control](https://supabase.com/docs/guides/storage/security/access-control)、[Docker bridge](https://docs.docker.com/engine/network/drivers/bridge/)、[Supabase changelog](https://supabase.com/changelog)。
