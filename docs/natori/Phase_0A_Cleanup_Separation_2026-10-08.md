# Phase 0A：ナトリ保護と旧サービス試験の依存分離

作成日：2026-10-08。基準：`07963f80950365678b96f0817f7477c4a283b774`。

## 目的と範囲

将来ギャラリーのコードを整理するとき、ナトリのStorage検査まで失わないよう、混在していた試験を分離する。今回は旧サービスを停止せず、全試験を継続する。製品コード、SQL、11バケットのfixture、Storage policy、workflow、Phase Tの共有runnerは変更しない。

## 分離後の構成

以下はすべて `scripts/natori-phase-0a/` 配下。

| ファイル | 責務 |
|---|---|
| `integration.ts` | 全suiteの必須実行、既存形式の集計、失敗時の非ゼロ終了 |
| `test-context.ts` | 隔離環境の設定・Storage client・架空画像・共通assertion・結果記録 |
| `gallery-suite.ts` | ギャラリー実API・grant・競合観測に依存する21ケース |
| `legacy-assets-suite.ts` | AURA・名刺のバケット保護2ケース |
| `natori-suite.ts` | ポートフォリオ・相談添付の3ケース |
| `storage-buckets.ts` | 指定バケットの書込・読取・service CRUD共通検査 |
| `suite-manifest.mjs` | 既存26ケースの名前・順序。欠落・重複・順序変更・skipを拒否 |
| `build.mjs` | 親と3suiteの独立bundle、非ギャラリーbundleの間接依存検査 |

`build.mjs <output-directory>/integration.cjs` という既存起動方法を維持。同じディレクトリに3個のsuite bundleを出力するため、Phase Tの既存read-onlyディレクトリmountで利用できる。個別suiteをスキップするフラグや、moduleがない場合に成功扱いする分岐は設けない。

Natori bundleの製品依存は既存 `src/features/natori/lib/consultationUploadEndpoint.ts` のみ許可する。親とlegacy assetsは製品コードを必要としない。実際のesbuild入力一覧で許可外の製品コードを検出したらbuildを失敗させる。

Supabase SDKはclient生成時のfetchを保持するため、初期化順も保存する。runtime設定→ギャラリー実API読込・観測器設置→共通client生成→架空画像生成→既存順序の試験実行。観測器は最後に復元する。製品の通信内容やHTTP応答を書き換える変更はない。

## 既存26ケースの対応表

すべてbefore/after両方で実行する。26件×2＝52件であり、既存READMEに残る過去時点の24件という記録とは区別する。

| ケースID | 移設先 | 維持する検査 |
|---|---|---|
| `origin-and-csrf` | gallery | CSRF欠落・異origin・origin欠落拒否 |
| `invalid-sign-path` | gallery | 任意path指定拒否 |
| `invalid-sign-bucket` | gallery | ナトリ納品bucket等への保存先変更拒否 |
| `invalid-sign-mime` | gallery | 不許可MIME拒否 |
| `invalid-sign-size` | gallery | 上限超過拒否 |
| `invalid-sign-hash` | gallery | 不正hash拒否 |
| `rate-limit` | gallery | 同一IPの6回目を429にする既存閾値 |
| `receipt-tamper-and-expiry` | gallery | 改ざん・期限切れ拒否、公開ファイル不存在 |
| `finish-before-upload` | gallery | 未upload確定の503、公開ファイル不存在 |
| `staging-private-and-unsigned-write-denied` | gallery | 仮置き非公開・匿名読書拒否・実体保持 |
| `signed-scope-cannot-change-path` | gallery | 署名path改変拒否、別path不存在 |
| `storage-enforces-size-and-mime` | gallery | Storage自身の容量・MIME強制 |
| `fake-image` | gallery | 偽装画像公開拒否 |
| `small-image` | gallery | 最小寸法未満公開拒否 |
| `truncated-image` | gallery | 壊れた画像公開拒否 |
| `receipt-binds-bytes` | gallery | 署名時と異なるbytes拒否 |
| `publish-png-and-replay` | gallery | PNG公開・再送同一URL・公開bytes・仮置き削除 |
| `publish-jpeg-and-replay` | gallery | JPEG公開・再送同一URL・公開bytes・仮置き削除 |
| `concurrent-finish` | gallery | 2actor同時確定、失敗保持、保存先一致 |
| `concurrent-observed-natural` | gallery | 自然競合96組、最初の失敗保持、bytes・仮置き不存在 |
| `concurrent-observed-synchronized` | gallery | 同期競合48組、最初の失敗保持、bytes・仮置き不存在 |
| `remaining-bucket/aura-assets` | legacy assets | 匿名書込差・private読取・署名読取・service CRUD |
| `remaining-bucket/card-assets` | legacy assets | 匿名書込差・private読取・署名読取・service CRUD |
| `remaining-bucket/natori-portfolio` | Natori | after匿名書込拒否・公開画像bytes・service CRUD |
| `signed-tus-client-large-file` | Natori | 実tus-js-clientの6MiB超upload・実体bytes |
| `signed-tus-client-resume` | Natori | 中断再開・HEAD offset・実体bytes |

