# Phase 0A — Storage認可の切替準備と隔離試験

対象: F01 / NEW-01。Phase Tで露呈した正常アップロードの互換性を先に確保し、Storageの公開書込policyを閉じる。本番適用は別承認。PRをマージするだけで下記cutover SQLを自動実行しない。

## 変更理由と境界

PUBLIC INSERT `true` と artworksのPUBLIC UPDATE/INSERT/DELETEを削除すると、従来の匿名ギャラリー応募が止まる。相談のTUSも署名を検証する専用routeへ合わせる必要がある。そこで製品側の互換コードと、限定policyの手動適用ファイルを分離する。案件・quote・支払・納品・相談の行、既存オブジェクト名・公開URL・token/hashは変更しない。全migrationの一括適用はしない。

実行場所はユーザーPCではなくGitHub-hosted Linux Actions。Phase Tと同じ使い捨てDB/Auth/Storageを使い、製品のupload serviceをbundleして実Storageへ接続する。Previewは試験環境と扱わない。本番Secretsや実作品は使わない。

## 操作行列

| bucket / 経路 | 主体・権限 | 切替後の期待 | 確認方法 |
| --- | --- | --- | --- |
| artworks / ギャラリー応募 | 匿名利用者 → 同一origin API → 署名付きprivate仮置き → server検証 → service保存 | 指定された新規画像だけ公開。任意path指定、既存作品更新・削除不可 | 実POST/service + SDK + 実Storage、ブラウザUIは通信mock |
| artworks / 管理・Colab | service_role、正規管理処理 | CRUD成功、公開URL維持 | 隔離service JWTでCRUD。実Colabに設定された鍵のroleは未確認 |
| avatars・banners | Auth JWT、先頭path = auth.uid() | 自分のupload/upsert/delete成功、他人の更新・削除/新規書込拒否 | Phase T実Auth/Storage回帰 |
| natori-inquiry-refs | 既存署名発行 → 署名upload | 成功、匿名直接書込/読取拒否 | Phase T署名Storage試験。応募業務全体は対象外 |
| natori-consultations | 既存相談token認可 → service署名 → x-signature付TUS `/sign` | 作成・分割PATCH・中断再開・取得成功 | 実tus-js-client、偽署名拒否、UI component回帰 |
| natori-deliveries | 既存管理認可 → service署名、必要な署名read | private維持、正規署名成功 | Phase T実Storage。納品/受取業務全体は対象外 |
| processing-meta | service書込・既存SELECT | service成功、匿名書込拒否、既存読取を維持 | Phase T回帰。SELECTの是非は本変更で拡大しない |
| aura-assets・card-assets | 既存request access認可 → supabaseAdmin | service CRUD成功、匿名直接書込拒否 | 実Storage + 呼出コード確認、全製品E2Eではない |
| natori-portfolio | 管理service | CRUD成功、public画像維持 | 実Storage + portfolio service確認 |
| gallery-entry-intake（新規） | serviceが発行したpath限定署名だけ | JPEG/PNG・10MiB、private。通常anon/Auth CRUD禁止 | restrictive policyを旧PUBLIC INSERTと併存させて実試験 |

照合した主な呼出箇所: `src/app/[locale]/entry/FormWrapper.tsx`、`src/app/admin/api/entries/[id]/approve/route.ts`（管理認可→artworks copy/processing-meta）、`src/components/ProfileEditModal.tsx`（所有uid prefix）、`src/features/natori/data/supabaseDeliveryFiles.ts`、`src/features/natori/server/consultationFilesService.ts`、`src/features/natori/components/consultation/ConsultationThread.tsx`、`portfolioSiteService.ts`・`projectThumbsService.ts`、`src/app/api/aura/upload/works/[id]/route.ts`・card同等route（request access認可→admin）。Storage操作と業務認可の責任を区別し、service JWTの成功だけで各製品の全業務認可が検証済みとはしない。

## ギャラリー応募の実装

