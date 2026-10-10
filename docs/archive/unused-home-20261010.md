# 未使用の旧トップページ部品の整理（2026-10-10）

現在のトップページは`src/app/[locale]/(marketing)/page.tsx`の休止案内で、
旧`DesktopHome`・`MobileHome`を読み込まない。両部品と専用依存を保全して退避する。
トップページの文言やデザイン、公開範囲を変更する作業ではない。

## 復元元

- 基準: `117c34b76ad8876c075fd956d7fb1bac174af433`（PR #149反映後）。
- 保存ブランチ: `archive/unused-home-before-20261010`。
- 原本台帳: [unused-home-20261010-manifest.tsv](unused-home-20261010-manifest.tsv)。
- 削除12ファイルは87,372 bytes・2,477行。変更前の設定・既存資料も含む15ファイル110,208 bytesを固定SHAからリポジトリ外へ展開し、全件のGit blob・SHA-256・bytesを照合した。
- 通常の復旧はこのPRのrevert。旧TypeScript本体を`_archive/`へ入れず、型検査への混入を避ける。

## 対象と保持する境界

| 対象 | 判断 |
| --- | --- |
| `components/DesktopHome.tsx`・`MobileHome.tsx` | 呼出元0の旧トップ本体を退避 |
| `components/home/`の4ファイル | 旧トップ専用のFAQ・問い合わせ案内・お知らせ表示と未使用FAQ定数を退避 |
| `components/shared/BackToTop.tsx`・`FloatingBubbles.tsx`・`SectionHeader.tsx` | sharedという名前でも実際の呼出元は上記のみ。専用依存として退避 |
| `hooks/useAnnouncements.ts`・`useHomePageData.ts`、`types/announcement.ts` | 上記専用の読取フックと型を退避。DBのview・RPC・テーブルは維持 |
| `tailwind.config.js` | ソース削除で失われる111クラスを互換safelistへ保持 |

パスはすべて`src/`配下。追跡JS/TS 1,017ファイルのimport/re-export/import type/
literal dynamic import/requireをTypeScript ASTとmodule resolutionで照合した。
対象への外部呼出元は0。残す側のscripts・テスト・設定の非import参照も確認した。
唯一の非literal importは既存のlocale JSON読取であり、対象の動的読込はない。
整理後は1,005ファイル、未解決のローカルimportは0件。

次を保持する。

- 現在のトップページ・marketing layout、root/body/フォント、Analyticsと同意・privacy関連。
- ナトリ全体、Etorieデモ、共有UI、Supabase接続、galleryUtils、i18nと翻訳データ。
- `/news`、`/contact`、`/footer/*`の実ページ。専用ContactSection内の古いリンク表示を除くことは、問い合わせ・法的表示の終了を意味しない。
- 公開ギャラリー、既存購入・返金・精算・COA・Stripe Webhook。
- 画像、DB・RLS・Storage・migration、package/lock、CI/Phaseスクリプト。

## 表示と検証

importされないファイルもTailwindの入力になる。単純な削除では113 CSS rule
（111クラスと関連keyframes）が失われるため、互換safelistで生成結果を保持した。
基準と変更後を同じソース順・Tailwind・PostCSS・Autoprefixerで生成し、
207,412 bytes、SHA-256 `7b83b5218bfd7ad87f1faf5132a3ec0878ad5bb8b781b47098d592117820dba4`
でバイト単位に一致する。配信minifyファイルそのものの比較とは区別する。
未使用コンポーネント内のstyled-jsxはもともと現行ページにマウントされない。

既存のホームE2Eを含む通常CIと、Preview・本番のトップ、ナトリ公開内容・画像を
照合する。結果はPRと整理計画へ記録する。専用Phaseの起動対象パスは変更しない。
既知のbraces Audit保留を継続し、新規の検査失敗と区別する。
コードの復元確認は、DB・Storage全体の機能復元確認とは別。
