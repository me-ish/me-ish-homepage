// --- /lib/emailTemplates/reject.ts ---
const BRAND_HEX = '#00a1e9';

export type RejectEmailArgs = {
  name: string;             // 宛名（必須）
  title?: string;           // 作品タイトル（任意）
  reason?: string;          // 却下理由（任意）
  manageUrl?: string;       // 管理/ガイドURL（任意：応募要項などに戻す）
  faqUrl?: string;          // FAQ（任意）
  supportEmail?: string;    // サポート窓口（任意）
};

export function generateRejectEmail(args: RejectEmailArgs) {
  const name = safe(args.name);
  const title = safe(args.title ?? '');
  const reason = safe(args.reason ?? '');
  const manageUrl = args.manageUrl || '';
  const faqUrl = args.faqUrl || '';
  const supportEmail = args.supportEmail || 'support@me-ish.art';

  const preheader = '審査結果のお知らせ（今回はご期待に添えませんでした）';

  const workBox = args.title
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;border:1px solid #e5e7eb;border-radius:12px;">
      <tr>
        <td style="padding:12px 16px;">
          <div style="font-size:12px;color:#6b7280;margin:0 0 4px 0;">応募作品</div>
          <div style="font-size:16px;font-weight:600;color:#111827;margin:0;">${title}</div>
        </td>
      </tr>
    </table>
    `
    : '';

  const reasonBox = args.reason
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:12px 0;border:1px solid #fde68a;background:#fffbeb;border-radius:12px;">
      <tr>
        <td style="padding:12px 16px;">
          <div style="font-size:12px;color:#92400e;margin:0 0 6px 0;">理由</div>
          <div style="font-size:14px;color:#78350f;line-height:1.7;">${reason}</div>
        </td>
      </tr>
    </table>
    `
    : '';

  const actionLinks = [
    manageUrl ? btn('応募要項・ガイドを見る', manageUrl) : '',
    faqUrl ? link('FAQを見る', faqUrl) : '',
  ].filter(Boolean).join('');

  const html = `
  <div style="background:#f9fafb;padding:24px 0;">
    <!-- preheader -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,Arial,sans-serif;color:#111827;">
      <!-- brand -->
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:20px;font-weight:800;color:${BRAND_HEX};line-height:1;">me-ish</div>
        <div style="font-size:12px;color:#9ca3af;">アートを、もっと近くに</div>
      </div>

      <h1 style="margin:0 0 12px 0;font-size:18px;line-height:1.4;">審査結果のお知らせ</h1>

      <p style="margin:0 0 12px 0;">${name} 様</p>
      <p style="margin:0 0 12px 0;">
        この度は <strong>me-ish</strong> に作品をご応募いただき、誠にありがとうございました。慎重に審査を行いました結果、今回はご期待に添えない結果となりました。
      </p>

      ${workBox}
      ${reasonBox}

      <p style="margin:12px 0 16px 0;">またの機会がございましたら、ぜひご応募いただけますと幸いです。作品テーマや展示方針は随時アップデートしてまいります。</p>

      ${actionLinks}

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />

      <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;">
        お問い合わせ：<a href="mailto:${safeAttr(supportEmail)}" style="color:${BRAND_HEX};text-decoration:underline;">${safe(supportEmail)}</a>
      </p>
      <p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;">※本メールは送信専用です。ご返信いただいても対応できない場合があります。</p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">© me-ish運営事務局</p>
    </div>
  </div>
  `;

  const text = [
    '審査結果のお知らせ',
    '',
    `${args.name} 様`,
    '',
    'この度は me-ish に作品をご応募いただき、誠にありがとうございました。慎重に審査を行いました結果、今回はご期待に添えない結果となりました。',
    args.title ? `\n応募作品：${args.title}` : '',
    args.reason ? `\n理由：${args.reason}` : '',
    '',
    'またの機会がございましたら、ぜひご応募ください。',
    manageUrl ? `応募要項・ガイド: ${manageUrl}` : '',
    faqUrl ? `FAQ: ${faqUrl}` : '',
    '',
    `お問い合わせ: ${supportEmail}`,
    '※本メールは送信専用です。ご返信いただいても対応できない場合があります。',
    '© me-ish運営事務局',
  ].filter(Boolean).join('\n');

  return {
    subject: '【me-ish】審査結果のお知らせ',
    html,
    text,
  };
}

/* utilities */
function safe(v: string) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function safeAttr(v: string) {
  return safe(v).replaceAll(' ', '%20');
}
function btn(label: string, href: string) {
  const L = safe(label);
  const H = safeAttr(href);
  return `
    <div style="margin:16px 0;">
      <a href="${H}" style="display:inline-block;background:${BRAND_HEX};color:#ffffff !important;text-decoration:none;padding:10px 16px;border-radius:10px;font-size:14px;font-weight:600;">
        ${L}
      </a>
    </div>
  `;
}
function link(label: string, href: string) {
  const L = safe(label);
  const H = safeAttr(href);
  return `
    <div style="margin:4px 0;">
      <a href="${H}" style="color:${BRAND_HEX};text-decoration:underline;">${L}</a>
    </div>
  `;
}
