# Phase 4: 相談の見落とし・返信漏れを防ぐ試験

GitHub hosted Ubuntu 24.04 の一時環境で実行する。PCローカルDocker、本番接続、自動Previewを試験環境に使わない。

## 再実行

1. `main` 向けPRでこのディレクトリ、対象機能、または `.github/workflows/natori-phase-4.yml` を変更する通常pushにより、PR段階で起動する。
2. Actionsの **Natori Phase 4 / All-stage consultation and reply visibility** を確認する。必要時は同じrunのRe-run jobsを一度実行する。
3. 成功件数は `phase4-browser.json`、`phasen-browser.json`、`phasen.json`、Storage/isolationのJSONとログに残る。実際にcheckoutされたSHAはPhase Tのevidenceを確認する。

workflow_dispatch / main先行マージ / pull_request_target / 本番Secretsは不要。workflow全体30分、PRごと同時1run、新pushで旧run取消。Phase 4試験は480秒上限、自動の試験再試行なし。既存CIの条件・skip・continue-on-errorは変更しない。

## 構成・隔離

- `.node-version` の Node 22、lockfile依存のみ。製品依存・lockfile変更なし。
- Supabase CLI **2.118.0**（Phase T既定checksum検証）、DockerはGitHub hosted runner提供版、Playwright **1.58.2 noble**。CLIが使用した実イメージID/digestはPhase T evidenceに記録。
- `PHASE_N=1 PHASE_4=1` でPhase Tの専用ディレクトリ・DB/Auth/Storage・乱数資格情報・kernel egress許可リストをそのまま使用する。
- build/downloadとtestの通信を分離。試験は専用内部ネットワークのSupabase API、同namespaceのNext:3000・メールcapture:3101だけ。子プロセスも同namespace、NET_ADMINなし、Docker socketなし、DNS/IPv6/他送信先を拒否。許可ポート追加後も隔離の否定試験を再実行。
- Phase Nの既存試験23件とブラウザ9件はそのまま実行。その後、同じ限定コンテナにPhase 4の読み取り専用スクリプトを追加mountして実行する。
- `build-fixture.mjs` はPhase N fixtureに、明示的に確認した相談3migrationと新しい集計RPCだけを追加する。全migration/seed/.temp/本番行のコピーなし。
- 試験専用Authログインページを用い、owner・staff2名・strangerの実Supabaseセッションを取得。Google認証は再現しない。合言葉キーの正規管理入口も実行する。
- 正規相談API→実DB→HTTPメールcapture→実画面を確認。captureへ向けるpreloadはテストコンテナ専用、製品コードには読み込ませない。
- URL、token、cookie、秘密鍵、Nextの生ログは出力しない。成果物は件数・固定試験名・架空画面のみ。後始末はPhase Tが作成したラベル付きリソースに限定する。

## 必須の実試験

- 最新senderと同一時刻ID順、旧failed→次attempt sentの集計、legacy通知失敗の独立表示。
- RPCはservice_roleだけ実行可。anon/authenticatedは実際の42501で拒否する。
- owner境界、staff2名と合言葉入口の同一案件、匿名・stranger・他owner案件の拒否。
- 13status＋archiveを直接取得、旧URLとfilterを越えた詳細表示、閲覧前後の案件全column・旧access不変。
- closed/archiveは履歴のみ、staff/client双方の書込拒否。
- キーボードで開閉、Dialogフォーカス、返信後の状態表示、制作status不変、旧リンク保持。
- client復帰/手動更新で新着取得、下書き保持、通知失敗でも保存済み、通知メールの共通detail URL。
- 360/390px、二重スクロールを増やさない、取得失敗と空履歴の区別、保存後の履歴更新失敗、再試行回復。

Chromiumのmobile viewportはiPhone Safari実機の代替ではない。実メール配達、新規添付アップロードの冪等性、ホーム画面版の添付別ウィンドウ問題、Google OAuthはこの試験の完了根拠に含めない。既存の添付取得方式・署名URLは変更していない。
