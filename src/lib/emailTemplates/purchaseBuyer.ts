// --- /lib/emailTemplates/purchaseBuyer.ts ---
export type PurchaseBuyerEmailArgs = {
  name: string;                      // 宛名（必須）
  title?: string;                    // 作品名
  artistName?: string;               // 作家名
  // どちらでも可（どちらかあればOK）
  priceYen?: number | null;          // 価格
  amountYen?: number | null;         // 価格（互換）
  editionNo?: number | null;         // 何番（例: 2）
  editionTotal?: number | null;      // 総数（例: 10）
  orderId?: string;                  // 注文番号
  salesType?: 'normal' | 'nft' | string;

  // 納品
  deliveryEtaDays?: number;          // 納品目安（日） 既定: 3
  deliveryAtISO?: string;            // 納品予定日時（分かれば）

  // 導線
  manageUrl?: string;                // 注文/購入内容の確認
  downloadUrl?: string;              // 作品データの受け取り（任意）
  receiptUrl?: string;               // 領収書/明細URL（任意）
  certificateUrl?: string;           // ★ 購入証明（COA）表示URL
  coaUrl?: string;                   // ★ 互換キー（上とどちらかあればOK）

  // 定型リンク・連絡先
  faqUrl?: string;                   // 既定: /faq
  termsUrl?: string;                 // 既定: /footer/terms
  supportEmail?: string;             // 既定: support@me-ish.art
};

const BRAND_HEX = '#00a1e9';

