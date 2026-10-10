# 旧テスト支払い・AURA/CARD残存APIの終了

## 方針を更新した根拠

2026-10-10 18:36 JST、所有者が旧AURA等の支払いは本人のテストであり、削除してよいと明示した。
paid2件を顧客の未履行購入として扱っていた前提を更新し、旧商品の書込機能を終了する。
ナトリの決済・通知・返金・共用認証は維持する。
DB上の削除承認とコードの本番反映確認は別。本PRはdraftで、本番反映前に確認する。

## 変更

- AURA assets/request/save/public-slugとCARD assets/request/saveの7 APIを、
  DB・Storage・body・認証tokenを読まない503/no-storeへ変更。middleware側の継続利用例外も終了。
- 上記だけが使っていたAURA/CARDのDB/schema/design/Studio/無料枠判定等と継続公開helperを除去。
  25ファイルをGit原本に保全。現在のCSSは21クラスをsafelistに残して維持する。
- 旧購入のStripe処理（AURA/CARD/展示プラン/ギャラリー）を終了。
  署名検証後の完了通知を200 ACKし、DB・再送防止表・証明書発行・メールを操作しない。
  削除後の再送が旧レコードを再作成する経路を残さない。
- ナトリの署名検証、入金inbox、旧方式の入金反映、claim/release、返金dispatcherは維持。
  `natori_commission`に古いentryIdが混入してもナトリ経路を優先する。
  不明な返金は既存のナトリ判定へ渡す。旧表/共用claim行の削除は実行しない。

## 保全と検証

基準SHAは`772470257c44bee3c1cc90625be9a04dd0292a30`。
変更/削除原本は`legacy-test-payments-20261010-manifest.json`のblob・bytes・SHA256で復元可能。
ナトリ入金handler本体と返金dispatcherの文字列を基準と照合し一致。
`src/features/natori`、ナトリの画面/API、認証、root、画像、DB定義、Phase/workflowに追加差分なし。

- 型/Lint成功（newsの既存警告2件）。関連5ファイル262テスト成功。
- 全体単体212ファイル・1,999件成功。
  前の2,011件から廃止サービスの試験37件（旧Webhook10・無料枠15・継続公開12）を保全移管し、
  新APIの無副作用14件・旧Webhook停止10件（各2種類のイベント）・ナトリ優先1件を追加。
  ナトリの既存試験は削減していない。
- 旧通知はpayment integrityのON/OFFと両完了イベントで、DB/RPC/通知/ネットワークなしを検査。
- 全体ブラウザ・専用Phase・最終Previewの確定結果はPR #152と整理計画に記録する。

## DB/Storageと残る条件

旧AURA paid2件は削除承認済み。Studio/CARD/ギャラリーの支払い情報は今回の照会では0件。
ナトリ決済7件と共有再送防止2件は保持する。DB/画像の永久削除は未実施。
機能復元・対象の別保存と共有依存の条件は[保持台帳](cleanup-data-retention-20261010.md)を参照。
今回のコード変更は既存の本番データやStripe設定を操作しない。
戻す場合は本PRをrevertし、案件が増えたDBを古いバックアップで巻き戻さない。