1. `POST /api/entry/upload` action=sign。8KiB以下のstrict JSON、同一Origin、既存CSRFヘッダー。PNG/JPEG・10MiB以下・SHA256のみ受け付ける。bucket/pathは指定できない。
2. serverがランダムな `entry_<UUID>.png/jpg` を決定。private bucketの `pending/<fileName>` にupsert=falseの署名uploadを発行。
3. ブラウザからprivate Storageへ送る。画像本体をVercel API bodyへ通さず、APIのbody制限を回避する。
4. action=finishはHMAC receiptを検証し、Storage実体の容量・MIME・SHA256、画像magic、全体decode、短辺960px以上・長辺3000px以下・単一画像を確認する。serviceがartworksへ新規保存し、再取得で同一bytesを確認してURLを返す。entries登録・メール等の既存業務はその後。
5. 再送・同時finishは同一fileName/bytesだけreplayする。既存別作品へ上書きしない。仮置き削除の失敗で公開成功を取り消さない。

Storageの署名自体はpathを限定する。容量/MIMEはbucketで強制し、SHA256/申告容量/形式/期限はアプリのreceiptとfinishで結び付ける。Storage署名だけでhashを強制できるとは主張しない。署名の有効期間は2時間。厳密な一回限りcapabilityではなく、削除済み仮置きpathが期限内に再作成される可能性があるが、公開先の別bytesへの上書きは拒否する。

receiptは既存server専用service keyをdomain separation付きHMACに使う。新しい環境変数・クライアントへのservice key公開はない。鍵のrotation中は未完了receiptだけ再発行が必要。既存作品・案件tokenには影響しない。receipt/Storage署名をログや結果artifactへ出力しない。

制限: 既存のprocess内IP rate limit（sign 5回/10分、finish 15回/10分）は分散環境の総量保証ではない。匿名応募の濫用を全面解決するものではない。途中離脱・無効画像の仮置き残留については下記運用条件を満たすこと。entries insert失敗時の二重案件防止等は本変更の対象外。

## 定義照合とバージョン

