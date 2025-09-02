// --- /lib/emailTemplates/submit.ts ---
// 応募受付メール（後方互換対応）
// - generateSubmitEmail("ナトリ") だけでも従来どおり送信可
// - 詳細を載せたいときはオブジェクト版を渡す（下の型を参照）

export type SubmitEmailArgs = {
  name: string;                          // 宛名（必須）
  entryTitle?: string;                   // 作品名
  galleryType?: 'WHITE' | 'FLOAT' | 'SPECIAL' | string; // ギャラリー種別
  salesType?: 'normal' | 'nft';          // 販売形式
  priceYen?: number | null;              // 税込価格（表示用）
  editionTotal?: number | null;          // エディション総数
  submittedAtISO?: string;               // 応募日時 ISO
  manageUrl?: string;                    // 応募管理ページ（推奨）
  editUrl?: string;                      // 応募内容修正URL（任意）
  faqUrl?: string;                       // FAQ
  termsUrl?: string;                     // 規約
  supportEmail?: string;                 // 問合せ先
  slaHours?: number;                     // 審査目安（既定:72h）
};

const BRAND_HEX = '#00a1e9';

export function generateSubmitEmail(arg: string | SubmitEmailArgs) {
  // 後方互換：string だけ来たら最小テンプレで返す
  if (typeof arg === 'string') {
    const safeName = escapeHtml(arg);
    const preheader = '作品応募を受け付けました。通常72時間以内に審査結果をご案内します。';
    return {
      subject: '【me-ish】作品応募を受け付けました',
      html: `
        <div style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; color: #333;">
          <!-- preheader -->
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

          <div style="text-align:center;margin-bottom:12px;">
            <div style="font-size:18px;font-weight:700;color:${BRAND_HEX};">me-ish</div>
            <div style="font-size:12px;color:#9ca3af;">アートを、もっと近くに</div>
          </div>
          <p>${safeName} 様</p>
          <p>この度は <strong>me-ish</strong> に作品をご応募いただき、誠にありがとうございます。</p>
          <p>内容を確認のうえ、数日以内に審査結果をご連絡いたします。</p>
          <p style="margin-top: 2em; font-size:12px; color:#6b7280;">※本メールは送信専用です。</p>
          <p style="margin:0;font-size:12px;color:#9ca3af;">© me-ish 運営事務局</p>
        </div>
      `,
      text: `${arg} 様

この度はme-ishに作品をご応募いただき、誠にありがとうございます。
内容を確認のうえ、数日以内に審査結果をご連絡いたします。

※本メールは送信専用です。
© me-ish 運営事務局`,
    };
  }

  // 詳細版
  const {
    name,
    entryTitle,
    galleryType = 'WHITE',
    salesType = 'normal',
    priceYen = null,
    editionTotal = null,
    submittedAtISO,
    manageUrl,
    editUrl,
    faqUrl = 'https://me-ish.art/faq',
    termsUrl = 'https://me-ish.art/footer/terms',
    supportEmail = 'support@me-ish.art',
    slaHours = 72,
  } = arg;

  const fmt = (n: number) => new Intl.NumberFormat('ja-JP').format(n);
  const submittedAtStr = submittedAtISO
    ? new Date(submittedAtISO).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    : '—';

  const galleryLabel = (() => {
    if (galleryType === 'WHITE') return 'White ギャラリー（常設）';
    if (galleryType === 'FLOAT') return 'Float ギャラリー（日替わり）';
    if (galleryType === 'SPECIAL') return '特別テーマギャラリー';
    return String(galleryType ?? '');
  })();
  const salesLabel = salesType === 'nft' ? 'NFT販売' : '通常販売';

  const nameHtml = escapeHtml(name);
  const entryTitleHtml = entryTitle ? escapeHtml(entryTitle) : null;
  const galleryLabelHtml = escapeHtml(galleryLabel);

  const priceRow =
    priceYen != null
      ? `
    <tr><td style="padding:8px 0; color:#555;">予定販売価格</td>
        <td style="padding:8px 0; text-align:right;">¥${fmt(priceYen)}</td></tr>`
      : '';

  const editionRow =
    editionTotal != null
      ? `
    <tr><td style="padding:8px 0; color:#555;">エディション数</td>
        <td style="padding:8px 0; text-align:right;">${editionTotal} 点</td></tr>`
      : '';

  const manageButton = manageUrl
    ? `<a href="${sanitizeUrl(manageUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:${BRAND_HEX};color:#fff;text-decoration:none;font-weight:700;">応募を管理する</a>`
    : '';

  const editLink = editUrl
    ? `<div style="margin-top:10px;"><a href="${sanitizeUrl(editUrl)}" style="font-size:14px;color:${BRAND_HEX};">応募内容を修正する</a></div>`
    : '';

  const preheader =
    '作品応募を受け付けました。管理ページから進捗が確認できます（通常72時間以内に審査結果をご案内）。';

  const html = `
  <div style="background:#f7fafc;padding:24px 0;">
    <!-- preheader -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;font-family:Helvetica,Arial,sans-serif;color:#1f2937;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:18px;font-weight:700;color:${BRAND_HEX};">me-ish</div>
        <div style="font-size:12px;color:#9ca3af;">アートを、もっと近くに</div>
      </div>

      <p style="margin:0 0 12px 0;">${nameHtml} 様</p>
      <p style="margin:0 0 16px 0;">この度は、me-ishへの作品応募ありがとうございます。以下の内容で受付いたしました。</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0 8px 0;">
        <tbody>
          ${entryTitleHtml ? `<tr><td style="padding:8px 0; color:#555;">作品名</td><td style="padding:8px 0; text-align:right;">${entryTitleHtml}</td></tr>` : ''}
          <tr><td style="padding:8px 0; color:#555;">応募ギャラリー</td><td style="padding:8px 0; text-align:right;">${galleryLabelHtml}</td></tr>
          <tr><td style="padding:8px 0; color:#555;">販売形式</td><td style="padding:8px 0; text-align:right;">${salesLabel}</td></tr>
          ${priceRow}
          ${editionRow}
          <tr><td style="padding:8px 0; color:#555;">応募日時</td><td style="padding:8px 0; text-align:right;">${submittedAtStr}</td></tr>
        </tbody>
      </table>

      <div style="margin:18px 0 12px 0; padding:12px; background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px;">
        <div style="font-weight:700; margin-bottom:4px;">審査について</div>
        <div style="font-size:14px; color:#334155; line-height:1.7;">
          応募＝展示確定ではありません。通常 <b>${slaHours} 時間以内</b> を目安に審査結果をご案内します。
          ${manageUrl ? '進捗は下記の管理ページから確認いただけます。' : ''}
        </div>
      </div>

      <div style="margin:16px 0;">
        ${manageButton}
        ${editLink}
      </div>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />

      <div style="font-size:13px; color:#6b7280; line-height:1.8;">
        <div>・よくある質問：<a href="${sanitizeUrl(faqUrl)}" style="color:${BRAND_HEX};">FAQ</a></div>
        <div>・ご利用規約：<a href="${sanitizeUrl(termsUrl)}" style="color:${BRAND_HEX};">利用規約</a></div>
        <div>・お問い合わせ：<a href="mailto:${escapeHtml(supportEmail)}" style="color:${BRAND_HEX};">${escapeHtml(supportEmail)}</a></div>
      </div>

      <p style="margin-top:24px;font-size:13px;color:#6b7280;">本メールは送信専用です。ご返信いただいても対応できませんのでご了承ください。</p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">© me-ish 運営事務局</p>
    </div>
  </div>`;

  const text = `${name} 様

この度は、me-ishへの作品応募ありがとうございます。以下の内容で受付いたしました。
${entryTitle ? `作品名：${entryTitle}\n` : ''}応募ギャラリー：${galleryLabel}
販売形式：${salesLabel}
${priceYen != null ? `予定販売価格：¥${fmt(priceYen)}\n` : ''}${editionTotal != null ? `エディション数：${editionTotal} 点\n` : ''}応募日時：${submittedAtStr}

[審査について]
応募＝展示確定ではありません。通常 ${slaHours} 時間以内を目安に審査結果をご案内します。
${manageUrl ? `応募を管理する：${manageUrl}\n` : ''}${editUrl ? `応募内容を修正する：${editUrl}\n` : ''}

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

// ──────────────────────────────
// utils
// ──────────────────────────────

// 簡易なHTMLエスケープ（名前・作品名などの混入対策）
function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// URLを最低限サニタイズ（http/httpsのみ許可）
function sanitizeUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return url;
  } catch {
    /* noop */
  }
  return '#';
}
