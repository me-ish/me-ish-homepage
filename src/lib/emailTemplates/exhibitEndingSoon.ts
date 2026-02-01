// --- /lib/emailTemplates/exhibitEndingSoon.ts ---
// 展示終了5日前の予告メール

export type ExhibitEndingSoonEmailArgs = {
  name: string;                  // 宛名（必須）
  title: string;                 // 作品タイトル
  entryId: number | string;      // 作品ID（再展示リンク用）
  displayEndAt: string;          // 展示終了日時（ISO）
  workUrl?: string;              // 作品ページURL
  renewUrl?: string;             // 再展示ページURL（デフォルト: /renew）
  manageUrl?: string;            // マイページURL
  faqUrl?: string;
  supportEmail?: string;
};

const BRAND_HEX = '#00a1e9';

export function generateExhibitEndingSoonEmail(arg: ExhibitEndingSoonEmailArgs) {
  const {
    name,
    title,
    entryId,
    displayEndAt,
    workUrl,
    renewUrl = 'https://me-ish.art/renew',
    manageUrl = 'https://me-ish.art/mypage',
    faqUrl = 'https://me-ish.art/faq',
    supportEmail = 'support@me-ish.art',
  } = arg;

  const endDate = new Date(displayEndAt);
  const endDateStr = endDate.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  });

  // 残り日数を計算
  const now = new Date();
  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const daysLeftText = daysLeft <= 0 ? '本日' : `あと${daysLeft}日`;

  // 再展示リンク（作品IDをパラメータで渡す）
  const reExhibitUrl = `${renewUrl}?entry=${entryId}`;

  const preheader = `「${title}」の展示期間が${daysLeftText}で終了します。`;

  const html = `
  <div style="background:#f7fafc;padding:24px 0;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,Arial,sans-serif;color:#1f2937;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:18px;font-weight:700;color:${BRAND_HEX};">me-ish</div>
        <div style="font-size:12px;color:#9ca3af;">アートを、もっと近くに</div>
      </div>

      <p style="margin:0 0 12px 0;">${escapeHtml(name)} 様</p>
      <p style="margin:0 0 16px 0;">いつも me-ish をご利用いただきありがとうございます。</p>

      <!-- 警告バナー -->
      <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
        <div style="font-size:14px;color:#92400e;margin-bottom:4px;">展示終了まで</div>
        <div style="font-size:28px;font-weight:700;color:#d97706;">${daysLeftText}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tbody>
          <tr>
            <td style="padding:8px 0;color:#555;border-bottom:1px solid #f1f5f9;">作品名</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid #f1f5f9;">${escapeHtml(title)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#555;border-bottom:1px solid #f1f5f9;">展示終了日</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid #f1f5f9;">${endDateStr}</td>
          </tr>
        </tbody>
      </table>

      <p style="margin:16px 0;font-size:15px;line-height:1.7;">
        展示期間終了後、作品はギャラリーから非表示となります。<br/>
        引き続き展示をご希望の場合は、下記より<strong>再展示のお手続き</strong>をお願いいたします。
      </p>

      <!-- CTAボタン -->
      <div style="text-align:center;margin:24px 0;">
        <a href="${sanitizeUrl(reExhibitUrl)}"
           style="display:inline-block;padding:14px 28px;border-radius:10px;background:${BRAND_HEX};color:#fff;text-decoration:none;font-weight:700;font-size:16px;">
           この作品を再展示する
        </a>
      </div>

      <!-- プラン案内 -->
      <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
        <div style="font-weight:700;margin-bottom:8px;color:#334155;">再展示プラン</div>
        <table style="width:100%;font-size:14px;color:#64748b;">
          <tr><td style="padding:4px 0;">Free</td><td style="text-align:right;">¥0（ローテーション枠）</td></tr>
          <tr><td style="padding:4px 0;">Mini</td><td style="text-align:right;">¥400/月</td></tr>
          <tr><td style="padding:4px 0;">Light</td><td style="text-align:right;">¥1,000/月</td></tr>
          <tr><td style="padding:4px 0;">Standard</td><td style="text-align:right;">¥2,000/月</td></tr>
          <tr><td style="padding:4px 0;">Premium</td><td style="text-align:right;">¥4,000/月</td></tr>
        </table>
      </div>

      ${workUrl ? `<p style="margin:12px 0;font-size:14px;"><a href="${sanitizeUrl(workUrl)}" style="color:${BRAND_HEX};">作品ページを確認する →</a></p>` : ''}

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />

      <ul style="margin:0;padding-left:1em;font-size:13px;color:#6b7280;line-height:1.9;">
        <li>マイページ：<a href="${sanitizeUrl(manageUrl)}" style="color:${BRAND_HEX};">作品管理</a></li>
        <li>よくある質問：<a href="${sanitizeUrl(faqUrl)}" style="color:${BRAND_HEX};">FAQ</a></li>
        <li>お問い合わせ：<a href="mailto:${escapeHtml(supportEmail)}" style="color:${BRAND_HEX};">${escapeHtml(supportEmail)}</a></li>
      </ul>

      <p style="margin-top:24px;font-size:12px;color:#6b7280;">本メールは送信専用です。ご返信いただいても対応できませんのでご了承ください。</p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">© me-ish運営事務局</p>
    </div>
  </div>`;

  const text = `${name} 様

いつも me-ish をご利用いただきありがとうございます。

━━━━━━━━━━━━━━━━━━━━
展示終了まで ${daysLeftText}
━━━━━━━━━━━━━━━━━━━━

作品名：${title}
展示終了日：${endDateStr}

展示期間終了後、作品はギャラリーから非表示となります。
引き続き展示をご希望の場合は、下記より再展示のお手続きをお願いいたします。

▶ この作品を再展示する
${reExhibitUrl}

【再展示プラン】
・Free ¥0（ローテーション枠）
・Mini ¥400/月
・Light ¥1,000/月
・Standard ¥2,000/月
・Premium ¥4,000/月

${workUrl ? `作品ページ：${workUrl}\n` : ''}
マイページ：${manageUrl}
FAQ：${faqUrl}
お問い合わせ：${supportEmail}

※本メールは送信専用です。

---
me-ish運営事務局`;

  return {
    subject: `【me-ish】「${title}」の展示終了まで${daysLeftText}です`,
    html,
    text,
  };
}

/* ----- utils ----- */
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
