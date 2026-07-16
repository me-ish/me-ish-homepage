# エトリエ マルチテナント化 設計書（ドラフト）

作成: 2026-07-14 ／ 更新: 2026-07-17（レビュー指摘の反映: テナントモデル見直し・
P1 工数修正・メール/Connect/公開エンドポイントの穴を追記）
対象: natori スイート（コミッション受注管理）の一般化
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
| natori_portfolio_content / natori_links_content | 1行固定（id='main'） | △ per-tenant 行に変更必要 |
| natori_page_events | テナント列なし | △ tenant_id 追加必要（+保持期間 §7.1） |
| 認可 | 合言葉キー or admin/スタッフメール（2026-07 に deny-by-default 化済み。テナント概念はなし） | ✕ 置き換え必要 |
| 書き込み帰属 | resolveNatoriActingUserId（env/既存データから所有者を推定） | ✕ ログインユーザー直結に置き換え |
| 決済 | me-ish 本体の Stripe に入金 | ✕ Stripe Connect 必須 |
| メール | 差出人・返信先・文面に「ナトリ」固定 | ✕ テナント設定化 |
| 公開URL | /natori/portfolio 等の固定パス | ✕ handle ベースに |

## 3. ナトリ固有値インベントリ（2026-07-14 時点の grep 結果）

ハードコード 45箇所 / 17ファイル。一般化時に `tenants`（§4.1）へ寄せる。
（表中の `tenant_settings.*` は旧名。読み替え先は `tenants.*`）

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

### 4.1 テナントモデル: tenants + tenant_members（auth.users.id 直結はやめる）

**2026-07-17 見直し**: 当初案の「tenant = auth.users.id」は、チーム利用・
アカウント譲渡・法人化のどれか1つでも起きた瞬間に全テーブルの主キー的な
前提が崩れる。テナントを人ではなく「事業体」として最初から分離する:

```sql
create table tenants (
  id               uuid primary key default gen_random_uuid(),
  handle           text unique not null,        -- 公開URL用 (例: natori)。§7.2 の rename 注意
  display_name     text not null,               -- メール署名・公開ページの名乗り
  contact_email    text not null,               -- 通知先 & 依頼者返信先（§8: 検証必須）
  contact_email_verified_at timestamptz,        -- null = 未検証（送信に使わない）
  stripe_account_id text,                       -- Connect (acct_xxx)。null = 未接続
  -- Connect アカウント状態のキャッシュ（§6。account.updated で同期）
  stripe_charges_enabled  boolean not null default false,
  stripe_payouts_enabled  boolean not null default false,
  stripe_details_submitted boolean not null default false,
  commission_open  boolean not null default true,
  onboarded_at     timestamptz,
  created_at       timestamptz not null default now()
);

create table tenant_members (
  tenant_id  uuid not null references tenants(id),
  user_id    uuid not null references auth.users(id),
  role       text not null default 'owner',     -- 当面 'owner' のみ
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
```

- **個人運営は tenant 1 : owner 1 で開始**する。UI・課金・権限はすべて
  「1人1テナント」を前提にしてよいが、データモデルだけは上記の形にしておく
  （チーム・譲渡・法人化が来たときの差分が tenant_members への行追加で済む）。
- 既存 natori_* テーブルの `user_id` 列は、**将来 `tenant_id` に寄せる**。
  移行手順: ナトリの tenant 行を1つ作る → `tenant_members(tenant, natoriのuser)` を
  挿入 → 各テーブルに `tenant_id` を追加して user_id から埋める → 参照を
  切り替え後に user_id 列を落とす。P0〜P1 の間は `user_id = owner の user_id`
  という不変条件が成り立つので段階移行できる。
- 認可の基本形は「`auth.uid()` が tenant_members にいる tenant のデータだけ
  触れる」。RLS も同じ述語で書ける（§4.3）。

旧案の `creator_settings`（user_id 主キー）は破棄。`natori_user_profiles` への
列追加案も、テーブルの主語が user から tenant に変わるため不採用とし、
tenants テーブルを正とする。

### 4.2 既存テーブルの変更

- `natori_portfolio_content` / `natori_links_content`:
  `id text primary key default 'main'` → `tenant_id uuid primary key`。
  既存 'main' 行はナトリの tenant_id に移行（1回きりのUPDATE）。
- `natori_page_events`: `tenant_id uuid` 追加（記録APIがテナントを引く）。
  あわせて保持期間・行数上限を入れる（§7.1）。
- `natori_order_mail_logs` / `processed_stripe_events`（2026-07 追加済み）:
  mail_logs は `tenant_id` 追加。processed_stripe_events はテナント非依存の
  まま（event.id はグローバルに一意）。
