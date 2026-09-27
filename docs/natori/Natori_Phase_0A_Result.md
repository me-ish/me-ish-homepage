# Natori Phase 0A Result

作業日: 2026-09-27。状態: 実装済み、GitHub Actions実試験待ち。本番Storage変更なし。

## 開始点とPhase T

- Phase T Draft PR [#95](https://github.com/me-ish/me-ish-homepage/pull/95) を最終レビューし、ユーザー承認に基づきmainへ取り込み済み。
- 開始main/merge SHA: `e59e48ae51544217fdd141840b3b754200bd90cf`。PR95最終head: `a639a41199edc06f8db63bcd47a5ffaa74e72aa1`。
- PR95 ready後のPhase T再実行 [36284336717](https://github.com/me-ish/me-ish-homepage/actions/runs/36284336717) 成功。main側CI [36284495914](https://github.com/me-ish/me-ish-homepage/actions/runs/36284495914) 全ジョブ成功。Vercelの通常自動Production配信も同じmerge SHAでREADYを確認した。
- 作業ブランチ: `codex/natori-phase-0a`。Phase 0Aは [Draft PR #96](https://github.com/me-ish/me-ish-homepage/pull/96) で止める。本番適用・本PRのmergeは未実施。

## 実装

F01/NEW-01に対応する4つのPUBLIC書込policyを閉じる前提として、匿名ギャラリー応募をprivate署名upload→server画像検証→artworks新規保存へ移した。案件管理フローは変更しない。相談TUSは署名を検証する専用endpointへ接続する。

新private bucketのadditive migrationと、既存4policyを削除する承認guard付きcutover SQLを分離した。後者は自動migration対象外。既存のbucket公開性、object名、URL、token、Auth、quote、支払、納品、受取、相談の業務行を変更しない。

詳細な操作行列、定義照合、テスト/再実行、移行順序、rollbackは [Phase 0A runbook](../../scripts/natori-phase-0a/README.md) を参照。

## 検証結果

Work内の型検査・unit/component、Actions上の実Storage試験、既存CI/新規ブラウザ試験の結果は確定後に記録する。スクリプト作成やmock成功だけで完了とはしない。

## 本番への残課題

1. 全カタログの直前再照合とColab鍵のrole確認（値は表示しない）。
2. 新private bucket追加→互換コード配信→正常経路確認→policy切替の個別承認。コードよりbucketが先。
3. cloud Storage gatewayのsigned TUS/CORS、iPhone Safari、中断再開を許可された架空データで確認する手順の合意。
4. 仮置きファイルの容量監視・残留対応担当と切替時の古いタブ再読込案内。

既存案件・実作品・実tokenでの試験、本番policy変更、本番bucket追加は行っていない。Phase Tの承認済みmergeによる通常の自動配信と、Phase 0Aの未承認本番適用を区別する。
