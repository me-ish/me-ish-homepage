// Reactや 'use client' は不要（サーバー側で使う純関数）

export type ContactEmailArgs = {
  name: string;
  email: string;               // 送信者のメール（Reply-To用）
  subject?: string;            // 任意（未指定ならカテゴリから生成）
  message: string;             // 本文（複数行OK）
  category?: 'general' | 'bug' | 'howto' | 'entry' | 'purchase' | 'other';
  pageUrl?: string;
  device?: string;
  browser?: string;
  steps?: string;
};

const BRAND_HEX = '#00a1e9';

const CATEGORY_LABEL: Record<NonNullable<ContactEmailArgs['category']>, string> = {
  general: '一般のお問い合わせ',
  bug: '不具合の報告',
  howto: '使い方について',
  entry: '出展について',
  purchase: '購入について',
  other: 'その他',
};

export function generateContactEmail(a: ContactEmailArgs) {
  const {
    name,
    email,
    subject,
    message,
    category,
    pageUrl,
    device,
    browser,
    steps,
  } = a;

  const catLabel = category ? CATEGORY_LABEL[category] : undefined;

  const finalSubject =
    subject?.trim() ||
    (catLabel ? `【お問い合わせ】${catLabel}` : '【お問い合わせ】無題');

  const lines = [
    `<b>お名前</b>：${esc(name)}`,
    `<b>メール</b>：<a href="mailto:${esc(email)}">${esc(email)}</a>`,
    catLabel ? `<b>カテゴリ</b>：${esc(catLabel)}` : '',
    pageUrl ? `<b>ページURL</b>：<a href="${sanitizeUrl(pageUrl)}">${esc(pageUrl)}</a>` : '',
    device ? `<b>端末/OS</b>：${esc(device)}` : '',
    browser ? `<b>ブラウザ</b>：${esc(browser)}` : '',
    steps ? `<b>再現手順</b>：<br>${nl2br(steps)}` : '',
  ].filter(Boolean);

  const html = `
  <div style="background:#f7fafc;padding:24px 0;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;
                padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',
                Roboto,'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,
                Arial,sans-serif;color:#1f2937;line-height:1.7;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:18px;font-weight:700;color:${BRAND_HEX};">me-ish</div>
        <div style="font-size:12px;color:#9ca3af;">お問い合わせ（運営宛）</div>
      </div>

      <div style="font-size:14px;color:#334155;">
        ${lines.join('<br>')}
      </div>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />

      <div>
        <div style="font-weight:700;margin-bottom:6px;">本文</div>
        <div style="white-space:pre-wrap;font-size:14px;color:#1f2937;">
          ${nl2br(message)}
        </div>
      </div>

      <p style="margin-top:24px;font-size:12px;color:#9ca3af;">© me-ish 運営事務局</p>
    </div>
  </div>`.trim();

  const textHeader = [
    `お名前: ${name}`,
    `メール: ${email}`,
    catLabel ? `カテゴリ: ${catLabel}` : undefined,
    pageUrl ? `ページURL: ${pageUrl}` : undefined,
    device ? `端末/OS: ${device}` : undefined,
    browser ? `ブラウザ: ${browser}` : undefined,
    steps ? `再現手順:\n${steps}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  const text = `${textHeader}\n\n---\n${message}`;

  return { subject: finalSubject, html, text };
}

/* ── utils ───────────────────────────────────────────── */
function esc(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function nl2br(input: string) {
  return esc(input).replace(/\r?\n/g, '<br>');
}

// http/https のみ許可（それ以外は # にフォールバック）
function sanitizeUrl(url?: string) {
  if (!url) return '#';
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return url;
  } catch {}
  return '#';
}
