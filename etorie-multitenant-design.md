# エトリエ マルチテナント化 設計書（ドラフト）

作成: 2026-07-14 ／ 対象: natori スイート（コミッション受注管理）の一般化
前提: 主力プロダクト決定済み。着手条件は「2人目のユーザー候補が見えたとき」。
それまでは実装しない。この文書は着手時の指図書。

---

## 1. ゴールと非ゴール

**ゴール**: 現在ナトリ専用の受注管理スイート（依頼フォーム → 問い合わせ管理 →
見積もり/支払いメール → Stripe決済 → 案件管理 → 実績）を、me-ish アカウントを持つ
任意のクリエイターが自分のデータ・自分の入金先で使える状態にする。

**非ゴール**:
- VGen ページ（/natori）: ナトリ専用のまま。対象外
- ギャラリー / AURA / カード: 凍結中。触らない
- 高度な権限管理（チーム・複数スタッフ）: 単独クリエイター前提で開始

## 2. 現状の資産評価（何がすでにテナント対応か）

| 領域 | 現状 | 判定 |
|---|---|---|
| natori_projects / natori_project_tasks / natori_events / natori_user_profiles / natori_pricing_configs | `user_id` 列あり | ◎ ほぼそのまま使える |
| natori_portfolio_content / natori_links_content | 1行固定（id='main'） | △ per-user 行に変更必要 |
| natori_page_events | テナント列なし | △ user_id 追加必要 |
| 認可 | 合言葉キー or 全体admin（テナント概念なし） | ✕ 置き換え必要 |
| 書き込み帰属 | resolveNatoriActingUserId（env/既存データから所有者を推定） | ✕ ログインユーザー直結に置き換え |
| 決済 | me-ish 本体の Stripe に入金 | ✕ Stripe Connect 必須 |
| メール | 差出人・返信先・文面に「ナトリ」固定 | ✕ テナント設定化 |
| 公開URL | /natori/portfolio 等の固定パス | ✕ handle ベースに |

## 3. ナトリ固有値インベントリ（2026-07-14 時点の grep 結果）

ハードコード 45箇所 / 17ファイル。一般化時に `tenant_settings` へ寄せる。

