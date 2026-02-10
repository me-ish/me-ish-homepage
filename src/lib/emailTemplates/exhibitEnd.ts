import { getEmailLinks } from '@/lib/constants';

const BRAND_HEX = '#00a1e9';

export function generateExhibitEndEmail(name: string) {
  const { renewUrl, faqUrl, termsUrl } = getEmailLinks();
  const supportEmail = 'support@me-ish.art';

  const preheader = '展示期間が終了しました。再展示のお手続きはこちらから行えます。';

  return {
    subject: '【me-ish】展示期間が終了しました',
    html: `
  <div style="background:#f7fafc;padding:24px 0;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,Arial,sans-serif;color:#1f2937;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:18px;font-weight:700;color:${BRAND_HEX};">me-ish</div>
        <div style="font-size:12px;color:#9ca3af;">アートを、もっと近くに</div>
      </div>

      <p style="margin:0 0 12px 0;">${escapeHtml(name)} 様</p>
      <p style="margin:0 0 12px 0;">ご出展いただいた作品の展示期間が終了いたしました。</p>
      <p style="margin:0 0 16px 0;">この度は me-ish へのご参加、誠にありがとうございました。</p>

      <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
        <div style="font-weight:700;margin-bottom:8px;color:#334155;">再展示プラン</div>
        <table style="width:100%;font-size:14px;color:#64748b;">
          <tr><td style="padding:4px 0;">Free</td><td style="text-align:right;">¥0（ローテーション枠）</td></tr>
          <tr><td style="padding:4px 0;">Mini</td><td style="text-align:right;">¥400/月</td></tr>
          <tr><td style="padding:4px 0;">Light</td><td style="text-align:right;">¥800/月</td></tr>
          <tr><td style="padding:4px 0;">Standard</td><td style="text-align:right;">¥1,200/月</td></tr>
          <tr><td style="padding:4px 0;">Premium</td><td style="text-align:right;">¥2,400/月</td></tr>
        </table>
      </div>

      <div style="text-align:center;margin:24px 0;">
        <a href="${sanitizeUrl(renewUrl)}"
           style="display:inline-block;padding:14px 28px;border-radius:10px;background:${BRAND_HEX};color:#fff;text-decoration:none;font-weight:700;font-size:16px;">
           再展示・プラン延長はこちら
        </a>
      </div>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />

      <ul style="margin:0;padding-left:1em;font-size:13px;color:#6b7280;line-height:1.9;">
        <li>よくある質問：<a href="${sanitizeUrl(faqUrl)}" style="color:${BRAND_HEX};">FAQ</a></li>
        <li>ご利用規約：<a href="${sanitizeUrl(termsUrl)}" style="color:${BRAND_HEX};">利用規約</a></li>
        <li>お問い合わせ：<a href="mailto:${escapeHtml(supportEmail)}" style="color:${BRAND_HEX};">${escapeHtml(supportEmail)}</a></li>
      </ul>

      <p style="margin-top:24px;font-size:12px;color:#6b7280;">本メールは送信専用です。ご返信いただいても対応できませんのでご了承ください。</p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">© me-ish運営事務局</p>
    </div>
  </div>
    `,
    text: `${name} 様

ご出展いただいた作品の展示期間が終了いたしました。
この度は me-ish へのご参加、誠にありがとうございました。

【再展示プラン】
・Free ¥0（ローテーション枠）
・Mini ¥400/月
・Light ¥800/月
・Standard ¥1,200/月
・Premium ¥2,400/月

再展示・プラン延長はこちら:
${renewUrl}

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
