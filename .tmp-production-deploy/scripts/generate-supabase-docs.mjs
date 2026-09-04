import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCHEMA_PATH = path.join(ROOT, 'src', 'types', 'supabase.ts');
const DOCS_DIR = path.join(ROOT, 'docs');
const OUT_MD = path.join(DOCS_DIR, 'supabase-tables-ja.md');
const OUT_CSV = path.join(DOCS_DIR, 'supabase-columns-ja.csv');

const TABLE_ROLE_OVERRIDES = {
  admin_emails: '管理者メールの許可リスト',
  announcements: 'サイトのお知らせ管理',
  artists_bank_accounts: '作家の振込先口座情報',
  aura_first20_redemptions: 'AURAの初期特典利用履歴',
  aura_meish_free_claims: 'AURA→ME-ISH無料付与の利用記録',
  aura_promo_counters: 'プロモーション上限のカウンタ管理',
  aura_requests: 'AURA生成リクエスト本体',
  cert_links: '証明書ダウンロードリンク管理',
  entries: '作品エントリー本体（審査・展示・販売・精算）',
  entry_processing_jobs: '作品処理の非同期ジョブ管理',
  entry_view_events: '作品閲覧イベントログ',
  inquiries: '問い合わせ管理',
  likes: 'いいね履歴',
  payout_batches: '支払バッチ（月次締め）',
  payout_items: '支払バッチ内の明細紐付け',
  payouts: '作家ごとの支払管理',
  portfolio_settings: 'ポートフォリオ公開設定',
  profiles: 'ユーザープロフィール',
  sales: '購入・売上トランザクション',
  special_thanks: 'Special Thanks表示管理',
};

const COLUMN_DESC_OVERRIDES = {
  entries: {
    ai_usage: 'AI利用状況',
    ai_usage_note: 'AI利用状況の補足',
    ai_usage_scope: 'AI利用範囲',
    artist_reward_yen: '作家取り分（円）',
    confirmed: '審査承認フラグ',
    confirmed_at: '承認日時',
    display_ready: '展示可能フラグ',
    display_plan: '展示プラン',
    display_start_at: '展示開始日時',
    display_end_at: '展示終了日時',
    edition_mode: 'エディション販売モード',
    edition_total: '総エディション数',
    edition_sold: '販売済みエディション数',
    edition_remaining: '残エディション数',
    ending_soon_notified_at: '終了間近通知送信日時',
    force_wm: '強制ウォーターマーク適用フラグ',
    has_signature: '署名有無フラグ',
    is_for_sale: '販売対象フラグ',
    is_paid_to_artist: '作家支払済みフラグ',
    is_sold: '売約済みフラグ',
    meish_fee_yen: 'プラットフォーム手数料（円）',
    plan_payment_status: '展示プラン決済状態',
    plan_payment_session_id: '展示プラン決済セッションID',
    plan_payment_paid_at: '展示プラン決済完了日時',
    plan_payment_amount_yen: '展示プラン決済額（円）',
    plan_payment_checkout_created_at: '展示プランCheckout作成日時',
    portfolio_hidden: 'ポートフォリオ非表示フラグ',
    reject_reason: '審査却下理由',
    reject_email_sent_at: '却下通知送信日時',
    rejected_at: '却下日時',
    sale_type: '販売方式',
    sns_links: 'SNSリンク（JSON文字列）',
    sold_out_calc: '売切れ判定の計算結果',
  },
  sales: {
    payout_batch_id: '支払バッチID',
    close_batch_id: '締めバッチID',
    payout_status: '支払処理ステータス',
    stripe_session_id: 'Stripe CheckoutセッションID',
    purchased_at: '購入日時',
    paid_at: '決済完了日時',
  },
};

const GENERIC_COLUMN_DESC = {
  id: '主キーID',
  user_id: 'ユーザーID',
  entry_id: '作品エントリーID',
  request_id: 'リクエストID',
  email: 'メールアドレス',
  title: 'タイトル',
  description: '説明',
  content: '内容（JSON）',
  payload: '入力データ（JSON）',
  design: 'デザイン設定（JSON）',
  status: 'ステータス',
  visibility: '公開範囲',
  slug: 'スラッグ',
  public_id: '公開用ID',
  public_slug: '公開用スラッグ',
  session_token: 'セッショントークン',
  session_id: 'セッションID',
  token_id: 'トークンID',
  image_url: '画像URL',
  file_name: 'ファイル名',
  type: '種別',
  category: 'カテゴリ',
  metadata: 'メタデータ（JSON）',
  price: '価格',
  amount_yen: '金額（円）',
  paid_at: '支払完了日時',
  created_at: '作成日時',
  updated_at: '更新日時',
  published_at: '公開日時',
  expires_at: '有効期限',
  used_at: '使用日時',
  revoked: '無効化フラグ',
  key: '管理キー',
  limit_count: '上限数',
  pinned: '固定表示フラグ',
  body_md: '本文（Markdown）',
  link_url: 'リンクURL',
  name: '氏名',
  message: '本文メッセージ',
  is_read: '既読フラグ',
  likes: 'いいね数',
  note: '備考',
  period_ym: '対象年月（YYYY-MM）',
  scheduled_at: '予定日時',
  closed_at: '締め日時',
  total_amount_yen: '合計金額（円）',
  artist_count: '作家数',
  sale_count: '売上件数',
  avatar_url: 'アバター画像URL',
  banner_url: 'バナー画像URL',
  banner_focus_x: 'バナー焦点X',
  banner_focus_y: 'バナー焦点Y',
  banner_zoom: 'バナー拡大率',
  bio: '自己紹介',
  bio_short: '短い自己紹介',
  display_name: '表示名',
  public_display_name: '公開表示名',
  headline: '見出し',
  is_public: '公開フラグ',
  sort_key: '並び順キー',
  sort_order: '表示順',
  homepage_url: 'ホームページURL',
  twitter_url: 'X(Twitter) URL',
  instagram_url: 'Instagram URL',
  tagline: 'キャッチコピー',
  external_user_id: '外部ユーザーID',
  account_type: '口座種別',
  account_number: '口座番号',
  account_name_kana: '口座名義（カナ）',
  bank_code: '銀行コード',
  branch_code: '支店コード',
  buyer_email: '購入者メール',
  meish_fee_yen: '手数料（円）',
  artist_reward_yen: '作家取り分（円）',
  payment_status: '決済ステータス',
  renderer_version: 'レンダラー版本',
  error: 'エラー内容',
  token_hash: 'トークンハッシュ',
  works_filter: '作品フィルタ条件',
};