- その他の natori_* は `user_id` あり → §4.1 の手順で `tenant_id` に段階移行。

### 4.3 RLS

現在は「RLSポリシー無し = service role 専用」が基本。マルチテナント後も
**書き込みは API route（service role）経由を維持**し、API 側で
「ログインユーザーが tenant_members にいる tenant の行」だけを触れるよう
強制するのが最小変更。ブラウザ直読み（data/ 層の supabasePricing 等）だけ
`tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())`
の select ポリシーを付ける。

## 5. 認可の置き換え

現在: `canUseNatoriManagement()` = 合言葉Cookie（HMACトークン） or
admin/スタッフメール。2026-07 に deny-by-default 化済み（env 未設定で全開放は解消）。

置き換え: `requireTenant()` = Supabase ログイン必須。`tenant_members` から
ログインユーザーの tenant を解決して返す。
`resolveNatoriActingUserId()`（所有者推定）は廃止し、常にログインユーザーの
tenant に帰属。

**工数の実態（2026-07-17 修正）**: 従来この節は「§11 の指針どおり
canUseNatoriManagement() を経由していれば P1 で一点差し替えできる」と読める
書き方だったが、それは誤り。

- `canUseNatoriManagement()` は **boolean を返すだけでテナントを返さない**。
  差し替え先の `requireTenant()` は tenant を返す関数になるので、
  全呼び出し箇所（ページ・API 十数箇所）のシグネチャと後続処理が変わる。
- さらに server 層（projectsService / orderMailService / portfolioSiteService /
  eventsService 等）の **ほぼ全クエリが user_id 無フィルタ**（単一テナント前提で
  `.eq("id", projectId)` のように行 ID だけで引いている）。P1 の実体は
  「全 service 関数に tenant を引数で通し、全クエリに `.eq("tenant_id", ...)` を
  足す横断改修」+ **テナント越境アクセスの回帰テスト**（A の管理者が B の
  projectId を叩いても 404 になることをルート単位で固定する）。
- よって P1 は「一点差し替え」ではなく全 service の署名変更を伴う。§9 の
  見積もりを上方修正した。

**未決事項（ナトリさんの「ログインしたくない」問題）**:
- 案A: マジックリンク（メールのリンクを踏むだけ。パスワード不要）← 推奨
- 案B: 合言葉キーをテナント別トークンに拡張（実装は簡単だが端末紛失時に弱い）
- 移行期は natori テナントに限り現行の合言葉モードを併存させる
  （requireTenant が合言葉Cookieを見たら natori の tenant として扱う）

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
  `/api/webhook/stripe-connect` を新設し、`event.account` → tenants 逆引き →
  markNatoriCommissionPaid 相当を呼ぶ。metadata（kind / projectId）は現行と同じ。
- me-ish 自身への月額課金は既存アカウントの Stripe Billing（Checkout + Customer Portal）。

**異常系・アカウント状態（2026-07-17 追記。上記は happy path のみだった）**:

- **アカウント状態のキャッシュとゲート**: `charges_enabled` /
  `details_submitted` / `payouts_enabled` / `requirements.currently_due` を
  tenants にキャッシュし（§4.1 の stripe_* 列）、`account.updated` webhook で
  同期する。**`charges_enabled = false`（本人確認未完了・要件不備）の間は
  支払いリンクの生成をブロック**し、管理画面に「Stripe の本人確認を完了して
  ください」を出す。ここを塞がないと、決済できないリンクを依頼者に送る事故や、
  受け取れない入金が宙に浮く事故になる。
- **refund / dispute**: `charge.refunded` / `charge.dispute.created` を受けて
  案件に警告 note + テナント通知メールを出す（ステータスの自動巻き戻しは
  しない。§遷移表の「制作工程は自動で戻さない」と同じ思想で、人が判断する）。
- **Connect webhook 側の event dedup**: 本体 webhook で導入済みの
  `processed_stripe_events`（insert ... on conflict do nothing）と同じ仕組みを
  Connect エンドポイントにも必ず入れる。event.id 空間はエンドポイント毎に
  独立なので、同じテーブルに `event_id` を入れるだけでよい。
- **Payment Link → Checkout Session への乗り換え検討**: 現行の Payment Link は
  有効期限を持てず（active フラグの手動無効化のみ）、metadata・金額・顧客の
  固定も間接的。Checkout Session なら `expires_at`（最長24h）・`customer_email`
  固定・session 単位の金額固定が直接できるので、タスク2で入れた
  「旧リンク無効化 + 金額照合」の仕組みが大幅に簡素化する。マルチテナント化の
  タイミングで direct charge の Checkout Session に寄せる方向で再評価する
  （メールのリンク有効期限が24hで足りるかだけ運用確認が必要）。

