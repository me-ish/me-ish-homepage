// --- /lib/emailTemplates/exhibitStart.ts ---
import { getEmailLinks } from '@/lib/constants';

const BRAND_HEX = '#00a1e9';

export function generateExhibitStartEmail(name: string) {
  const { faqUrl, termsUrl } = getEmailLinks();
  const supportEmail = 'support@me-ish.art';

  const preheader = '展示が開始されました。me-ishギャラリーにて公開中です。';

  return {
    subject: '【me-ish】展示が開始されました',
    html: `
  <div style="background:#f7fafc;padding:24px 0;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,Arial,sans-serif;color:#1f2937;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:18px;font-weight:700;color:${BRAND_HEX};">me-ish</div>
        <div style="font-size:12px;color:#9ca3af;">アートを、もっと近くに</div>
      </div>

      <p style="margin:0 0 12px 0;">${escapeHtml(name)} 様</p>
      <p style="margin:0 0 12px 0;">ご出展いただいた作品の展示が本日より開始されました。</p>
      <p style="margin:0 0 16px 0;">me-ish ギャラリーにて多くの方にご覧いただけます。</p>
      <p style="margin:0 0 8px 0;">ご参加、誠にありがとうございます。</p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />

      <ul style="margin:0;padding-left:1em;font-size:13px; color:#6b7280; line-height:1.9;">
        <li>よくある質問：<a href="${sanitizeUrl(faqUrl)}" style="color:${BRAND_HEX};">FAQ</a></li>
        <li>ご利用規約：<a href="${sanitizeUrl(termsUrl)}" style="color:${BRAND_HEX};">利用規約</a></li>
        <li>お問い合わせ：<a href="mailto:${escapeHtml(supportEmail)}" style="color:${BRAND_HEX};">${escapeHtml(supportEmail)}</a></li>
      </ul>

      <p style="margin-top:24px;font-size:12px;color:#6b7280;">本メールは送信専用です。ご返信いただいても対応できませんのでご了承ください。</p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">© me-ish運営事務局</p>
    </div>
  </div>`,
    text: `${name} 様

ご出展いただいた作品の展示が本日より開始されました。
me-ish ギャラリーにて多くの方にご覧いただけます。
ご参加、誠にありがとうございます。

FAQ：${faqUrl}
利用規約：${termsUrl}
お問い合わせ：${supportEmail}

※本メールは送信専用です。
© me-ish運営事務局`,
  };
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
