# Natori Phase 4 実装結果

更新日: 2026-09-27

## 対象と開始点

- 依頼: Phase 4「相談の見落とし・返信漏れを防ぐ改善」。F11 / F17 / U02 / U03 / U06 / U07 / U14（管理側）。
- 開始main: `6b3b39ecc02b63cb0a10293c8e7b2503559e12d3`（PR #99）。作業開始時に最新mainと一致を確認。
- branch: `codex/natori-phase-4`。既存の同名branch/PRなしを確認して作成。
- 実装、通常push、Draft PR、隔離CIまで。本番DB・メール・設定・main merge・本番配信は未実施。

## 変更したこと

1. 全工程を同じ相談詳細へ接続。旧 `/natori/inquiries?project=...` を保持し、相談メールと案件カードは `view=conversation` 付きで同じ画面を開く。filterに含まれない案件もowner条件付きのID検索で開く。
2. 最新の実メッセージのsender/created_at/idを集計し、「新規・未対応」「ナトリの返信待ち」「依頼者の返信待ち」を表示。制作status、noteのメール記録、既読は判定に使わない。最終発言が古い順で表示し、日付は日本時間。
3. 管理ホームに全工程の要確認リスト、案件カードと相談一覧に返信状況を表示。メールの失敗・未送信を別に表示。Phase Nは各notification_keyの最新attemptだけを集計し、過去のfailedを再通知扱いにしない。
4. 相談履歴は表示時・画面復帰時・手動更新・送信後に取得。履歴更新で下書きや表示中の過去履歴を消さず、新着へは明示操作で進む。保存後に取得失敗しても「送信失敗」にはしない。
5. closed/archiveは履歴のみ。実APIの既存書込拒否を維持。詳細は既存Radix Dialogへ接続し、キーボード、Escape、フォーカス復帰を扱う。相談内の固定スクロール領域を除去。
6. ラフ案内は既に案内済みの相談ページからの返信を優先し、期限切れ時の既存再発行と、リンクが見つからない場合のメール返信を案内。メール直接返信は履歴に自動取込されないと明記。

### 計画との設計判断

旧consultation tokenはhashのみ保存されるため、ラフメールの都度既存URLを復元して添付することはできない。今回はラフ本文で既存の案内先を使うよう明示し、**token追加発行・有効期限延長を新たに実装しない**。以前のURLは元の期限のまま利用でき、期限切れ画面の再発行経路を残す。相談API自体の既存の新規返信通知・再送の仕様は変えていない。

リアルタイムチャット、既読管理、業務状態の再設計、相談処理の全面outbox化は追加しない。通知失敗の一元的な再送設計・添付finalize再試行はPhase 3B、納品の完全性はPhase 1へ引き継ぐ。

## DB・権限と移行順

新migration: `supabase/migrations/20260927102757_natori_consultation_overview.sql`（CLI 2.118.0のmigration newで作成）。

- `natori_consultation_overview_v1(owner UUID, project UUID[])` を追加。SQL stable / SECURITY INVOKER / 空search_path。
- service_roleだけEXECUTE。anon/authenticated/publicのEXECUTEを明示revoke。APIがowner絞込み済みIDを渡し、RPCもowner条件を再適用する。
- 1batch最大100件。既存のproject/created_at/id索引とnotification project索引を使用し、不要なcolumn/index追加なし。
- **全テーブルの業務行・status・quote・snapshot・accepted_at・paid_at・入金・納品・token・Storageを更新しない。backfillなし。**
- 未適用DBやRPC取得障害は `consultation: null` とし、「返信状況を取得できません」と表示。空会話に変換しない。

本番作業は別途承認後に、(1) 対象SHA/既存相談・Phase N定義/権限をread-only照合 → (2) このadditive RPCだけ適用 → (3) 権限・owner境界・read-only結果確認 → (4) application merge/配信 → (5) 管理ホーム・制作案件の相談・既存依頼者URLの確認、の順。必須照合に失敗したら停止する。全migration履歴の無検証適用はしない。

rollbackはapplicationを直前版へ戻せる。追加RPCを残して旧コードが動作する。データ修復やtoken再発行不要。即時のDROP/contractは行わない。

## テストと証跡

ローカル関連テスト、型検査、baseline静的検査、lintを実行し、続いてDraft PRのActionsで本番から隔離したDB/Auth/Storage・HTTPメールcapture・Chromiumを検証する。

- 実行結果とrun/checkout SHAは本書の最終更新で記録する。現段階のスクリプト作成だけでは完了扱いにしない。
- Nodeは既存`.node-version`、CLI/Playwright/隔離方法は `scripts/natori-phase-4/README.md`。
- 既存CIは条件もskipも変更しない。Phase T/0B/Nの安全条件を維持。

## 本番前に残る確認

- iPhone Safari実機: 管理ホーム→制作中案件の相談→入力→戻る、キーボード表示時の送信ボタン、古い依頼者URLから履歴更新。隔離Chromiumの360/390pxを実機済みと扱わない。
- ホーム画面版の添付白画面はユーザー了承済みの別問題。今回、添付URL・Storage policyは変えていない。
- me-ishギャラリー・未使用Colab運用は変更対象外。
- 実顧客へのメール送信や既存正式案件への書込は検証に使用しない。