## 7. 公開URLとルーティング

- 公開ページ: `/u/[handle]/portfolio`, `/u/[handle]/links`（+依頼フォームAPI）
- 管理ページ: `/studio/*`（ログインユーザー自身のデータのみ。handle 不要）
  ※ 既存の /natori/dashboard 系は natori テナントの alias としてリダイレクト維持
- `/natori/portfolio` `/natori/links` は SEO・既存導線があるので
  **恒久 rewrite**（natori handle への内部書き換え）で温存する。

### 7.1 公開エンドポイントの多テナント課題（2026-07-17 追記）

- **handle → tenant 解決**: 公開ページ・依頼フォームAPI・track API はすべて
  リクエストの handle から tenant を解決する層を通す（存在しない handle は 404、
  `commission_open = false` はフォーム閉鎖表示）。解決結果は短TTLでキャッシュ
  してよいが、キーは handle ではなく tenant_id で持つ（rename 対応。§7.2）。
- **handle 予約語**: `admin` / `api` / `studio` / `natori` / `me-ish` / `u` /
  `login` / `signup` / `webhook` / `mail` / `support` / `stripe` 等を予約語リスト
  として弾く（ルーティング衝突と成りすましの両方の対策）。allowlist 形式の
  バリデーション（小文字英数とハイフン、3〜30文字）もここで固定する。
- **テナント別レート制限**: 現行の IP 単位に加えて
  `key = "{route}:{tenant_id}:{ip}"` の形にする。1テナントの炎上（フォーム爆撃）が
  他テナントの上限を食い潰さないこと、逆に攻撃者が複数テナントを回して
  総量制限を回避できないことの両方を見る。ストアは差し替え可能化済み
  （src/lib/rateLimit.ts の RateLimitStore）なので、マルチテナント化と同時に
  外部ストア（Upstash 等）へ移すのが前提（in-memory はインスタンス毎で緩む）。
- **page_events の保持期間・上限**: `natori_page_events` は現状**無限成長**
  （クリック計測が全部溜まる）。テナント数×トラフィックで爆発するので、
  保持期間（例: 90日で削除する定期ジョブ）と、テナント別の日次行数上限
  （超過分は記録せず捨てる）を入れる。集計値が要るなら日次ロールアップ
  テーブルに畳んでから消す。
- **公開バケットのテナント分離とクォータ**: 添付画像・掲載画像はパスを
  `{tenant_id}/...` で分離し、テナント別の総容量クォータ（例: 1GB）を敷く。
  解約テナントの後片付け（§10）もパス prefix 単位で消せる形にしておく。

### 7.2 handle rename の扱い

内部キーは必ず tenant_id（不変）で持ち、handle は表示・URL 専用にする。
rename を許すなら波及先を列挙して設計してから:

- 公開URL: 旧 handle からの 301（旧 handle は一定期間予約して再取得を防ぐ）
- メール本文: 過去に送った見積もり・支払いメール内のURLは書き換えられない
  → URL に handle を含めない（/r/[token] 形式）か、旧 handle rewrite で受ける
- Stripe metadata: kind / projectId のみ（handle を入れない）を徹底
- 初期リリースでは **rename 不可（サポート経由のみ）** で出すのが安全。

## 8. メールの一般化

- FROM: `{display_name}（me-ish） <noreply@me-ish.art>`（送信ドメインは共通。
  SPF/DKIM を一度整備すれば全テナントに効く）
- REPLY_TO / 通知先: `tenants.contact_email`
- 文面テンプレ（orderMail.ts / 自動返信）: artistName 引数は既にあるので、
  呼び出し側が display_name を渡すだけ。ハードコードのデフォルト「ナトリ」を排除。

**必須要件（2026-07-17 追記。ここを飛ばすと踏み台になる）**:

- **display_name の成りすまし対策**: FROM の表示名にテナントの自由入力が
  入るため、`Stripeサポート` `me-ish運営` `Amazon` のような名乗りで
  me-ish.art の正規ドメイン・正規 DKIM 署名つきフィッシングメールを
  送れてしまう。対策を必須要件にする:
  - display_name のバリデーション（禁止語リスト: stripe / me-ish / 運営 /
    サポート / 事務局 / amazon 等の主要ブランド。完全一致でなく部分一致）
  - FROM 表示名はテンプレ側で `{display_name}（me-ish） via etorie` のように
    サービス由来が消せない形に固定し、display_name 単独を FROM にしない
  - 新規テナントの初回送信前に人間の目を通す（オンボーディング承認制）か、
    登録直後のテナントの送信数を絞る