共通helper内の署名scope・cache-control・読取bytes・不存在確認も維持。元の43個の `check(...)` 呼出と15個の `test(...)` 呼出箇所について、TypeScript ASTで移設前後の式・試験本文の一致を確認した。ループ展開があるため呼出箇所数とケース数は異なる。

## Phase Tに残るナトリ保護

この分離でナトリ保護が3件だけになるわけではない。未変更の `scripts/natori-phase-t/run.sh` は、isolationと `storage.mjs current/candidate` を引き続き実行する。

`scripts/natori-phase-t/storage.mjs` の `natori-inquiry-refs`・`natori-consultations`・`natori-deliveries` に対する次の検査は移設・削除しない。

- 既存ファイルと切替前発行の署名URLのbytes維持。
- 匿名・無関係の認証済みユーザーによる書込拒否。
- 非公開ファイルの公開URL・匿名読取拒否、service CRUD。
- 署名upload/download、署名対象path改変拒否。
- 相談TUS旧経路のpolicy依存回帰検査。

隔離ネットワーク制限、catalog照合、未承認cutover拒否、同名policy drift拒否、timeout、cleanup、失敗時終了も変更しない。11バケットのfixture・policy照合を緩めてCIを通す変更は行わない。

## 出力と失敗の扱い

ケースID、実行順序、`PASS/FAIL phase0a/<mode>/<name>`、`phase0a-before.json`・`phase0a-after.json` の既存schemaを保持。assertion失敗は結果に残り、summaryのfailed件数と終了コードに反映する。新しいinventory検査はfailed結果を許容して集計へ渡す一方、未実行・skip・重複を成功に見せることを拒否する。

## 検証状態と次の条件

ローカルで確認済み：全4bundle構築、3つの非ギャラリーbundleの間接依存境界、全suiteのnative dynamic import、既存check/test呼出AST一致、inventoryの欠落・重複・順序変更・skip拒否と失敗結果保持、全体のTypeScript型検査、変更スクリプトのESLint、Node構文、差分空白検査。suiteのimport確認では試験本体やAPIを実行していない。

**この文書作成時点では、変更後の隔離CIと実Storage検証は未実施。** 52ケースとPhase Tの結果は変更後の同じcommitに対する隔離CIで確認する。bundle構築やAST一致を実Storage成功の代用にしない。公開ナトリ・本番データへの書込やサービス停止をこの変更の検証として実施しない。

将来gallery suiteを引退するときは、親の必須呼出・build対象・inventoryのgallery部分だけを明示的な変更として扱う。Natori suite、共通Storage helper、Phase Tのナトリ権限検査は継続する。旧バケット削除は別段階であり、fixture/catalogとの整合確認を経ずに進めない。