export function generatePurchaseBuyerEmail(arg: string | PurchaseBuyerEmailArgs) {
  // 後方互換：stringのみは name として扱う
  const a0: PurchaseBuyerEmailArgs = typeof arg === 'string' ? { name: arg } : arg;

  // priceYen / amountYen の統一（どちらでもOK）
  const price = a0.priceYen ?? a0.amountYen ?? null;

  const {
    name,
    title,
    artistName,
    editionNo = null,
    editionTotal = null,
    orderId,
    salesType = 'normal',
    deliveryEtaDays = 3,
    deliveryAtISO,
    manageUrl,
    downloadUrl,
    receiptUrl,
    faqUrl = 'https://me-ish.art/faq',
    termsUrl = 'https://me-ish.art/footer/terms',
    supportEmail = 'support@me-ish.art',
  } = a0;

  // COAリンク（certificateUrl優先、なければcoaUrl）
  const certificateUrl = a0.certificateUrl ?? a0.coaUrl ?? undefined;

  const preheader = 'ご購入ありがとうございます。購入内容／納品のご案内と、購入証明（CoA）へのリンクをお送りします。';

  const fmtYen = (n: number) => new Intl.NumberFormat('ja-JP').format(n);
  const deliveryStr = deliveryAtISO
    ? new Date(deliveryAtISO).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    : `通常 ${deliveryEtaDays} 日以内`;

  const isNFT = String(salesType).toLowerCase() === 'nft';

  const rows: string[] = [];
  if (title) rows.push(row('作品名', escapeHtml(title)));
  if (artistName) rows.push(row('作家名', escapeHtml(artistName)));
  if (price != null) rows.push(row('価格', `¥${fmtYen(price)}`));
  if (editionNo != null || editionTotal != null)
    rows.push(row('エディション', `${editionNo ?? '-'} / ${editionTotal ?? '-'}`));
  if (orderId) rows.push(row('注文番号', escapeHtml(orderId)));
  rows.push(row('形式', isNFT ? 'NFT' : 'デジタル作品'));

  const manageCta =
    manageUrl &&
    `<a href="${sanitizeUrl(manageUrl)}"
        style="display:inline-block;padding:12px 18px;border-radius:10px;background:${BRAND_HEX};color:#fff;text-decoration:none;font-weight:700;">
        購入内容を確認する
     </a>`;

  const certificateCta = certificateUrl
    ? `<a href="${sanitizeUrl(certificateUrl)}"
          style="display:inline-block;padding:10px 14px;border-radius:10px;border:1px solid ${BRAND_HEX};color:${BRAND_HEX};text-decoration:none;font-weight:700;margin-right:8px;">
          購入証明（CoA）を表示
       </a>`
    : '';

  const secondaryCtas = [
    certificateCta,
    downloadUrl
      ? `<a href="${sanitizeUrl(downloadUrl)}"
            style="display:inline-block;padding:10px 14px;border-radius:10px;border:1px solid ${BRAND_HEX};color:${BRAND_HEX};text-decoration:none;font-weight:700;margin-right:8px;">
            作品データを受け取る
         </a>`
      : '',
    receiptUrl
      ? `<a href="${sanitizeUrl(receiptUrl)}"
            style="display:inline-block;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;color:#334155;text-decoration:none;font-weight:700;">
            領収書を見る
         </a>`
      : '',
  ]
    .filter(Boolean)
    .join('');

  const html = `
  <div style="background:#f7fafc;padding:24px 0;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,Arial,sans-serif;color:#1f2937;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:18px;font-weight:700;color:${BRAND_HEX};">me-ish</div>
        <div style="font-size:12px;color:#9ca3af;">アートを、もっと近くに</div>
      </div>

      <p style="margin:0 0 12px 0;">${escapeHtml(name)} 様</p>
      <p style="margin:0 0 12px 0;">この度は <strong>me-ish</strong> での作品ご購入、誠にありがとうございます。お支払いを確認し、納品準備を進めております。</p>

      ${rows.length ? `<table style="width:100%;border-collapse:collapse;margin:16px 0 8px 0;"><tbody>${rows.join('')}</tbody></table>` : ''}

      <div style="margin:14px 0 0 0; padding:12px; background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px;">
        <div style="font-weight:700; margin-bottom:4px;">納品について</div>
        <div style="font-size:14px; color:#334155; line-height:1.7;">
          納品予定：<b>${escapeHtml(deliveryStr)}</b> を目安にご案内いたします。${
            isNFT
              ? 'NFT はミント完了後、ウォレットへお届けします。'
              : '作品データのダウンロード案内をお送りします。'
          }
          ${certificateUrl ? '<br/>※ 購入証明（CoA）は下記リンクからいつでも表示・ダウンロードできます。' : ''}
        </div>
      </div>

      ${manageCta ? `<div style="margin:16px 0 8px 0;">${manageCta}</div>` : ''}
      ${secondaryCtas ? `<div style="margin:4px 0 0 0;">${secondaryCtas}</div>` : ''}

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
  textLines.push('この度は me-ish での作品ご購入、誠にありがとうございます。お支払いを確認し、納品準備を進めております。\n');
  if (title) textLines.push(`作品名：${title}`);
  if (artistName) textLines.push(`作家名：${artistName}`);
  if (price != null) textLines.push(`価格：¥${fmtYen(price)}`);
  if (editionNo != null || editionTotal != null) textLines.push(`エディション：${editionNo ?? '-'} / ${editionTotal ?? '-'}`);
  if (orderId) textLines.push(`注文番号：${orderId}`);
  textLines.push(`形式：${isNFT ? 'NFT' : 'デジタル作品'}`);
  textLines.push(`\n[納品について]\n納品予定：${deliveryStr}${isNFT ? '\nNFT はミント完了後にウォレットへお届けします。' : '\n作品データのダウンロード案内をお送りします。'}`);
  if (certificateUrl) textLines.push(`購入証明（CoA）：${certificateUrl}`);
  if (manageUrl) textLines.push(`購入内容を確認する：${manageUrl}`);
  if (downloadUrl) textLines.push(`作品データを受け取る：${downloadUrl}`);
  if (receiptUrl) textLines.push(`領収書を見る：${receiptUrl}`);
  textLines.push(`\nFAQ：${faqUrl}\n利用規約：${termsUrl}\nお問い合わせ：${supportEmail}\n\n※本メールは送信専用です。`);

  return {
    subject: '【me-ish】ご購入ありがとうございます',
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
function sanitizeUrl(url?: string) {
  if (!url) return '#';
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return url;
  } catch {}
  return '#';
}
