// --- /lib/emailTemplates/payoutComplete.ts ---
import { getEmailLinks } from '@/lib/constants';

export type PayoutCompleteEmailArgs = {
  name: string;                    // 宛名（必須）
  amountYen: number;               // 振込金額
  periodYm?: string;               // 対象期間（例: "2025-01"）
  itemCount?: number;              // 振込対象の売上件数
  paidAt?: string;                 // 振込日時（ISO）
  bankAccountLast4?: string;       // 口座番号下4桁（確認用）
  manageUrl?: string;              // マイページURL
  faqUrl?: string;                 // 既定: /faq
  termsUrl?: string;               // 既定: /footer/terms
  supportEmail?: string;           // 既定: support@me-ish.art
  note?: string;                   // 連絡事項（任意）
};

const BRAND_HEX = '#00a1e9';

export function generatePayoutCompleteEmail(arg: PayoutCompleteEmailArgs) {
  const {
    name,
    amountYen,
    periodYm,
    itemCount,
    paidAt,
    bankAccountLast4,
    manageUrl = getEmailLinks().mypageUrl,
    faqUrl = getEmailLinks().faqUrl,
    termsUrl = getEmailLinks().termsUrl,
    supportEmail = 'support@me-ish.art',
    note,
  } = arg;

  const preheader = `${fmtYen(amountYen)}円の振り込みが完了しました。`;

  const paidAtStr = paidAt
    ? new Date(paidAt).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Tokyo',
      })
    : '本日';

  const periodStr = periodYm
    ? `${periodYm.slice(0, 4)}年${parseInt(periodYm.slice(5, 7), 10)}月分`
    : '';

  // テーブル行
  const rows: string[] = [];
  rows.push(row('振込金額', `¥${fmtYen(amountYen)}`));
  if (periodStr) rows.push(row('対象期間', periodStr));
  if (itemCount != null) rows.push(row('対象売上件数', `${itemCount}件`));
  rows.push(row('振込日', paidAtStr));
  if (bankAccountLast4) rows.push(row('振込先口座', `****${bankAccountLast4}`));

  const manageBtn = `<a href="${sanitizeUrl(manageUrl)}"
       style="display:inline-block;padding:12px 18px;border-radius:10px;background:${BRAND_HEX};color:#fff;text-decoration:none;font-weight:700;">
       マイページで確認する
     </a>`;

  const html = `
  <div style="background:#f7fafc;padding:24px 0;">
    <!-- preheader -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,Arial,sans-serif;color:#1f2937;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:18px;font-weight:700;color:${BRAND_HEX};">me-ish</div>
        <div style="font-size:12px;color:#9ca3af;">あなたらしさを、かたちに</div>
      </div>

      <p style="margin:0 0 12px 0;">${escapeHtml(name)} 様</p>
      <p style="margin:0 0 12px 0;">いつも me-ish をご利用いただきありがとうございます。</p>
      <p style="margin:0 0 16px 0;">下記の通り、販売報酬の<strong style="color:${BRAND_HEX};">お振り込みが完了</strong>いたしましたのでご報告いたします。</p>

      <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
        <div style="font-size:14px;color:#065f46;margin-bottom:4px;">振込金額</div>
        <div style="font-size:28px;font-weight:700;color:#047857;">¥${fmtYen(amountYen)}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin:16px 0 8px 0;">
        <tbody>${rows.join('')}</tbody>
      </table>

      <div style="margin:16px 0 0 0;text-align:center;">${manageBtn}</div>

      ${note ? `<div style="margin-top:16px;padding:12px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;font-size:14px;color:#92400e;"><strong>ご連絡：</strong>${escapeHtml(note)}</div>` : ''}

      <div style="margin:20px 0 0 0; padding:12px; background:#f8fafc; border-radius:8px;">
        <div style="font-size:13px; color:#64748b; line-height:1.7;">
          ※ 振込先口座への着金には、金融機関により1〜2営業日かかる場合があります。<br/>
          ※ ご不明な点がございましたら、お気軽にお問い合わせください。
        </div>
      </div>

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
  textLines.push('いつも me-ish をご利用いただきありがとうございます。');
  textLines.push('下記の通り、販売報酬のお振り込みが完了いたしましたのでご報告いたします。\n');
  textLines.push(`振込金額：¥${fmtYen(amountYen)}`);
  if (periodStr) textLines.push(`対象期間：${periodStr}`);
  if (itemCount != null) textLines.push(`対象売上件数：${itemCount}件`);
  textLines.push(`振込日：${paidAtStr}`);
  if (bankAccountLast4) textLines.push(`振込先口座：****${bankAccountLast4}`);
  textLines.push(`\nマイページで確認する：${manageUrl}`);
  if (note) textLines.push(`\n[ご連絡]\n${note}`);
  textLines.push('\n※ 振込先口座への着金には、金融機関により1〜2営業日かかる場合があります。');
  textLines.push(`\nFAQ：${faqUrl}\n利用規約：${termsUrl}\nお問い合わせ：${supportEmail}\n\n※本メールは送信専用です。`);

  return {
    subject: '【me-ish】販売報酬のお振り込みが完了しました',
    html,
    text: textLines.join('\n'),
  };
}

/* ----- utils ----- */
function fmtYen(n: number) {
  return new Intl.NumberFormat('ja-JP').format(n);
}

function row(label: string, value: string) {
  const tdL = 'width:50%;padding:8px 0;color:#555;border-bottom:1px solid #f1f5f9;';
  const tdR = 'width:50%;padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid #f1f5f9;';
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