function readSupabaseSchema(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.toString('utf16le');
  }
  return buf.toString('utf8');
}

function parseTables(schemaText) {
  const lines = schemaText.split(/\r?\n/);
  const start = lines.findIndex((l) => l.includes('Tables: {'));
  const end = lines.findIndex((l, i) => i > start && l.includes('Views: {'));
  if (start < 0 || end < 0) throw new Error('Tables block not found in supabase.ts');

  const rows = lines.slice(start + 1, end);
  const tables = [];

  for (let i = 0; i < rows.length; i += 1) {
    const tm = rows[i].match(/^\s{6}([a-zA-Z0-9_]+):\s\{$/);
    if (!tm) continue;

    const tableName = tm[1];

    while (i < rows.length && !/^\s{8}Row:\s\{$/.test(rows[i])) i += 1;
    if (i >= rows.length) break;
    i += 1;

    const columns = [];
    while (i < rows.length && !/^\s{8}\}\s*$/.test(rows[i])) {
      const cm = rows[i].match(/^\s{10}([a-zA-Z0-9_]+):\s(.+)$/);
      if (cm) {
        const typeText = cm[2].trim();
        columns.push({
          name: cm[1],
          type: typeText,
          nullable: /\|\snull\b/.test(typeText),
        });
      }
      i += 1;
    }

    tables.push({ name: tableName, columns });
  }

  return tables;
}

function describeColumn(tableName, columnName) {
  const tableOverrides = COLUMN_DESC_OVERRIDES[tableName];
  if (tableOverrides && tableOverrides[columnName]) return tableOverrides[columnName];
  if (GENERIC_COLUMN_DESC[columnName]) return GENERIC_COLUMN_DESC[columnName];
  return `${columnName}（${tableName}）`;
}

function tableRole(tableName) {
  return TABLE_ROLE_OVERRIDES[tableName] ?? `${tableName}のデータ管理`;
}

function esc(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function generateMarkdown(tables) {
  const now = new Date().toISOString();
  const lines = [];
  lines.push('# Supabaseテーブル説明（public, 自動生成）');
  lines.push('');
  lines.push(`- 生成元: \`src/types/supabase.ts\``);
  lines.push(`- 生成日時: \`${now}\``);
  lines.push('');
  lines.push('## 一覧');
  lines.push('');
  lines.push('| テーブル | 役割 | カラム数 |');
  lines.push('|---|---|---:|');
  for (const t of tables) {
    lines.push(`| \`${t.name}\` | ${tableRole(t.name)} | ${t.columns.length} |`);
  }

  for (const t of tables) {
    lines.push('');
    lines.push(`## ${t.name}`);
    lines.push('');
    lines.push(`- 役割: ${tableRole(t.name)}`);
    lines.push('');
    lines.push('| カラム | TypeScript型 | NULL可 | 作用 |');
    lines.push('|---|---|---|---|');
    for (const c of t.columns) {
      lines.push(
        `| \`${c.name}\` | \`${c.type}\` | ${c.nullable ? 'YES' : 'NO'} | ${describeColumn(t.name, c.name)} |`
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

function generateCsv(tables) {
  const lines = [];
  lines.push('table,column,ts_type,nullable,table_role,column_description');
  for (const t of tables) {
    for (const c of t.columns) {
      lines.push(
        [
          esc(t.name),
          esc(c.name),
          esc(c.type),
          esc(c.nullable ? 'YES' : 'NO'),
          esc(tableRole(t.name)),
          esc(describeColumn(t.name, c.name)),
        ].join(',')
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const schemaText = readSupabaseSchema(SCHEMA_PATH);
  const tables = parseTables(schemaText);
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(OUT_MD, generateMarkdown(tables), 'utf8');
  fs.writeFileSync(OUT_CSV, generateCsv(tables), 'utf8');

  console.log(`Generated ${tables.length} tables.`);
  console.log(`- ${path.relative(ROOT, OUT_MD)}`);
  console.log(`- ${path.relative(ROOT, OUT_CSV)}`);
}

main();
