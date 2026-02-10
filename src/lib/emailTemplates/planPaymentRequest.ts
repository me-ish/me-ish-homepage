export type PlanPaymentRequestArgs = {
  name: string;
  title?: string;
  displayPlan: string;
  amountYen: number;
  paymentUrl: string;
  manageUrl?: string;
};

import { getEmailLinks } from '@/lib/constants';

const BRAND_HEX = '#00a1e9';
const yen = (n: number) => new Intl.NumberFormat('ja-JP').format(n);

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function generatePlanPaymentRequestEmail(a: PlanPaymentRequestArgs) {
  const title = a.title?.trim() || "作品";
  const manage = a.manageUrl?.trim();
  const amount = `¥${yen(Math.max(0, Math.floor(a.amountYen || 0)))}`;
  const { faqUrl, termsUrl } = getEmailLinks();
  const supportEmail = 'support@me-ish.art';

  const subject = "【me-ish】表示保証プランのお支払いのご案内";
  const preheader = `「${title}」の展示準備のため、お支払い手続きのご案内です。`;

  const html = `
  <div style="background:#f7fafc;padding:24px 0;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,Arial,sans-serif;color:#1f2937;line-height:1.7;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:18px;font-weight:700;color:${BRAND_HEX};">me-ish</div>
        <div style="font-size:12px;color:#9ca3af;">アートを、もっと近くに</div>
      </div>

      <p style="margin:0 0 12px 0;">${esc(a.name)} 様</p>
      <p style="margin:0 0 12px 0;">作品「${esc(title)}」の審査が完了しました。展示準備のため、表示保証プラン料金のお支払いをお願いします。</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0 8px 0;">
        <tbody>
          <tr><td style="padding:8px 0;color:#555;">プラン</td><td style="padding:8px 0;text-align:right;">${esc(a.displayPlan)}</td></tr>
          <tr><td style="padding:8px 0;color:#555;">料金</td><td style="padding:8px 0;text-align:right;">${amount}</td></tr>
        </tbody>
      </table>

      <div style="margin:16px 0 8px 0;">
        <a href="${sanitizeUrl(a.paymentUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:${BRAND_HEX};color:#fff;text-decoration:none;font-weight:700;">
          支払いへ進む
        </a>
      </div>
      <div style="font-size:12px;color:#6b7280;margin-top:6px;">
        ボタンが使えない場合は次のURLをブラウザに貼り付けてください：<br/>
        <a href="${sanitizeUrl(a.paymentUrl)}" style="color:${BRAND_HEX};">${esc(a.paymentUrl)}</a>
      </div>

      ${manage ? `<div style="margin-top:10px;font-size:14px;color:#334155;">マイページ：<a href="${sanitizeUrl(manage)}" style="color:${BRAND_HEX};">${esc(manage)}</a></div>` : ""}
      <p style="margin-top:12px;font-size:14px;color:#334155;">※ お支払い確認後に展示設定が有効になります。</p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />

      <ul style="margin:0;padding-left:1em;font-size:13px; color:#6b7280; line-height:1.9;">
        <li>よくある質問：<a href="${sanitizeUrl(faqUrl)}" style="color:${BRAND_HEX};">FAQ</a></li>
        <li>ご利用規約：<a href="${sanitizeUrl(termsUrl)}" style="color:${BRAND_HEX};">利用規約</a></li>
        <li>お問い合わせ：<a href="mailto:${esc(supportEmail)}" style="color:${BRAND_HEX};">${esc(supportEmail)}</a></li>
      </ul>

      <p style="margin-top:24px;font-size:12px;color:#6b7280;">本メールは送信専用です。ご返信いただいても対応できませんのでご了承ください。</p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">© me-ish運営事務局</p>
    </div>
  </div>
  `;

  const text = `${a.name} 様

作品「${title}」の審査が完了しました。展示準備のため、表示保証プラン料金のお支払いをお願いします。

- プラン: ${a.displayPlan}
- 料金: ${amount}

支払いURL:
${a.paymentUrl}

${manage ? `マイページ: ${manage}\n` : ""}※ お支払い確認後に展示設定が有効になります。

FAQ：${faqUrl}
利用規約：${termsUrl}
お問い合わせ：${supportEmail}

※本メールは送信専用です。`;

  return { subject, html, text };
}

function sanitizeUrl(url?: string) {
  if (!url) return '#';
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return url;
  } catch {}
  return '#';
}