| 種類 | 主な場所 | 一般化先 |
|---|---|---|
| 表示名「ナトリ」（メール署名・名乗り） | lib/orderMail.ts（artistName デフォルト）, server/portfolioContactService.ts（自動返信）, components/links/LinksLanding.tsx（名前・肩書き） | tenant_settings.display_name |
| 通知先メール natori.o0716@gmail.com | server/orderMailService.ts（REPLY_TO）, server/portfolioContactService.ts（TO） | tenant_settings.contact_email |
| SNS URL（natonato_o / booth natori0716） | constants/portfolioContent.ts, constants/linksContent.ts（いずれもDB初期値。DB側は編集可能なので実質問題なし） | 新規テナントの初期値を空にするだけ |
| プロフィール画像 /natori/IMG_3825.jpeg | components/links/LinksLanding.tsx | tenant_settings.avatar_url（またはlinks content に追加） |
| メール件名・本文の定型文 | lib/orderMail.ts, server/portfolioContactService.ts | 文面テンプレは共通のまま、名前・宛先だけ変数化（文面のテナント別カスタムは Phase 2 以降） |
| env: NATORI_DASHBOARD_KEY / NATORI_REQUIRE_AUTH / NATORI_STAFF_EMAILS / NATORI_OWNER_EMAILS / NATORI_OWNER_USER_ID / NATORI_PORTFOLIO_CONTACT_TO / NATORI_ORDER_MAIL_FROM | middleware.ts, server/requireNatoriAdmin.ts, server/natoriOwner.ts, メール系 | 認可置き換えで大半廃止。natori 互換モードとしてのみ残す |
| ルート /natori/*, /api/natori/* | app/[locale]/natori/*, app/api/natori/* | §7 参照（/u/[handle]/ 化 + /natori は alias 維持） |

※ `NATORI_PROJECT_TYPES` などの定数プレフィックスは名前だけの問題なので触らない
（rename は差分ノイズが大きい割に価値ゼロ。売り物になってから考える）。

## 4. データモデル

### 4.1 テナント = me-ish アカウント（auth.users.id）

新規テーブル `creator_settings`（名称は仮。natori_user_profiles を拡張する案でも可）:

```sql
create table creator_settings (
  user_id          uuid primary key references auth.users(id),
  handle           text unique not null,        -- 公開URL用 (例: natori)
  display_name     text not null,               -- メール署名・公開ページの名乗り
  contact_email    text not null,               -- 通知先 & 依頼者返信先
  stripe_account_id text,                       -- Connect (acct_xxx)。null = 未接続
  commission_open  boolean not null default true,
  onboarded_at     timestamptz,
  created_at       timestamptz not null default now()
);
```

判断メモ: `natori_user_profiles` に handle / display_name が既にあるので、
**新テーブルではなく natori_user_profiles への列追加が第一候補**。
分けるのは Connect 関連の秘匿度を上げたい場合のみ。

### 4.2 既存テーブルの変更

- `natori_portfolio_content` / `natori_links_content`:
  `id text primary key default 'main'` → `user_id uuid primary key`。
  既存 'main' 行はナトリの user_id に移行（1回きりのUPDATE）。
- `natori_page_events`: `user_id uuid` 追加（記録APIがテナントを引く）。
- その他の natori_* は変更なし（user_id あり）。

### 4.3 RLS

現在は「RLSポリシー無し = service role 専用」が基本。マルチテナント後も
**書き込みは API route（service role）経由を維持**し、API 側で
`ログインユーザー.id = 行.user_id` を強制するのが最小変更。
ブラウザ直読み（data/ 層の supabasePricing 等）だけ
`user_id = auth.uid()` の select ポリシーを付ける。

## 5. 認可の置き換え

現在: `canUseNatoriManagement()` = 合言葉Cookie or admin/スタッフメール or 全開放。

置き換え: `requireCreator()` = Supabase ログイン必須。`user.id` がそのまま tenant。
`resolveNatoriActingUserId()`（所有者推定）は廃止し、常にログインユーザーに帰属。

**未決事項（ナトリさんの「ログインしたくない」問題）**:
- 案A: マジックリンク（メールのリンクを踏むだけ。パスワード不要）← 推奨
- 案B: 合言葉キーをテナント別トークンに拡張（実装は簡単だが端末紛失時に弱い）
- 移行期は natori テナントに限り現行の合言葉モードを併存させる
  （requireCreator が合言葉Cookieを見たら natori の user_id として扱う）

## 6. Stripe Connect（お金の流れ・最重要）

- **Express アカウント**を採用。`stripe.accounts.create({ type: "express" })` →
  Account Link でオンボーディング（本人確認・口座登録は Stripe がホスト）。
- 支払いリンクは **connected account 上の direct charge** で発行:
  `stripe.paymentLinks.create({...}, { stripeAccount: acct_xxx })`
  → 決済は各クリエイターの Stripe 残高へ直接入金。me-ish は資金を預からない
  （資金移動業の論点を回避）。
- 手数料を取る場合は `application_fee_amount`。**初期は取らない**（月額課金で回収）。
- Webhook: connected accounts のイベントは **Connect webhook エンドポイント**
  （`event.account` が付く）で受ける。既存 `/api/webhook/stripe` とは別に
  `/api/webhook/stripe-connect` を新設し、`event.account` → creator_settings 逆引き →
  markNatoriCommissionPaid 相当を呼ぶ。metadata（kind / projectId）は現行と同じ。
- me-ish 自身への月額課金は既存アカウントの Stripe Billing（Checkout + Customer Portal）。

## 7. 公開URLとルーティング

- 公開ページ: `/u/[handle]/portfolio`, `/u/[handle]/links`（+依頼フォームAPI）
- 管理ページ: `/studio/*`（ログインユーザー自身のデータのみ。handle 不要）
  ※ 既存の /natori/dashboard 系は natori テナントの alias としてリダイレクト維持
- `/natori/portfolio` `/natori/links` は SEO・既存導線があるので
  **恒久 rewrite**（natori handle への内部書き換え）で温存する。

## 8. メールの一般化

- FROM: `{display_name}（me-ish） <noreply@me-ish.art>`（送信ドメインは共通。
  SPF/DKIM を一度整備すれば全テナントに効く）
- REPLY_TO / 通知先: `creator_settings.contact_email`
- 文面テンプレ（orderMail.ts / 自動返信）: artistName 引数は既にあるので、
  呼び出し側が display_name を渡すだけ。ハードコードのデフォルト「ナトリ」を排除。

## 9. 実装フェーズと見積もり

| フェーズ | 内容 | 目安 |
|---|---|---|
| P0 下地（互換維持） | creator_settings（or profiles拡張）+ content テーブルの per-user 化 + メール系の設定読み込み化。**natori 単独運用のまま出荷可能** | 3–5日 |
| P1 認可 | requireCreator 化・resolveNatoriActingUserId 廃止・合言葉は natori 互換のみ・/studio ルート | 3–5日 |
| P2 Connect | Express オンボーディング・direct charge 化・Connect webhook・課金(Billing) | 5–8日 |
| P3 公開URL | /u/[handle]/* + /natori rewrite + オンボーディングウィザード | 3–5日 |

合計 2〜4週間（人間の作業日換算。AI併用ならこの半分以下の見込み）。
P0 は今の運用を壊さないので、暇なときに先行して進めてよい唯一のフェーズ。

## 10. リスクと未決事項

1. **ログインなし運用との両立**（§5）。ナトリさんの合意が要る
2. **既存データの帰属**: natori_* の既存行の user_id が単一ユーザーに揃っているか
   要確認（resolveNatoriActingUserId の推定で書かれてきたため）
3. **Connect の審査・本人確認**: クリエイター側の手間。オンボーディング導線の
   途中離脱を前提に「Connect 未接続でも受注管理だけは使える」段階提供にする
4. 特商法・利用規約・プライバシーポリシー（コード外。P2 と同時進行）
5. natori_* というテーブル名・定数名は当面そのまま（rename しない判断。§3 注記）

## 11. これから書くコードへの指針（今日から有効）

- クリエイターの名前・メールアドレス・SNS URL を**新規コードにベタ書きしない**。
  デフォルト値が要る場合は constants の1箇所に集約し「テナント設定に移す」と
  コメントを残す
- 新規テーブルは必ず `user_id uuid not null` を持たせる
- 認可判定は `canUseNatoriManagement()` を経由し続ける（P1 で一点差し替えできる）
