# 整理の確認結果と残り（2026-10-09）

## 基準と今回の到達点

本番/mainは `4bec943c722e0d9c6257e855ec258bacfbc05379`（#141）。
Vercel `dpl_23zbE42S624NbGTwH1m8YGSbZzuj` のproduction/READYと公開domain割当を照合。
#139受付停止、#140旧作成フォーム削除、#141停止済みAPI内部削除の後続である。

- [draft PR #142](https://github.com/me-ish/me-ish-homepage/pull/142): 未使用フォーム・dropdown依存2件。
  保存済みhead `3317c31427f33910f232ab4fe46e8d62e4557a21`。このコード整理とは独立。
- [draft PR #143](https://github.com/me-ish/me-ish-homepage/pull/143): thirdweb型補助2件と設定、AURA/CARDの
  未参照helper8件、共通表示部品2件、その他のhelper/export入口6件、旧upload client1件、
  不要sanitizer依存、銀行ログインと受付画面のE2E待機を整理。削除ソースは計19件。
  適用単位をコミットで分け、最終head/CI/previewの結果はdraft PR本文に記録する。
- これで整理全体の完了とはしない。残りの判断条件は下記に列挙する。

## 保持対象

Natori/Etorieのsrc、全APIと全ページ、middleware、Stripe Webhook・決済戻り先・
返金・精算・再試行、既存AURA/CARD保存・公開処理、shared root/Analytics/fonts、
publicの全111追跡ファイル、Supabase全体、PhaseスクリプトとCIを基準と照合する。
今回の削除は到達可能な処理の置換ではなく、呼出元0のファイルに限定する。

公開描画の現役経路は以下を保持する。

| 対象 | 主な経路 |
| --- | --- |
| AURA公開 | p/u page → RendererRouter → renderer/v1 → AuraPortfolioRenderer → 現役sections |
| AURA Hero | AuraHeroSwitcher → AuraHeroMinimal |
| CARD公開/preview | CardRenderer、schema/db、QR/PDF、animation |
| 既存画像 | auraAssets.ts/cardAssets.ts、GET assets API、Storage上の本体 |
| 保存/認可 | save API、requireAuraAccess/requireCardAccess、auraBillingGate、legacyPublicationContinuation |
| gallery upload回帰 | entryUpload、entryUploadGrant、entryUploadService、実upload API、Phase0A |

## 検証結果の読み方

#142は最終コミットとCIのsynthetic merge `d004ce4c40b26d247fde398170dc713443bd10b5`
のGit treeが一致する。型・lint、210 files/1895 unit tests、通常E2E49 pass/2既存skipが成功。
auditは既知のbraces chain 9 highで失敗し、強制的なmajor更新は行わない。
追加Phase CI15件も成功。最終headのCIリンク・previewはPR本文で確認する。

旧デモ受付の初回ローカル失敗は原因未確定。再試行成功だけで成功扱いに置き換えない。
銀行→ログインの基準main失敗はcold compileが5秒assertionを超えた記録と遅延対照試験が
一致し、navigation待機に変更する。今回の画像容量失敗はtraceからJS読込前のイベント取り逃しと
診断し、基準mainで3秒遅延の対照試験を行って受付のload待機を修正した。
これで過去のNext→review失敗まで解明済みとは扱わない。詳細はarchive資料に記載。

localはNode24/system Chromium151、CIは指定Node22/Playwright Chromiumで区別する。
初回ローカルのnpm cache書込とChromium CDN取得失敗は環境設定/HTTP制限であり、
アプリ試験の結果に混ぜない。依存install後の試験結果を用いる。

## 親側で必要な公開GET確認

この実行環境から本番/previewの直接HTTPは403。通常Webコネクタも取得不可だった。
認証・保護設定を変更したり、一時bypass URLを発行して制限を回避していない。
親が既に許可された読み取り経路で確認できる場合、次を本番とPRのpreviewで照合する。

| URL / 対象 | 期待値 |
| --- | --- |
| https://www.me-ish.art/ | HTTP200、公開トップ |
| https://www.me-ish.art/natori/portfolio | HTTP200、掲載内容・画像・依頼導線 |
| https://www.me-ish.art/natori/works | HTTP200、作品と画像 |
| https://www.me-ish.art/natori/portfolio/contact | HTTP200、依頼画面表示のみ。送信しない |
| https://www.me-ish.art/api/natori/portfolio/content | HTTP200、公開JSONの内容/画像参照を整理前記録と比較 |
| https://www.me-ish.art/entry | galleryの日本語休止案内へ転送 |
| https://www.me-ish.art/en/aura/form | auraの英語休止案内へ転送 |
| https://www.me-ish.art/card/form | cardの日本語休止案内へ転送 |
| https://www.me-ish.art/api/aura/form/submit | GET503、service=aura、Cache-Control:no-store |
| https://www.me-ish.art/api/card/checkout | GET503、service=card、Cache-Control:no-store |
| https://www.me-ish.art/api/ai-guide | GET503、service=gallery、Cache-Control:no-store |
| 既存公開AURA2件/CARD1件 | 以前確認済みの正確なURLを使用。200、内容/画像維持 |
| 前回のナトリ画像12枚 | ページで参照される元画像URLの200、Content-Type/bytes/hashを比較 |

既存公開URLや画像の実値はこの環境で取得できておらず、仮のslugや別環境のsandbox pathを
代用しない。sitemapはCARDや一部無料AURAの一覧を保証しないので、公開3件の代替台帳にしない。
データは正常利用でも変化し得るため、API内容差分があれば変更時刻と対象項目を確認する。

## 残りの判断

| 残る対象 | 保留理由と次の条件 |
| --- | --- |
| AuraDegreeSlider/IntroOverlay/WorldviewSelector/HeroCentered | 実行参照はないがまとめて除くとTailwindの39 selectorが消える。AuraHeroMinimalは保存fontPreset文字列をclassとして通すため、既存公開データ/DOMの照合後に別単位 |
| galleryの孤立部品・旧home・CookieConsent | 公開表示・root/privacy(#133)と切り分け、生成CSSとブラウザを照合 |
| 旧画面/API/Server Action | 停止ガード、Phase0A、既存利用者の銀行/精算、支払済みsave/戻り先との対応を先に確定。呼出元を失ったentryUploadClientだけは今回除く |
| design/tokens.ts | index.ts削除後も22 selectorを生成するため保持。実行参照0だけで削除しない |
| separatorと残りの小部品 | 元の未参照候補41件中7件を今回整理。残りの分類は[台帳](archive/remaining-cleanup-20261009.md)を参照 |
| public画像・フォント・保存成果物 | DB由来の動的参照や手動利用がある。ファイル名検索だけで削除しない |
| root/Analytics・動画 | #133/#135の採否と競合処理は別担当の判断。勝手に取り込まない |
| DB/Storage永久削除 | 参照解消・保存判断・実復元未完了につき保留 |
| Supabase実復元 | 権限/RLS、全11bucket、本体、アプリの境界を含む隔離復元は別途承認・環境が必要 |
| 旧決済/返金/精算/再試行の終了 | 未完了決済、遅延Webhook、残高・再送義務を確認するまで保持 |
| braces | 既知のdev依存問題として保留。major更新を混ぜない |

会話上のStorage保存87画像+空フォルダ管理7件=94件は、今回現物を確認した結果ではない。
DB/画像の永久削除、秘密/権限/課金変更、実メール送信、本番書込試験は実施していない。

## 復元と反映判断

[今回のmanifestと復元手順](archive/unused-code-20261009.md)および各以前のarchiveを参照。
固定SHAから別worktreeへ復元し、Git blob/SHA256を照合する。依存はpackage/lockを対で扱い、
他PRの変更を維持する。通常のコードrollbackで本番DBを古いsnapshotへ巻き戻さない。
DB停止ポリシーのrollbackは `supabase/operations/legacy-service-stop/README.md` の別操作。

merge/本番反映は最終headの影響・検証結果と上記未確認事項を親へ報告し、承認後に行う。