- 2026-09-27に本番 `storage.buckets` 設定と `pg_policies` のみ再照合。16 policyはPhase Tの記録と一致。業務行、storage.objectsの行、実ファイル、Authユーザー、秘密鍵は取得していない。
- Phase Tの7bucketに、aura-assets・card-assets（private）、natori-portfolio（public）の3bucketを追加したfixtureを使用。3bucketとも本番の容量/MIME制限はNULL。新規private bucketを加えた11bucketを正確比較する。
- GRANT/RLSはPhase T取得値を保持。切替直前に再照合する。GRANT一括取消はしない。
- Supabase CLI 2.118.0（SHA256検証）、CLIが指定するStorage v1.77.0。Nodeは既存 `.node-version` の22系。Dockerイメージdigest/runner patch/Node解決版は毎回artifact `versions.txt` へ残す。
- 製品lockfile既存のsupabase-js 2.76.1、tus-js-client 4.3.1、sharp 0.35.4を使用。esbuildも既存lockから試験bundleにだけ使用。依存追加・一括更新なし。
- 公式の[署名upload](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)、[resumable upload](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)、[Storage v1.77.0 source](https://github.com/supabase/storage/tree/v1.77.0/src/http/routes/tus)を確認。CLIのsigned TUSは `/upload/resumable/sign`。本番gatewayの動作は本試験から推定せず、下記リリース条件で別途確認する。

## 再実行と試験分類

`codex/natori-phase-0a` の対象ファイルを通常pushするとPR上で `Natori Phase 0A` が走る。最初からmainへマージする必要はない。失敗したrunは同じSHAでGitHub ActionsのRe-run jobsを使える。workflow_dispatchやpull_request_targetには依存しない。

専用workflowはcontents:read、PRごと同時1run、25分上限。npm ci/CLI/image取得を構築段階に限定。試験段階はPhase Tの内部Docker network、非root・権限削減、kernel egress allowlistを継承。製品serverを含む全子プロセスの通信先を隔離Kongの固定IP:8000だけへ限定する。DNS/外部接続/IPv6は禁止。本番URL否定試験、子プロセス逃避否定試験も継続する。

- 元の17 isolation + 35 current + 35 candidate実Storage試験を維持。
- Phase 0Aの実API/service試験をpolicy変更前後で各24ケース。認証不足や起動失敗をskip扱いにしない。Storageレスポンスだけでなくbytes/不存在/残存を確認する。
- cutover未承認・同名policy driftを否定試験。失敗時に部分削除されていないことをカタログで確認する。
- TUSは実tus-js-clientを使用。6MiBを超えるファイルとHEAD offsetを伴う中断再開を確認。CLIのLocationがlocalhostを指すため、試験側だけ返却pathを固定内部originへ置換する。製品には試験用例外を入れない。本番CORS/gateway/Safariの証明とは区別する。
- unit/component: receipt改ざん/期限/鍵境界、相談UIの成功と失敗。Playwright: 実応募画面の署名→upload→finish→登録順と、mobile viewportのfinish失敗時に登録しないこと（通信mock）。
- Stripe/メール送信、既存案件の全フロー再現は対象外。既存4 E2E skipは変更しない。

## 承認後の本番反映順（このPR作業中は実行しない）

1. **read/verify**: 全bucket・全Storage policy・GRANT/RLSを再照合。想定16 policyと差があれば中止。呼出主体を確認し、特にColab `SUPABASE_KEY` は値を表示せずservice_roleであることを運用担当が確認。通常anon書込をする未把握consumerがないか確認する。
2. **expand**: 別承認のうえ `supabase/migrations/20260927010903_natori_phase_0a_gallery_intake.sql` だけを適用。private bucketとrestrictive policyを同じtransactionで追加。既存migration履歴を一括pushしない。既存10bucketを変更しない。新bucketが既にあれば自動上書きせず差を確認。
3. **deploy compatibility**: 上記存在確認後にこのPRをmainへ取り込み、通常のVercel配信を確認。順序を逆転すると新規応募の署名発行が失敗する。現時点のPR Previewを本番credentialで試験しない。
4. **verify compatibility**: 専用の架空案件/運用上許可された検証データでギャラリー画像・既存公開画像、Auth所有avatar/banner、相談の実ブラウザsigned TUS（特に本番gateway、CORS、中断再開/iPhone Safari）を確認する。既存顧客のファイル/tokenを試験に使わない。既存タブの再読込案内と切替時間を決める。署名TTLが最大2時間であることを考慮する。
5. **cutover**: ここまでの結果と適用範囲について明示承認後、`supabase/operations/natori-phase-0a/restrict-storage.sql` を単独で実行する。operatorが同じsessionで `SET natori.phase_0a_cutover='approved';` を指定する必要がある。これは人的承認の代替ではない。17 policy・新bucket・限定guard・削除対象4定義の機械guardに加え、直前の全カタログ照合が必須。4つのPUBLIC書込policyだけをtransaction内で削除する。
6. **observe**: 新旧公開画像、private資料の署名取得、管理service操作、avatar/bannerの所有者境界、応募/相談uploadエラー率を確認。顧客ファイルの取得や変更を無断で行わない。古い応募タブからの直接uploadは拒否されるため再読込で復帰させる。再読込でフォーム入力が失われる点は切替時の案内に含める。
7. **contract**: このWorkではcolumn削除/旧ファイル移動/既存token再発行は不要。仮置き残留の監視・保存期限を運用担当と決める。将来削除jobを作る際は、このbucketのpending prefix・署名2時間を十分超える経過期間・完了確認を限定条件にし、既存artworksや案件資料を触らない。無制限の自動一括削除はしない。

本番反映前の残条件: 架空データによるcloud gatewayとiPhone Safari確認方法/担当の合意、Colab credential role確認、仮置き容量監視と残留時の対応責任者、上記expand→deploy→cutoverそれぞれの承認。これらが未完了のまま「本番修正済み」としない。

## Rollback

- expand後・互換コード配信前: 既存コードは既存bucketを使い続ける。新bucket/policyは残したままapplication rollback可能。空でないbucketを削除しない。
- 互換コード配信後・cutover前: 同じくapplicationを戻せるが、F01/NEW-01はまだ残る。準備期間を短くし切替担当を明確にする。
- cutover後: 旧匿名直書込実装への単純rollbackは禁止。PUBLIC書込を復活させない。検証済み互換adapterを維持してforward fixするか、影響する新規受付だけを一時停止し既存公開read/案件tokenは維持する。新旧APIを無期限併存させる広いallow policyを足さない。
- 本変更に案件の不可逆データ変換はない。公開済み画像は仮置きcleanup失敗でも削除しない。障害時に既存作品や受取記録を巻き戻さない。
