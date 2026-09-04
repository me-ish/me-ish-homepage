// --- /lib/emailTemplates/submit.ts ---
// 応募受付メール（定型版）: 名前と（任意）管理URLだけで送れる簡潔テンプレ
import { getEmailLinks } from '@/lib/constants';

export type SubmitSimpleArgs = {
  name: string;                  // 宛名（必須）
  manageUrl?: string;            // 応募管理ページ（任意）
  faqUrl?: string;               // よくある質問
  termsUrl?: string;             // 利用規約
  supportEmail?: string;         // 問合せ先
  slaHours?: number;             // 審査目安（既定:72）
};

const BRAND_HEX = '#00a1e9';

export function generateSubmitEmail(arg: SubmitSimpleArgs | string) {
  // 後方互換：stringだけ来たら最小引数に変換
  const a: SubmitSimpleArgs =
    typeof arg === 'string' ? { name: arg } : arg;

  const {
    name,
    manageUrl,
    faqUrl = getEmailLinks().faqUrl,
    termsUrl = getEmailLinks().termsUrl,
    supportEmail = 'support@me-ish.art',
    slaHours = 72,
  } = a;

  const preheader =
    `作品応募を受け付けました。通常${slaHours}時間以内に審査結果をご案内します。`;
  const nameHtml = escapeHtml(name);

  const cta = manageUrl
    ? `<a href="${sanitizeUrl(manageUrl)}"
          style="display:inline-block;padding:12px 18px;border-radius:10px;
                 background:${BRAND_HEX};color:#fff;text-decoration:none;font-weight:700;">
          応募を管理する
        </a>`
    : '';

  const html = `
  <div style="background:#f7fafc;padding:24px 0;">
    <!-- preheader -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${preheader}
    </div>

    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;
                padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',
                Roboto,'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,
                Arial,sans-serif;color:#1f2937;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:18px;font-weight:700;color:${BRAND_HEX};">me-ish</div>
        <div style="font-size:12px;color:#9ca3af;">あなたらしさを、かたちに</div>
      </div>

      <p style="margin:0 0 12px 0;">${nameHtml} 様</p>
      <p style="margin:0 0 8px 0;">この度は、me-ish への作品応募ありがとうございます。受付が完了しました。</p>

      <div style="margin:14px 0 0 0; padding:12px; background:#f0f9ff;
                  border:1px solid #bae6fd; border-radius:8px;">
        <div style="font-weight:700; margin-bottom:4px;">審査について</div>
        <div style="font-size:14px; color:#334155; line-height:1.7;">
          応募＝展示確定ではありません。通常 <b>${slaHours} 時間以内</b> を目安に審査の結果をご案内します。
          ${manageUrl ? '進捗は下記の管理ページから確認いただけます。' : ''}
        </div>
      </div>

      ${manageUrl ? `<div style="margin:16px 0 0 0;">${cta}</div>` : ''}

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />

      <ul style="margin:0;padding-left:1em;font-size:13px; color:#6b7280; line-height:1.9;">
        <li>よくある質問：<a href="${sanitizeUrl(faqUrl)}" style="color:${BRAND_HEX};">FAQ</a></li>
        <li>ご利用規約：<a href="${sanitizeUrl(termsUrl)}" style="color:${BRAND_HEX};">利用規約</a></li>
        <li>お問い合わせ：<a href="mailto:${escapeHtml(supportEmail)}" style="color:${BRAND_HEX};">${escapeHtml(supportEmail)}</a></li>
      </ul>

      <p style="margin-top:24px;font-size:12px;color:#6b7280;">本メールは送信専用です。ご返信いただいても対応できませんのでご了承ください。</p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">© me-ish 運営事務局</p>
    </div>
  </div>`;

  const text = `${name} 様

この度は、me-ishへの作品応募ありがとうございます。受付が完了しました。

[審査について]
応募＝展示確定ではありません。通常 ${slaHours} 時間以内を目安に審査結果をご案内します。
${manageUrl ? `応募を管理する：${manageUrl}\n` : ''}

FAQ：${faqUrl}
利用規約：${termsUrl}
お問い合わせ：${supportEmail}

※本メールは送信専用です。
© me-ish 運営事務局`;

  return {
    subject: '【me-ish】作品応募を受け付けました',
    html,
    text,
  };
}

// ── utils ───────────────────────────────────────────────
function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// http/httpsのみ許可
function sanitizeUrl(url?: string) {
  if (!url) return '#';
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return url;
  } catch {}
  return '#';
}
