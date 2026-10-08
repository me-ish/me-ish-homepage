# 整理の保全条件と旧サービス停止の入口（2026-10-08）

基準main: `07963f80950365678b96f0817f7477c4a283b774`。段階2Aとセキュリティ更新は反映済み。この資料は次段階の実行条件を具体化するもので、バックアップ取得済み・旧サービス停止済みを意味しない。

## 本番の読み取り確認

2026-10-08に本番 `me-ish's Project` のSELECTとカタログ参照だけで再確認した。本文・連絡先・トークン・資格情報・Vault値は取得していない。

| 項目 | 確認値 |
| --- | ---: |
| publicテーブル | 63 |
| natori専用テーブル | 34 |
| natori案件 | 18 |
| migration履歴 | 34 |
| Storageバケット | 11 |
| Storage登録オブジェクト | 94 |

| バケット | 公開 | 件数 | メタデータ上のbytes |
| --- | --- | ---: | ---: |
| artworks | yes | 12 | 22258191 |
| aura-assets | no | 28 | 2773192 |
| avatars | yes | 0 | 0 |
| banners | yes | 1 | 240588 |
| card-assets | no | 7 | 19174 |
| gallery-entry-intake | no | 0 | 0 |
| natori-consultations | no | 4 | 19452639 |
| natori-deliveries | no | 0 | 0 |
| natori-inquiry-refs | no | 1 | 122714 |
| natori-portfolio | yes | 40 | 5250174 |
| processing-meta | no | 1 | 0 |

件数・bytesは取得時点の集計。ファイル本体の存在・ダウンロード成功・ハッシュを確認した結果ではない。0 bytesも空ファイルと断定しない。

外部処理に関係する拡張を限定して確認したところ、`supabase_vault` は存在し、`pg_cron` / `pg_net` / `http` / `wrappers` は存在しなかった。`cron.job` はなく、foreign tableは0件。public関数本文のnet/http/vault呼出しを表す文字パターンも見つからなかった。これは限定したカタログ調査であり、外部呼出しが一切ないことや、Vault値の利用有無を証明しない。

## バックアップと復元の実行条件

**未実施：DB実データの書き出し、Storage本体の保存、別環境への復元。** 現在の連携にはbackup/export/Storage一括downloadの専用操作がなく、作業環境にもSupabase CLI・pg_dump・psql・Dockerがない。資格情報の取得や、本番パスワードの再設定は行っていない。

最初にSupabase管理画面のDatabase → Backupsで、最新の成功日時・プラン・利用可能な取得/復元方式を確認する。管理画面へ切り替える許可が必要な場合は、その確認を受けてから進む。パスワードやキーをチャットへ貼る必要はない。

| 方法 | 必要なものと注意 |
| --- | --- |
| CLIによる論理バックアップと隔離復元 | 正規に認証された管理環境でroles・schema・dataを保存。migration履歴、独自auth/storageポリシー等も別途保存・復元する。CLI標準のschema dumpだけでは不十分 |
| 管理画面のRestore to a New Project | 有料プランとphysical backupが条件。提示される費用・作成先を確認してから判断する。Storage実体と設定等は別作業 |
| Storageの保存 | 正規のStorage API / CLI / S3対応手段で全11バケットの本体と設定を保存。件数・サイズ・SHA-256のmanifestを作成する |

別projectへのphysical restoreはDB全体と暗号化ルート鍵も複製し、外部処理を行う拡張・ジョブがあると復元直後から動く。復元前に除外・停止する機能はないため、事前に外部処理を調整したい場合は論理復元を使う。論理復元ではVault等の暗号化の扱いを別途確認する。秘密値をこの資料・Git・CI artifactへ転載しない。

`restore_project` は日時や別の復元先を指定するbackup復元操作の代わりに使わない。schema-onlyの開発branchも実データバックアップではない。停止中の別プロジェクトを復元先として無断で再開・上書きしない。

### 復元の合格条件

- 最新取得時点の対象一覧を作成し、全対象テーブル・migration履歴・主キー・参照整合性・業務値を照合する。
- RLS、権限、関数・トリガー、バケットの公開区分と設定を照合する。
- Storage本体をダウンロードし、件数・bytes・SHA-256を照合する。DB取得とStorageコピーの間に更新があれば差分を再確認する。
- 複製環境から本番メール・決済・Webhook・定期処理へ接続させない。
- 複製環境でナトリの公開/非公開アクセス境界と、実際のrootを使った表示を確認する。
- 本番の増分案件を失うため、古いDB全体への巻戻しを通常のコード整理のロールバック手段にしない。

7月の `docs/etorie-p0-01-backup-rollback-checklist.md`（9バケット等）と16テーブル固定の `scripts/etorie-schema-checksum.mjs` を、そのまま現在の復元完了証拠に使わない。既存のPhase T/0Aは隔離した構造と試験データの検証で、本番バックアップの復元証明ではない。

