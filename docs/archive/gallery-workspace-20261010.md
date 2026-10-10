# 休止済みギャラリー作業画面の整理（2026-10-10）

旧ギャラリーのマイページ、公開設定、展示プラン更新、所有者ひも付けは、
すでにmiddlewareで休止している。その内部処理を退避し、ページ単体でも
既存の休止案内へ移動するようにする。新たな公開終了や顧客対応の終了は含まない。

## 復元元

- 基準: `6a28e97bcc480fe01c006331b66ac28eac4fee41`（PR #148反映後）。
- 保存ブランチ: `archive/gallery-workspace-before-20261010`。
- 原本台帳: [gallery-workspace-20261010-manifest.tsv](gallery-workspace-20261010-manifest.tsv)。
- 変更・削除する原本19ファイル（164,512 bytes）を固定SHAからリポジトリ外へ展開し、全件のGit blob・SHA-256・bytesを照合した。
- 通常の復旧はこの変更をrevertするPR。調査用の旧TS本体を`_archive/`に戻さない。
- コードの復元確認はSupabaseの権限・所有者・Storage API・アプリ全体の機能復元確認とは別。

## 変更範囲

| 対象 | 変更 |
| --- | --- |
| `/mypage`、`/mypage/portfolio`、`/renew` | DB/Authや旧UIを初期化せず、localeに応じた既存ギャラリー休止案内へredirect |
| `/auth/link` | 旧外部IDの解析・Auth読取・entries所有者書込を除き、既存の休止案内へredirect |
| 旧mypage配下の専用部品・layout・loadingと`ProfileEditModal.tsx` | 呼出元が閉じた専用部品11ファイルを削除 |
| `src/lib/portfolio/queries.ts`・`types.ts` | 上記画面専用で、残す側からの参照がない2ファイルを削除。ナトリの`features/natori/lib/portfolio*`とは別 |
| `tailwind.config.js` | 削除するソースだけに残る82クラスを互換safelistへ保持 |
| `legacyGalleryPausedPages.test.ts` | middlewareを通さないページ単体の実行でもAuth/DBを初期化せず休止することを7ケース検査 |
| `e2e/mypage.spec.ts` | 既存2ケースの検査条件を維持し、3画面の日英6ケースへ拡張。ブラウザの全書込み・外部通信を遮断 |

削除は13ファイル、原本148,994 bytes・4,256行。追跡JS/TSの解析対象は1,029から
1,017ファイルとなり、未解決のローカルimportは0件だった（新規テスト1件を含む）。

マイページにはプロフィールの初回作成・更新、画像アップロード、旧公開設定、
同意・作品表示の変更、退会への導線があったが、入口はすでに休止済み。
今回、休止前の機能を動作させてデータを移す処理は行っていない。
`/auth/callback`はナトリの認証で使用する別経路なので、そのまま維持する。

## 保持する境界

- ナトリのポートフォリオ・依頼受付・編集・案件管理、Etorieデモと試験。
- 公開ギャラリー、作品・アーティスト表示、COA、既存購入・返金・精算、Stripe Webhook。
- `/login`、`/settings/bank`、問い合わせ、`/api/account/delete`とその回帰試験。
- 公開renderer、AURA/CARDの保存・画像読取、既存の公開終了ID判定。
- Supabase接続基盤、共有UI、middleware、root/body/フォント、package/lock、CI/Phaseスクリプト。
- DB・RLS・Storage・migration・画像・課金設定。他のSupabaseプロジェクト。

`scripts/natori-phase-0a/README.md`のProfileEditModal記載は当時の監査箇所を示す
歴史的記録として保持する。実行スクリプトからの固定読取・importはない。
`src/components/ui/radio-group.tsx`は今回以降呼出元がなくなるが、共有UIの整理へ範囲を広げない。

## 依存関係と表示の確認

追跡JS/TSのimport、re-export、import type、literal dynamic import/requireを
TypeScript ASTとmodule resolutionで照合した。削除候補の呼出元は今回の対象内だけ。
残す側のソース・scripts・テスト・設定の非import参照も確認した。
非literal importは既存のlocale JSON読取のみで、この整理では変更しない。

CSSはimportの有無とは別に生成されるため、削除前の全入力と比較した。
単純な削除では82 selectorが失われるので、その入力クラスをsafelistに保存した。
固定基準と変更後を同じソース順・Tailwind・PostCSS・Autoprefixerで生成すると、
207,412 bytes、SHA-256 `7b83b5218bfd7ad87f1faf5132a3ec0878ad5bb8b781b47098d592117820dba4`
でバイト単位に一致する。これは同条件で生成したCSSの比較であり、配信minifyファイルの比較ではない。

ローカルの型・Lint、休止に関する3ファイル130テストが成功。
通常CI、Preview、本番の検証結果はこの変更のPRと整理計画に記録する。
変更パスは専用Natori Phaseの起動対象外で、過去のPhase成功を今回再実施したとは扱わない。
既知のbraces Security Audit保留は継続し、CI全体成功と機能検査成功を区別する。
