# 未使用依存の整理と後続引継ぎ（2026-10-09）

基準 main: `4bec943c722e0d9c6257e855ec258bacfbc05379`（PR #141）。
今回のソース・公開画像・DB・Storage・権限・課金設定の変更は0件。

## 現行状態の照合

GitHubで #139 / #140 / #141 のmergeを確認。Vercelの公開ドメイン照会で、本番
`dpl_23zbE42S624NbGTwH1m8YGSbZzuj` は上記SHA、production / READY、
`www.me-ish.art` と `me-ish.art` の割当を確認した。
#133（privacy）と #135（動画）はopen / draftで、本変更に含めない。
保存用archiveの3ブランチは既存資料の基準SHAと一致する。

## 変更と依存調査

全Git追跡ファイルを検索し、実行コード、手動スクリプト、設定、CI、保存済み成果物に
`react-hook-form` / `@radix-ui/react-dropdown-menu` の利用がないことを確認。
package.jsonとlockfileからこの2依存を除く。npmが除く推移依存は
`@radix-ui/react-menu` とその入れ子の `@radix-ui/react-slot` のみ。
残る全lockfile package定義は基準とJSON単位で一致し、更新・追加はない。
React/DOM型定義は自動解決されるため、文字列importがないだけでは削除しない。

| 保持する依存・設定 | 現行利用／判断 |
| --- | --- |
| dnd-kit | ナトリの公開内容編集 SortableList |
| tus-js-client | ナトリの相談添付・納品アップロード |
| react-nipple / Three / react-spring | 公開ギャラリー・共通表示 |
| html-to-image / jspdf / qrcode.react | CARDのPDF・QR |
| OpenAI / Stripe / Resend / Supabase | 残る生成・決済・通知・データ経路。個別の入口確認が必要 |
| root / Analytics / fonts | #133の統合判断が未確定。保持 |
| public素材 | ナトリ・既存公開ページの参照と動的DB参照があるため保持 |
| Phase CI / fixtures / migration / legacy upload | 既存の回帰・隔離検証に必要。保持 |

## 検証方法と限界

最終コミットの結果はPR本文に記録する。通常ゲートは `npm run typecheck`、
`npm run lint`、`npm test`、`npm run test:e2e` と既存CI。
既知のbraces audit（9 high）は強制更新せず保留する。
ソース、e2e、CI、Supabase、公開素材、決済帰着/Webhook/返金/精算/再試行は
基準Git blobを維持し、差分をpackage2ファイルと本資料に限定する。

この環境のNodeは24.19.0（プロジェクト/CI指定は22）。既定npm cacheと
Playwright cacheは書込不可のため、作業用cacheを /tmp に置く。
Chromium取得はCDNの403 Domain forbiddenで失敗。ローカルブラウザ試験は
追跡しない一時configで /usr/bin/chromium を指定し、既存試験を実行する。
本番サイトの直接HTTP取得もこの環境では403。READY照合は公開ページと画像の
実HTTP/表示検証の代わりではなく、PRのpreview・CIと区別して報告する。
本番への書込・実メール・決済試験は実施しない。

## 復元方法

コードの通常復元は本整理コミットを対象にした新しいrevert PRとする。
保護対象の最新案件やDBを古い状態へ戻さない。単独で依存を確認する場合:

```sh
git worktree add --detach ../me-ish-dependency-reference 4bec943c722e0d9c6257e855ec258bacfbc05379
git -C ../me-ish-dependency-reference sparse-checkout disable
```

特定ファイルの復元は新しい修正ブランチで package.json / package-lock.json の
両方を同じ基準から戻し、`npm ci`、型・lint・単体・ブラウザを再確認する。
単にpackage.jsonだけを戻したり、整理前srcを全上書きしない。
以前の削除ファイルは各archive manifestと固定SHAから別worktreeへ復元する。
DB停止のrollbackは `supabase/operations/legacy-service-stop/README.md` の別操作。

## 残りと判断が必要な対象

- 停止済み管理・マイページ・編集経路の追加整理は、既存公開/支払済み保存、口座・精算、Phase試験の依存をファイル単位で切り分ける。
- #133採否が決まるまでroot/Analytics整理を保留。#135を取り込まない。
- 既存AURA2件/CARD1件、ギャラリー、決済遅延・再送・返金・精算は維持。
- DB/Storage永久削除は保留。会話で報告された87画像+7空フォルダ管理=94件の保存・隔離復元は、この環境で現物を確認していない。別環境のパスを流用しない。
- Supabase権限・RLS・実Storage・アプリを含む復元試験は未完了。合成SQL gateやGit復元で代用しない。
- merge/本番反映は親への影響・検証報告と承認後。今回draft PRまで。
