# 停止済み書込みAPIの内部処理整理（2026-10-10）

基準: `4bec943c722e0d9c6257e855ec258bacfbc05379`（PR #141）。
保存ブランチ: `archive/legacy-write-api-before-20261010`。元ファイルのGit blob、SHA-256、
bytes、行数は同名manifestに記録。#142・#143の未使用コード整理とは独立した差分。

## 対象と保護境界

すべて既存middlewareが503で停止済みのPOST経路。各routeのHTTPメソッドと
runtime / dynamic / revalidate設定を維持し、内部処理を既存の休止応答に置き換える。
JSON本文のerror / message / service、HTTP503、Cache-Control:no-storeを維持する。

| 経路（`/api/`以下） | 除去する内部処理 |
| --- | --- |
| aura/draft、card/draft | 新規行と所有Cookieの発行 |
| aura/studio/draft | Studio新規下書きと所有Cookieの発行 |
| aura/studio/save/[id]、aura/studio/publish/[id] | 停止済みStudio編集・新規公開 |
| aura/upload/{avatar,works}/[id] | 旧作成画面からの画像変換・書込 |
| aura/studio/upload/{avatar,works}/[id] | 旧Studioからの画像変換・書込 |
| card/upload/{avatar,works}/[id] | 旧名刺作成画面からの画像変換・書込 |
| aura/request/[id]/email | 確定前メールアドレス変更 |
| card/public-slug | 停止済み名刺URL変更 |
| purchase/stripe | ギャラリー新規Checkoutと管理者購入処理 |

計14 URL、14 POST。画像ファイル、DB行、Cookieそのものは削除しない。
Studioの表示コードや共有Uploaderもこの変更で削除しない。

維持する経路: Natori / Etorie全体、AURA/CARD公開・preview、GET assets、GET request、
既存所有者のpaid / already-published save、AURAの既存公開slug管理、購入success/cancel、
Webhook / COA / 返金・精算、共通メール、認証・所有者判定、gallery entry uploadとPhase0A。
`card/public-slug`と`aura/public-slug`は既存停止方針が異なるため一括変更しない。
共有DBヘルパ・画像ライブラリ・型・middleware・root・CI・SQL・公開素材・依存は変更しない。

## 試験の移行

`legacyPausedApiHandlers.test.ts`へ14経路を追加。以前の17ハンドラと合わせ31ハンドラを
正常/不正JSONで直接呼び、middlewareの停止対象との一致、503/body/no-store、Cookie未発行、
SDK未読込・外部通信なし・本文未読取を検査する。

旧aura/draftの6ケースは「作成・入力エラー・Cookie発行・DB失敗」の現役前提を引退し、
CSRFヘッダなし、email欠落、型不正、旧クライアントの正常入力、既存Cookie、不正JSONの
6入力すべてで作成もCookie発行もしない停止仕様へ変更する。旧版はmanifestの元blobで保存。
共通CSRF・所有者判定と既存公開保存の検査は維持する。Natoriの検査を削除・緩和しない。

通常CIと公開GETの最終結果はPRと整理計画へ記録する。実顧客の送信・決済・メール・
本番書込による検査は行わない。DB/Storageの永久削除・実復元判断は別工程。

## 復元

対象PRのrevertを新しい変更として作成し、最新の他PRの変更を保持する。
元ファイルだけを確認する場合は、固定基準コミットを別のworktreeへ取り出してmanifestを照合する。
復元時はrouteと対応する試験を一緒に扱う。middlewareの停止方針を解除する変更ではない。
本番DBを過去のバックアップへ巻き戻さない。