復元を実行する際は、CLIの実バージョンと `--help`、復元先のPostgreSQL・拡張の実バージョンを確認する。公式Changelogでは2026-08-05以降の拡張version指定が無視される変更と、realtimeスキーマの変更制限が案内されている。古いDDLをそのまま再実行して同じ環境になると仮定せず、managed schemaへの独自変更は現行の公式手順で個別に復元する。今回、既存migrationや拡張設定は変更しない。

## 段階1で止める入口

次の対応表は停止PRの設計用であり、このPRでは画面/API/RLSを変更しない。旧機能が書込む入口をmethodと副作用で判定する。

| 系統 | 主な入口 | 停止する新規処理 |
| --- | --- | --- |
| AURA | POST `/api/aura/draft`、`form/submit`、`form/ai-suggest`、GET `form/submit?test_openai=1` | draft作成・更新、OpenAI呼出し、生成結果保存 |
| AURA編集 | POST `save/[id]`、`public-slug`、`request/[id]/email` | 内容・公開状態・slug・連絡先更新、無料枠消費 |
| AURA画像/Studio | POST `upload/{avatar,works}/[id]`、Studioのdraft/save/publish/upload/ai/polish | Storage upload・保存・公開・生成 |
| CARD | POST `draft`、`form/submit`、`save/[id]`、`public-slug`、`upload/{avatar,works}/[id]` | 作成・保存・公開・画像upload |
| AURA/CARD決済 | **GET** `/api/{aura,card}/checkout` | 新規Stripe Checkout |
| ギャラリー画像受付 | POST `/api/entry/upload` のsignとfinish | 署名upload発行とartworksへの確定保存 |
| ギャラリー購入 | POST `/api/purchase/stripe` | Checkout、管理者バイパスのfinalize_sale RPC・sales upsert |
| 展示承認/プラン | POST `/admin/api/entries/[id]/approve` と`plan-checkout` | 新Checkout、承認更新、画像処理job、Storage metadata、合格・支払案内メール |
| その他 | POST `/api/ai-guide`、`/api/internal/send-submit-email`、旧応募server actions | AI案内・応募通知・旧応募用書込み |

旧サービスのCheckout新規発行は、AURA、CARD、purchase、plan-checkout、approveの5入口にある。POST一括拒否ではGET入口が残る。guardは外部課金・DB/Storage書込・メール送信の前に置く。

### Next APIを通らない経路

- `entry/FormWrapper.tsx` はブラウザSupabaseからentriesへINSERTする。
- `renew/page.tsx` にrenewalsへのINSERT経路が残る。対象DBオブジェクトの現状は停止設計で確認する。
- mypageはprofilesをupsertし、初期表示時のseed作成もある。
- ProfileEditModalはavatars/bannersへ直接uploadする。
- 旧portfolio編集はportfolio_settingsのupsertとentriesの更新、銀行設定は口座upsertを行う。

本番entries/profilesはRLS有効で、anon/authenticatedにINSERTのテーブル権限と条件付きINSERTポリシーが存在する。権限の存在だけで任意の書込み成功を断定しない。**アプリ入口の停止と、許可されていた旧書込みのDB/Storage直アクセス停止を別々に検証する。** 本番への試験INSERTは行っていない。RLSや権限の変更はバックアップ・依存確認後の独立した差分にする。

like/view/comments等の書込み、旧管理側のPATCH/reset/sync-display-ready、GET/POSTを持つcronも停止一覧へ追加する。精算・返金処理は未処理決済の確認を先に行う。

## 維持する経路と検査

- 既存公開AURA/CARDと画像表示、必要なpreview/状態照会。GET assetsは署名画像URLの発行で、uploadとは別扱い。
- Stripe WebhookのNatori・AURA・CARD・gallery・entry_plan処理、既存の決済帰着ページ、COA・購入通知。未完了/遅延入金/返金/精算の確認前に取り除かない。
- 共通contact、認証、Natori、Etorieデモ、既存bodyとフォント指定。
- Phase 0Aを分離しても当面すべての旧成功ケースを実行する。停止PRで旧サービス用ケースだけ停止仕様へ変更する。NatoriとPhase Tの検査を減らさない。
- entry-uploadとaura-formのe2e、AURA draft単体テスト等は停止仕様へ合わせる。既存の弱い検査の成功だけで停止完了としない。skip追加で合わせない。
- #133はroot整理前に統合方針を確定する。DB/Storage削除と公開3件の終了は今回の範囲外。

## 公式資料

- [Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project)
- [Download Objects](https://supabase.com/docs/guides/storage/management/download-objects)
- [Supabase Changelog](https://supabase.com/changelog)

公式資料とカタログの確認日: 2026-10-08。実バックアップ取得と復元は次の確認後に行う。
