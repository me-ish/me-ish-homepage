# Natori Phase T 実装・試験結果

状態：**実装済み、Actionsの実Storage試験は未検証。初回Phase Tはまだ未完了。**

- 開始main: `21d4e34587d062cebe361acfb6557ad15daa69e3`（指定SHAと一致、PR #94反映済み）。
- 作業branch: `codex/natori-phase-t`。開始時に同名branch/PRなし。
- 許可範囲: 作業branch commit/非強制push、main向けDraft PR、Actions試験まで。
- 本番製品コード、UI、DB、Storage policy、token、顧客/ファイル、Stripe、メール、Production設定は変更しない。
- 実行場所: クラウドWork→GitHub Actionsの一時Linux/Dockerへ変更。ユーザーPC/ローカルDockerに依存しない。

## 接続・自動処理の確認

GitHub read/push権限、作業branch作成、Actions run/job/logの取得は確認済み。
クラウドshellにgit push認証がないため、認証済みGitHub接続でcommitとfast-forward ref更新を行う。forceは使わない。
workflow配下の書込とDraft PR作成は初回push/PR時に確定する。

既存CIはpull_request(main)とpush(main)でtypecheck/lint/audit/test/E2Eを実行。変更しない。
Vercelの直近Productionは`dpl_6DjayH2fTxDyeyeWjNJQBxc31Usb`、mainの開始SHA。既存feature branchはPreview実績を確認。
`get_project`ツールは引数不整合でproject設定を取得できなかったため、Production branch設定値そのものは未確認。deployment履歴は確認済み。設定変更/手動deployなし。自動Previewが生じてもStorage試験先にはしない。

## 定義・実装

2026-09-27に本番catalogの必要最小限を読み取り、F01/NEW-01が残ることを確認。実データ/実ファイル/Auth userは取得なし。
7 bucket / 16 objects policy / role別GRANT / RLSを`fixtures/catalog.json`へ記録。隔離DBへ投入後の照合を必須化。
候補は4つの広域write policyのみ除去。公開読取とavatar/banner owner制約、GRANTを維持。

専用workflow、CLI固定/検証、専用config/fixture、kernel egress制御、設定誤接続拒否、実Auth user・実Storage比較、実体readback、限定cleanup、非機密artifactを追加した。
製品package/lockfileと本番migrationへの変更なし。

## 試験実績

| 検証 | 実績 |
|---|---|
| Work内のbash/Node構文・fixture生成 | 成功。Work内Nodeは24のためCI Node22検証の代替ではない |
| 隔離network否定/正試験 | 未実行 |
| 現行Storage設定 | 未実行 |
| 限定候補 | 未実行 |
| GitHub Actions run / checkout SHA | 初回実行後に記録 |
| pass / fail / skip | 未確定。未実行をskip成功と扱わない |

## Phase 0Aへ渡す残課題

**artworksの既存応募フォームは匿名直upload(upsert)に依存する。候補を本番へそのまま適用しない。** 署名/認可adapterを整えたうえで正規ブラウザ経路を回帰する。
Storage primitiveの成功は、製品APIの認可、既存token、全UI、全業務flow、Colabの実Secret role、大容量TUS/再開の保証ではない。
再実行と定義/バージョン/保護条件の詳細は[`scripts/natori-phase-t/README.md`](../../scripts/natori-phase-t/README.md)。

このWorkはDraft PRと実試験報告で止める。main merge、本番反映、Phase 0A適用は行わない。