- **contact_email の検証必須**: 未検証のメールアドレスを REPLY_TO / 通知先に
  使うと、他人のアドレスを登録して依頼フォーム経由でスパムを送りつける
  踏み台になる（確認メール爆撃・返信誘導）。`contact_email_verified_at`
  （§4.1）が null のうちは送信系を一切動かさない。検証はトークン付きリンクの
  定番方式でよい。
- 送信ログ（natori_order_mail_logs 相当）は tenant_id を持たせ、テナント別の
  日次送信上限（例: 100通）を敷く。異常な送信量はスパム踏み台のシグナル。

## 9. 実装フェーズと見積もり

| フェーズ | 内容 | 目安 |
|---|---|---|
| P0 下地（互換維持） | tenants + tenant_members 導入・content テーブルの per-tenant 化・メール系の設定読み込み化・contact_email 検証。**natori 単独運用のまま出荷可能** | 4–6日 |
| P1 認可 + テナント分離 | requireTenant 化・resolveNatoriActingUserId 廃止・合言葉は natori 互換のみ・/studio ルート。**全 service 関数に tenant を通し全クエリに tenant フィルタを足す横断改修 + 越境アクセス回帰テスト**（§5 参照。「一点差し替え」ではない） | 6–10日 |
| P2 Connect | Express オンボーディング・direct charge 化（Checkout Session への乗り換え検討込み）・Connect webhook（dedup 込み）・アカウント状態ゲート・refund/dispute 通知・課金(Billing) | 7–10日 |
| P3 公開URL | /u/[handle]/* + handle 予約語/バリデーション + /natori rewrite + テナント別レート制限 + オンボーディングウィザード | 4–6日 |

合計 3〜5週間（人間の作業日換算。AI併用ならこの半分以下の見込み）。
※ 2026-07-17: P1 を「一点差し替え」前提の 3–5日 から上方修正（§5）。
P0 は今の運用を壊さないので、暇なときに先行して進めてよい唯一のフェーズ。

## 10. リスクと未決事項

1. **ログインなし運用との両立**（§5）。ナトリさんの合意が要る
2. **既存データの帰属**: natori_* の既存行の user_id が単一ユーザーに揃っているか
   要確認（resolveNatoriActingUserId の推定で書かれてきたため）
3. **Connect の審査・本人確認**: クリエイター側の手間。オンボーディング導線の
   途中離脱を前提に「Connect 未接続でも受注管理だけは使える」段階提供にする
   （ただし §6 のとおり、charges_enabled になるまで支払いリンクは発行させない）
4. 特商法・利用規約・プライバシーポリシー（コード外。P2 と同時進行）
5. natori_* というテーブル名・定数名は当面そのまま（rename しない判断。§3 注記）
6. **解約時のデータ扱い**（2026-07-17 追記）: 解約後の公開ページは即 404 に
   するか猶予期間を置くか、案件・送信ログ・画像の保持期間（例: 90日後に削除、
   本人へのエクスポート提供）、Stripe Connect アカウントの接続解除
   （accounts.reject はしない。deauthorize のみ）を利用規約とセットで決める。
   ストレージは §7.1 のとおり tenant_id prefix で消せる構造にしておく。
7. **GET の副作用の解消**（レビュー指摘・現行コードの宿題）:
   `listNatoriAdminProjects`（GET /api/natori/admin/projects）がタスク正規化で
   DB を upsert/delete している。GET の副作用 + 暗黙のタスク削除は事故のもと
   なので、マルチテナント化の P0〜P1 のどこかで、正規化を migration として
   一度流すか、明示的な同期エンドポイント（POST）に分離する。

## 11. これから書くコードへの指針（今日から有効）

- クリエイターの名前・メールアドレス・SNS URL を**新規コードにベタ書きしない**。
  デフォルト値が要る場合は constants の1箇所に集約し「テナント設定に移す」と
  コメントを残す
- 新規テーブルは必ず帰属列（当面 `user_id uuid not null`。将来 tenant_id に
  移行しやすいよう「所有者1列」で持つ）を付ける
- 認可判定は `canUseNatoriManagement()` を経由し続ける。ただしこれは
  「入口を散らさない」ためであって P1 が一点差し替えで済む意味ではない
  （§5 の工数注記参照）。**新規の service 関数はクエリに帰属フィルタ
  （`.eq("user_id", ...)`）を最初から入れておく**と P1 の横断改修が軽くなる
