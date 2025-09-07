// --- /lib/emailTemplates/pass.ts ---
export type PassEmailArgs = {
  name: string;
  externalUserId: string;
  siteUrl?: string;            // 既定: NEXT_PUBLIC_SITE_URL
  supportEmail?: string;       // 既定: support@me-ish.art
  faqUrl?: string;             // 既定: https://me-ish.art/faq
  termsUrl?: string;           // 既定: https://me-ish.art/footer/terms
};

const BRAND_HEX = '#00a1e9';

export function generatePassEmail(
  nameOrArgs: string | PassEmailArgs,
  externalUserIdLegacy?: string
) {
  // 後方互換: 旧シグネチャ (name, externalUserId)
  const args: PassEmailArgs =
    typeof nameOrArgs === 'string'
      ? { name: nameOrArgs, externalUserId: externalUserIdLegacy! }
      : nameOrArgs;

  const {
    name,
    externalUserId,
    siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://me-ish.art',
    supportEmail = 'support@me-ish.art',
    faqUrl = 'https://me-ish.art/faq',
    termsUrl = 'https://me-ish.art/footer/terms',
  } = args;

  const base = siteUrl.replace(/\/+$/, '');
  const linkUrl = `${base}/auth/link?external=${encodeURIComponent(externalUserId)}`;

  const preheader =
    '作品が審査を通過しました。初回のみ下記ボタンからログイン連携を行ってください。';

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
      <p style="margin:0 0 12px 0;">この度は <strong>me-ish</strong> に作品をご応募いただき、誠にありがとうございました。審査の結果、<strong>展示が決定</strong>しました。</p>

      <div style="margin:14px 0 0 0; padding:12px; background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px;">
        <div style="font-weight:700; margin-bottom:4px;">次のステップ</div>
        <div style="font-size:14px; color:#334155; line-height:1.7;">
          作品管理やご連絡のため、<b>初回のみ</b>下のボタンからログイン連携を行ってください。
        </div>
      </div>

      <div style="margin:16px 0 8px 0;">
        <a href="${sanitizeUrl(linkUrl)}"
           style="display:inline-block;padding:12px 18px;border-radius:10px;background:${BRAND_HEX};color:#fff;text-decoration:none;font-weight:700;">
           ログインを連携する
        </a>
      </div>
      <div style="font-size:12px;color:#6b7280;margin-top:6px;">
        クリックできない場合は次のURLをブラウザに貼り付けてください：<br/>
        <a href="${sanitizeUrl(linkUrl)}" style="color:${BRAND_HEX};">${escapeHtml(linkUrl)}</a>
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

  const text = `${name} 様

この度は me-ish に作品をご応募いただき、誠にありがとうございました。
審査の結果、展示が決定しました。

[次のステップ]
作品管理やご連絡のため、初回のみ下記URLからログイン連携を行ってください。
${linkUrl}

クリックできない場合は、上記URLをブラウザに貼り付けて開いてください。

FAQ：${faqUrl}
利用規約：${termsUrl}
お問い合わせ：${supportEmail}

※本メールは送信専用です。`;

  return {
    subject: '【me-ish】作品が審査を通過しました',
    html,
    text,
  };
}

// utils
function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
// http/httpsのみ許可
function sanitizeUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return url;
  } catch {}
  return '#';
}
