# 休止済み旧管理の書込処理と未使用UIの整理（2026-10-10）

旧ギャラリーの管理書込は、既存middlewareで503の休止応答になっている。
URLと応答を保ち、内部に残るDB更新・Storage操作・新Checkout・メール送信を退避する。
管理の読取、問い合わせ・精算、ナトリの管理機能を停止する変更ではない。

## 復元元

- 基準: `9d5dc72a68f24e45cc0f3588a91db3be78152bc2`（PR #150反映後）。
- 保存ブランチ: `archive/legacy-admin-before-20261010`。
- 原本台帳: [legacy-admin-20261010-manifest.tsv](legacy-admin-20261010-manifest.tsv)。
- 変更・削除する原本15ファイル79,056 bytesを固定SHAから別ディレクトリへ展開し、全件のGit blob・SHA-256・bytesを照合した。
- 通常の復旧はこのPRのrevert。旧TypeScriptを`_archive/`へ戻して型検査へ混入させない。

## 整理範囲

| 対象 | 整理内容 |
| --- | --- |
| POST `/admin/api/entries/[id]/approve` | 承認、画像copy、処理meta upload、所有者補完、処理job、Checkout・メール送信を退避 |
| POST `/admin/api/entries/[id]/reject`・`reset` | 旧審査状態の更新と却下通知を退避 |
| POST `/admin/api/entries/[id]/plan-checkout` | 新Checkout発行・決済待ち状態の書込を退避 |
| PATCH `/admin/api/entries/[id]` | 展示・販売状態の旧更新処理を退避 |
| POST `/admin/api/entries/sync-display-ready` | 画像処理後の展示有効化・期間・保証回数の書込を退避 |
| `admin/_components/SyncDisplayReadyButton.tsx`・`admin/users/AdminUsersClient.tsx` | importも固定ファイル読取もない未使用UI2ファイルを退避 |
| `lib/guarantee/capacity.ts` | 上記APIの退役で呼出元がなくなる専用helperを退避。`gallery/floatDailyPicker`は保持 |
| `lib/schemas/entry.ts` | 使用中の`EntryListQuery`を維持し、呼出元がなくなった更新・承認・却下・リセットのschemaだけ退避 |
| `tailwind.config.js` | 旧UIにだけ残る3クラスを互換safelistへ保持 |

コードパスは`src/app/`または`src/`配下。6 APIは既存の共通休止応答helperを呼び、
503・`Cache-Control: no-store`・`legacy_service_paused`・galleryの応答形式を保つ。
middlewareを経由せずhandlerを直接呼んでも、認可・入力・環境変数を読む前に休止する。
APIのruntime/dynamic/revalidate設定は元の宣言を保持する。新たな休止対象は追加しない。

3ファイルの削除は12,204 bytes・379行。退役前の6 API実装は797行。
全追跡JS/TSのAST import/re-export/import type/literal dynamic import/requireと
scripts・テスト・設定の非import参照を確認した。整理後は1,002ファイル、
未解決ローカルimportは0。非literal importは既存のlocale JSON読取だけ。

## 既存対応を残す境界

| 対応 | 保持するコード・理由 |
| --- | --- |
| 作品の一覧・状況照会 | `/admin/entries`、GET `/admin/api/entries`・`overview`、`EntryListQuery` |
| 出展者の読取・個別作品CSV | GET `/admin/api/users`、GET `/admin/api/users/[artist_name]/entries`、`/admin/users/[artist_name]`と専用UI |
| 問い合わせ対応・お知らせ | `/admin/inquiries`・`announcements`と各API。現役のcontact/newsも保持 |
| 売上・振込・通知 | `/admin/payouts`、`/api/admin/payouts/*`、精算cron、`adminAudit`、購入・精算メール |
| 購入済みの履行・返金・証明書 | Stripe Webhook、COA、既存購入後の処理。今回の新Checkout生成とは分けて保持 |
| ナトリ管理・公開・依頼受付 | Natori全体、認証callback、Etorieデモ、共通認可・接続・constantsを保持 |

`AdminEntriesClient`にも展示同期の呼出しがあるため、未使用ボタンを削除しても
APIのURLは残す。この呼出しはすでにmiddlewareで503になる。既存の読取とUIは変更しない。
3つの旧審査Server Actionも既存の休止ガードと型を維持する。
Phase T/0AのREADMEにある旧承認処理の記載は当時の監査記録として保持する。

**別件として保留:** 管理トップは`/admin/users`へリンクするが、対応する一覧`page.tsx`は
基準コミットにも存在しない。個別詳細ページは存在する。今回新たに生じる欠落ではない。
一覧復活・導線削除・休止案内のいずれにするかは、旧管理の運用方針として別途判断する。
未使用一覧UIの原本は保存ブランチから復元できる。

## 検証

- 生成CSSは基準と同じソース順・Tailwind/PostCSS/Autoprefixerで207,412 bytes、SHA-256 `7b83b5218bfd7ad87f1faf5132a3ec0878ad5bb8b781b47098d592117820dba4`に完全一致。配信minifyファイル自体の比較とは区別する。
- 既存のhandler直接試験へ6 API×正常/不正JSONの12ケースを追加。DB・Storage・認可・Stripe・メールの依存読込、ネットワーク通信、request本文読取が起きないことを検査する。
- 既存E2Eへ不足していた5経路を追加。localhost限定・ダミーSupabaseで実行し、503の既存契約を確認する。本番へPOST/PATCHを送らない。
- 型・Lint・通常CI、Preview、本番の公開内容と画像、未認証の管理読取API拒否を照合する。認証済み管理E2Eの既存2件skipは、実施済みと数えない。
- 専用Phaseの起動対象パス・スクリプト・条件は変更しない。既知のbraces Audit保留を継続する。

DB・RLS・Storage・画像・migration・package/lock・root/body/フォント・middleware・
課金設定・他Supabaseプロジェクトは変更しない。コードの原本復元は、DB/Storage全体の
機能復元確認とは別であり、永久削除の前提を満たしたものとは扱わない。
