// --- /lib/emailTemplates/purchaseArtist.ts ---
export type PurchaseArtistEmailArgs = {
  name: string;                    // 宛名（必須）
  title?: string;                  // 作品名
  priceYen?: number | null;        // 税込価格
  editionNo?: number | null;       // 何番 (例: 2)
  editionTotal?: number | null;    // 総数 (例: 10)
  orderId?: string;                // 取引ID/注文番号
  salesType?: 'normal' | 'nft' | string;
  manageUrl?: string;              // 売上/作品の管理ページ
  faqUrl?: string;                 // 既定: /faq
  termsUrl?: string;               // 既定: /footer/terms
  supportEmail?: string;           // 既定: support@me-ish.art
  payoutEtaDays?: number;          // 入金目安（日）
  payoutAtISO?: string;            // 入金予定日時（わかっていれば）
  siteUrl?: string;                // 既定: NEXT_PUBLIC_SITE_URL
  note?: string;                   // 連絡事項（任意）
};

const BRAND_HEX = '#00a1e9';

export function generatePurchaseArtistEmail(arg: string | PurchaseArtistEmailArgs) {
  // 後方互換
  const a: PurchaseArtistEmailArgs =
    typeof arg === 'string' ? { name: arg } : arg;

  const {
    name,
    title,
    priceYen = null,
    editionNo = null,
    editionTotal = null,
    orderId,
    salesType = 'normal',
    manageUrl,
    faqUrl = 'https://me-ish.art/faq',
    termsUrl = 'https://me-ish.art/footer/terms',
    supportEmail = 'support@me-ish.art',
    payoutEtaDays = 7,
    payoutAtISO,
    siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://me-ish.art',
    note,
  } = a;

  const preheader =
    'あなたの作品が購入されました。報酬のご案内と管理ページへのリンクをお送りします。';

  const fmtYen = (n: number) => new Intl.NumberFormat('ja-JP').format(n);
  const payoutStr = payoutAtISO
    ? new Date(payoutAtISO).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    : `通常 ${payoutEtaDays} 日以内`;

  // テーブル行（条件で出し分け）
  const rows: string[] = [];
  if (title) rows.push(row('作品名', escapeHtml(title)));
  if (salesType) rows.push(row('販売形式', escapeHtml(salesType === 'nft' ? 'NFT販売' : '通常販売')));
  if (priceYen != null) rows.push(row('販売価格', `¥${fmtYen(priceYen)}`));
  if (editionNo != null || editionTotal != null)
    rows.push(row('エディション', `${editionNo ?? '-'} / ${editionTotal ?? '-'}`));
  if (orderId) rows.push(row('注文番号', escapeHtml(orderId)));

  const manageBtn = manageUrl
    ? `<a href="${sanitizeUrl(manageUrl)}"
         style="display:inline-block;padding:12px 18px;border-radius:10px;background:${BRAND_HEX};color:#fff;text-decoration:none;font-weight:700;">
         売上を確認する
       </a>`
    : '';

  const html = `
  <div style="background:#f7fafc;padding:24px 0;">
    <!-- preheader -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,Arial,sans-serif;color:#1f2937;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:18px;font-weight:700;color:${BRAND_HEX};">me-ish</div>
        <div style="font-size:12px;color:#9ca3af;">アートを、もっと近くに</div>
      </div>

      <p style="margin:0 0 12px 0;">${escapeHtml(name)} 様</p>
      <p style="margin:0 0 12px 0;">me-ish にご出展中の作品が<strong>購入されました</strong>。この度は誠にありがとうございます。</p>

      ${rows.length ? `<table style="width:100%;border-collapse:collapse;margin:16px 0 8px 0;">
        <tbody>${rows.join('')}</tbody></table>` : ''}

      <div style="margin:14px 0 0 0; padding:12px; background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px;">
        <div style="font-weight:700; margin-bottom:4px;">販売報酬について</div>
        <div style="font-size:14px; color:#334155; line-height:1.7;">
          入金予定：<b>${escapeHtml(payoutStr)}</b> を目安にお手続きいたします。<br/>
          進捗や明細は管理ページからご確認いただけます。
        </div>
      </div>

      ${manageUrl ? `<div style="margin:16px 0 0 0;">${manageBtn}</div>` : ''}

      ${note ? `<div style="margin-top:12px;font-size:14px;color:#334155;line-height:1.8;"><strong>ご連絡：</strong>${escapeHtml(note)}</div>` : ''}

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />

      <ul style="margin:0;padding-left:1em;font-size:13px; color:#6b7280; line-height:1.9;">
        <li>よくある質問：<a href="${sanitizeUrl(faqUrl)}" style="color:${BRAND_HEX};">FAQ</a></li>
        <li>ご利用規約：<a href="${sanitizeUrl(termsUrl)}" style="color:${BRAND_HEX};">利用規約</a></li>
        <li>お問い合わせ：<a href="mailto:${escapeHtml(supportEmail)}" style="color:${BRAND_HEX};">${escapeHtml(supportEmail)}</a></li>
      </ul>

      <p style="margin-top:24px;font-size:12px;color:#6b7280;">本メールは送信専用です。ご返信いただいても対応できませんのでご了承ください。</p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">© me-ish運営事務局</p>
    </div>
  </div>`;

  const textLines: string[] = [];
  textLines.push(`${name} 様\n`);
  textLines.push('me-ish にご出展中の作品が購入されました。ありがとうございます。\n');
  if (title) textLines.push(`作品名：${title}`);
  if (salesType) textLines.push(`販売形式：${salesType === 'nft' ? 'NFT販売' : '通常販売'}`);
  if (priceYen != null) textLines.push(`販売価格：¥${fmtYen(priceYen)}`);
  if (editionNo != null || editionTotal != null) textLines.push(`エディション：${editionNo ?? '-'} / ${editionTotal ?? '-'}`);
  if (orderId) textLines.push(`注文番号：${orderId}`);
  textLines.push(`\n[販売報酬]\n入金予定：${payoutStr}`);
  if (manageUrl) textLines.push(`売上を確認する：${manageUrl}`);
  if (note) textLines.push(`\n[ご連絡]\n${note}`);
  textLines.push(`\nFAQ：${faqUrl}\n利用規約：${termsUrl}\nお問い合わせ：${supportEmail}\n\n※本メールは送信専用です。`);

  return {
    subject: '【me-ish】あなたの作品が購入されました',
    html,
    text: textLines.join('\n'),
  };
}

/* ----- utils ----- */
function row(label: string, value: string) {
  const tdL = 'width:50%;padding:8px 0;color:#555;';
  const tdR = 'width:50%;padding:8px 0;text-align:right;';
  return `<tr><td style="${tdL}">${label}</td><td style="${tdR}">${value}</td></tr>`;
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// http/https のみ許可
function sanitizeUrl(url?: string) {
  if (!url) return '#';
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return url;
  } catch {}
  return '#';
}

