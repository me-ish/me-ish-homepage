# 専用クラウド受入runnerのローカル準備

既存 `natori-case-local-auth/run.mjs` は変更しない。こちらは別の明示的な
`hosted-password-read-only` profile。通常アプリの認可・production gate、公開ルート、
ログインUI、migration、依存パッケージを変更しない。

現在の承認は **ローカル実装と外部通信なしの合成試験まで**。
以下の外部実行用コマンドは将来の承認後の手順であり、今回は実行していない。

## 接続前の条件

- NodeのTypeScript type strippingが必要（22.18以降、今回実測は24.19.0）。既存依存のみ使用。
- 親が承認対象の固定Preview origin、独立Vercel project、正確な配備SHA、専用Supabase ref、
  Stripe test account、run ID、期間、受信先1〜2件、総試行12回を非秘密JSONに固定する。
- `config.mjs` のstrict schemaを使う。共有のアプリtarget validatorを再利用し、
  本番ref・本番project・本番domain・live・任意URL・設定不明を拒否する。
  runnerでは通常の `*.vercel.app` Previewだけを許す。custom domainを追加しない。
- `plan` はネットワーク・資格情報・ブラウザへアクセスしない。既定の引数なしはhelpだけ。
  実行モードは別名 `execute-read-only` で、レビューした設定のSHA-256が必須。
  ハッシュは設定取り違え防止であり、会話上の実行承認を代替しない。
- 親が正規のVercel管理接続からPreview・project・origin・SHA・READYを確認し、
  5分以内の非秘密receiptを渡す。runnerはホスト名から所属やSHAを推測しない。
  receiptは管理読取結果の記録で、暗号学的な配備証明ではない。確認できなければ実行しない。
- 実行直前・終了後にSupabaseのrun・登録案件・ownerをGETだけで照合する。
  `mail_limit=human_limit=12`、`allowed_to=human_to=承認した受信先` が完全一致すること。
  第三の受信先、旧資料の総30試行、別account/owner/run、余分な登録案件は拒否する。
- staff/outsiderは専用プロジェクトに事前作成済みの確認済み合成ユーザーで、
  メールは `@example.invalid` のみ。このrunnerはユーザー・fixture・キーを作らない。
  合成案件の準備とAuth設定は別承認。共有キーCookieは使用しない。

非秘密設定の形（値は対象確定後に親が作る。実ホストや秘密値はこのリポジトリへ保存しない）:

```text
version: 1
purpose: hosted-password-read-only
sourceCommit: <配備する40文字SHA>
target: {profile: hosted, ref, project, url, origin, run, startsAt, endsAt}
owner: <合成owner UUID>
stripe: {account: <承認したacct_...>, mode: test}
mail: {scope: <専用mail scope>, allowedTo: [<承認した1〜2宛先>], maxAttempts: 12}
fixtures:
  staff: {id: <合成UUID>, email: <staff@example.invalid>}
  outsider: {id: <別UUID>, email: <outsider@example.invalid>}
  projects: [<登録された合成案件UUID、1〜10件>]
  foreignProject: <未登録かつ別ownerの合成案件UUID>
```

配備receipt:

```text
{version: 1, origin, project, sourceCommit,
 environment: preview, status: READY, observedAt: <管理読取のISO日時>}
```

JSONファイルは `/workspace` / `/tmp` 内の通常 `.json` ファイルだけ。`.env*`や
symlinkは開かない。追加フィールドに秘密値・権限迂回オプションを入れるとschemaで拒否する。

## 将来、別承認後の実行

```sh
node scripts/natori-case-hosted/run.mjs plan --config /tmp/approved-hosted-plan.json
```

計画・digestを親の会話で提示し、外部実行・専用環境設定・必要な権限の承認を確認する。
管理者または承認されたsecret連携が次の4変数を対象runnerへ直接注入する。
値をJSON・argv・会話・公開ファイルへ渡さない。既存production秘密値は使わない。

- `NATORI_CASE_HOSTED_ANON_KEY`: 検証先の公開anon key
- `NATORI_CASE_HOSTED_SERVICE_ROLE_KEY`: 検証先のserver key。run等の固定3 GETだけに使用
- `NATORI_CASE_HOSTED_STAFF_PASSWORD`: 合成staffの専用password
- `NATORI_CASE_HOSTED_OUTSIDER_PASSWORD`: 合成outsiderの専用password

```sh
node scripts/natori-case-hosted/run.mjs execute-read-only \
  --config /tmp/approved-hosted-plan.json \
  --approved-sha256 <レビュー済みdigest> \
  --deployment-evidence /tmp/checked-preview.json \
  --out /tmp/new-hosted-read-result
```

既存出力への上書きはしない。`result.json` のみ保存し、session・Cookie・HAR・HTML・
本文・raw error・資格情報・一時SDK bundleは保存しない。親は結果をこの会話へ返せるため、
利用者に子Workの画面を開いてもらう必要はない。

## 実行する範囲

1. 管理receiptと承認digest、DBのrun/owner/宛先/12試行/登録案件を確認。
2. ブラウザは新規context、Service Worker無効。未認証・非staffを拒否確認。
3. 通常のbrowser Supabase clientをメモリだけでbundleし、合成passwordでログイン。
   公開bootstrapや認証例外を配備しない。staffのID/emailも照合する。
4. 通常APIで一覧・支払読取・照合読取・制作読取と、別ownerの404を確認。
5. PC/mobile viewportでToday/Cases/Schedule、履歴移動、再読込の共通案内を比較。
6. session refresh/logout後の拒否、送信消費数の不変を確認してcontext/browserを閉じる。

ブラウザのAPIRequestContextはroute制限を通らないため使わず、page内fetchを使う。
Auth token/refresh/user/local logout以外のPOST、業務writer、Google authorize、
Stripe/Resend/Storage、WebSocket、別host、任意案件は遮断する。
redirectは全段追従せず拒否し、retryしない。認証・保護のためのredirectを検出しても
迂回しない。PreviewがVercelログイン等を要求する場合はそこで停止する。
Font CSSのみ空のローカル代替で、外部Google Fontsを取得しない。

## 外部通信なしの検証

```sh
node --require ./scripts/natori-case-preview/deny-network.cjs \
  --test scripts/natori-case-hosted/runner.test.mjs
```

Node socket接続を既存のdeny hookで禁止。HTTP応答とブラウザはtest doubleで、実SDKの
メモリbundleも確認する。これは実ブラウザ・実Auth・実ホストの受入成功ではない。

未検証: 実ホストの保護/配備receipt取得/secret注入/権限、実Supabase password設定、
Stripeキーの実account・権限、実メール・Webhook・Storage、Google OAuth/PKCE、実iPhone。
本runnerはStripe accountをDB契約と照合するだけでStripe APIへ接続しない。
メール上限は既存アプリの原子的DB guardで維持し、本runnerは送信しない。
Authのsignin/refresh/logoutは将来実行時にsessionを書き込むが、業務更新は許可しない。
失敗時もブラウザを閉じる。失敗がlogout前ならサーバーsession失効は保証せず、
合成アカウントの準備・終了処理で対象sessionの失効を別途確認する。


## 個人予定と明示操作の受入（2026-10-23）

このrunnerのGET/Auth限定policyは維持する。`NATORI_CASE_ACCEPTANCE_EVENTS`による個人予定の専用fixtureは[明示受入手順](../../docs/natori-case-explicit-acceptance-procedure-20261023.md)を使う。
読取runnerの基準確認を行った後、別承認された通常ブラウザで対象UIを工程ごとに確認する。runnerに業務POST/DELETEを追加しない。個人予定を有効化した入口の追加fetchを、このrunnerが網羅したとは報告しない。

外部通信なしの個人予定検証：

```sh
node scripts/natori-case-local-auth/run.mjs /workspace/new-events-evidence --normal-schema --payment --acceptance --events-only
```

通常53本schemaと実ローカルAuth/PostgREST/middlewareを使い、最大3固定IDのうち合成1件だけをcreate/read/update/deleteする。無関係な同owner/他ownerの予定は維持し、案件/支払やproviderへ作用しない。purge/本文消去/receipt退役/TRUNCATEへ入らない。

別のoffline build（Node22推奨）：

```sh
node scripts/natori-case-hosted/build-offline.mjs /workspace/new-offline-build-evidence
```

全ソースを`.env*`なしでコピーし、コピー内でprebuildとNext production buildを実行。全socket接続を遮断し、既存のGoogle Font CSS test hookと無効な合成キー文字列だけ使用する。実フォント・外部サービス/本番profile/配備/実ホスト性能の成功証明にはしない。
