// --- /lib/emailTemplates/submit.ts ---
// 応募受付メール（後方互換対応 + entriesテーブル想定の拡張）
//
// ✅ 推奨表示項目（entries から拾う想定）
// - id                → entryId
// - title             → entryTitle
// - gallery_type      → galleryType ('WHITE'|'FLOAT'|'SPECIAL' など文字列OK)
// - is_for_sale       → isForSale (true/false)
// - sale_type         → salesType ('normal'|'nft' など文字列OK)
// - price             → priceYen（税込・数値）
// - edition_total     → editionTotal（数値）
// - display_plan      → displayPlan ('free'|'mini'|'light'|'standard'|'premium'|string)
// - created_at        → submittedAtISO（ISO文字列）
//
// ＊name はプロフィール/応募フォーム側の作家名（artist_name）を渡す想定
// ＊manageUrl/editUrl/faqUrl/termsUrl/supportEmail は運用URLを渡してください

export type SubmitEmailArgs = {
  name: string;                                   // 宛名（必須）← entries.artist_name を推奨
  entryId?: number | string;                       // entries.id
  entryTitle?: string;                             // entries.title
  galleryType?: 'WHITE' | 'FLOAT' | 'SPECIAL' | string; // entries.gallery_type
  isForSale?: boolean | null;                      // entries.is_for_sale
  salesType?: 'normal' | 'nft' | string;          // entries.sale_type
  priceYen?: number | null;                        // entries.price（税込想定）
  editionTotal?: number | null;                    // entries.edition_total
  displayPlan?: 'free' | 'mini' | 'light' | 'standard' | 'premium' | string | null; // entries.display_plan
  submittedAtISO?: string;                         // entries.created_at（ISO推奨）

  // リンク類
  manageUrl?: string;                              // マイページ：応募管理
  editUrl?: string;                                // 応募内容の修正
  faqUrl?: string;
  termsUrl?: string;
  supportEmail?: string;

  // 表現・文言
  slaHours?: number;                               // 審査目安（既定:72h）
};

const BRAND_HEX = '#00a1e9';

// 表示保証回数（プラン→回数）
const GUARANTEED_VIEWS: Record<string, number> = {
  free: 0,
  mini: 1,
  light: 3,
  standard: 7,
  premium: 15,
};

export function generateSubmitEmail(arg: string | SubmitEmailArgs) {
  // ── 後方互換：name だけの最小版 ──────────────────────────
  if (typeof arg === 'string') {
    const safeName = escapeHtml(arg);
    const preheader =
      '作品応募を受け付けました。通常72時間以内に審査結果をご案内します。';
    return {
      subject: '【me-ish】作品応募を受け付けました',
      html: `
        <div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,Arial,sans-serif; font-size: 16px; color: #333;">
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

  // ── 詳細版 ────────────────────────────────────────
  const {
    name,
    entryId,
    entryTitle,
    galleryType = 'WHITE',
    isForSale = null,
    salesType = 'normal',
    priceYen = null,
    editionTotal = null,
    displayPlan = null,
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
    : '';

  const galleryLabel = galleryLabelFrom(galleryType);
  const salesLabel = salesLabelFrom(salesType);
  const forSaleLabel =
    isForSale === null ? '' : isForSale ? 'あり' : 'なし';

  const nameHtml = escapeHtml(name);

  // 右カラム（値）に使う共通style（崩れ防止で width を揃える）
  const tdL = 'width:50%;padding:8px 0;color:#555;';
  const tdR = 'width:50%;padding:8px 0;text-align:right;';

  const rows: string[] = [];

  if (entryId !== undefined && entryId !== null && `${entryId}` !== '') {
    rows.push(`<tr><td style="${tdL}">応募ID</td><td style="${tdR}">${escapeHtml(
      String(entryId)
    )}</td></tr>`);
  }
  if (entryTitle) {
    rows.push(
      `<tr><td style="${tdL}">作品名</td><td style="${tdR}">${escapeHtml(
        entryTitle
      )}</td></tr>`
    );
  }

  rows.push(
    `<tr><td style="${tdL}">応募ギャラリー</td><td style="${tdR}">${escapeHtml(
      galleryLabel
    )}</td></tr>`
  );

  if (forSaleLabel) {
    rows.push(
      `<tr><td style="${tdL}">販売</td><td style="${tdR}">${forSaleLabel}</td></tr>`
    );
  }

  // 販売ありのときだけ詳細を追記
  const saleEnabled = isForSale === true || isForSale === null; // 不明=とりあえず表示許可
  if (saleEnabled) {
    rows.push(
      `<tr><td style="${tdL}">販売形式</td><td style="${tdR}">${escapeHtml(
        salesLabel
      )}</td></tr>`
    );
    if (priceYen != null) {
      rows.push(
        `<tr><td style="${tdL}">予定販売価格</td><td style="${tdR}">¥${fmt(
          priceYen
        )}</td></tr>`
      );
    }
    if (editionTotal != null) {
      rows.push(
        `<tr><td style="${tdL}">エディション数</td><td style="${tdR}">${editionTotal} 点</td></tr>`
      );
    }
  }

  // 表示プラン（あれば）
  if (displayPlan) {
    const planKey = String(displayPlan).toLowerCase();
    const guaranteed =
      GUARANTEED_VIEWS[planKey] !== undefined
        ? GUARANTEED_VIEWS[planKey]
        : undefined;
    rows.push(
      `<tr><td style="${tdL}">表示プラン</td><td style="${tdR}">${escapeHtml(
        String(displayPlan)
      )}</td></tr>`
    );
    if (guaranteed !== undefined) {
      rows.push(
        `<tr><td style="${tdL}">表示保証回数</td><td style="${tdR}">${guaranteed} 回</td></tr>`
      );
    }
  }

  if (submittedAtStr) {
    rows.push(
      `<tr><td style="${tdL}">応募日時</td><td style="${tdR}">${submittedAtStr}</td></tr>`
    );
  }

  const manageButton = manageUrl
    ? `<a href="${sanitizeUrl(
        manageUrl
      )}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:${BRAND_HEX};color:#fff;text-decoration:none;font-weight:700;">応募を管理する</a>`
    : '';

  const editLink = editUrl
    ? `<div style="margin-top:10px;"><a href="${sanitizeUrl(
        editUrl
      )}" style="font-size:14px;color:${BRAND_HEX};">応募内容を修正する</a></div>`
    : '';

  const preheader =
    '作品応募を受け付けました。（通常72時間以内に審査結果をご案内）。';

  const html = `
  <div style="background:#f7fafc;padding:24px 0;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,Arial,sans-serif;color:#1f2937;">
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:18px;font-weight:700;color:${BRAND_HEX};">me-ish</div>
        <div style="font-size:12px;color:#9ca3af;">アートを、もっと近くに</div>
      </div>

      <p style="margin:0 0 12px 0;">${nameHtml} 様</p>
      <p style="margin:0 0 16px 0;">この度は、me-ishへの作品応募ありがとうございます。以下の内容で受付いたしました。</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0 8px 0;">
        <tbody>
          ${rows.join('')}
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
        <div>・お問い合わせ：<a href="mailto:${escapeHtml(
          supportEmail
        )}" style="color:${BRAND_HEX};">${escapeHtml(supportEmail)}</a></div>
      </div>

      <p style="margin-top:24px;font-size:13px;color:#6b7280;">本メールは送信専用です。ご返信いただいても対応できませんのでご了承ください。</p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">© me-ish 運営事務局</p>
    </div>
  </div>`;

  const textLines: string[] = [];
  textLines.push(`${name} 様\n`);
  textLines.push('この度は、me-ishへの作品応募ありがとうございます。以下の内容で受付いたしました。\n');

  if (entryId !== undefined && entryId !== null && `${entryId}` !== '')
    textLines.push(`応募ID：${entryId}`);
  if (entryTitle) textLines.push(`作品名：${entryTitle}`);
  textLines.push(`応募ギャラリー：${galleryLabel}`);
  if (forSaleLabel) textLines.push(`販売：${forSaleLabel}`);

  if (saleEnabled) {
    textLines.push(`販売形式：${salesLabel}`);
    if (priceYen != null) textLines.push(`予定販売価格：¥${fmt(priceYen)}`);
    if (editionTotal != null) textLines.push(`エディション数：${editionTotal} 点`);
  }
  if (displayPlan) {
    textLines.push(`表示プラン：${displayPlan}`);
    const planKey = String(displayPlan).toLowerCase();
    if (GUARANTEED_VIEWS[planKey] !== undefined)
      textLines.push(`表示保証回数：${GUARANTEED_VIEWS[planKey]} 回`);
  }
  if (submittedAtStr) textLines.push(`応募日時：${submittedAtStr}`);

  textLines.push(
    `\n[審査について]\n応募＝展示確定ではありません。通常 ${slaHours} 時間以内を目安に審査結果をご案内します。`
  );
  if (manageUrl) textLines.push(`応募を管理する：${manageUrl}`);
  if (editUrl) textLines.push(`応募内容を修正する：${editUrl}`);

  textLines.push(`\nFAQ：${faqUrl}`);
  textLines.push(`利用規約：${termsUrl}`);
  textLines.push(`お問い合わせ：${supportEmail}`);
  textLines.push(`\n※本メールは送信専用です。\n© me-ish 運営事務局`);

  return {
    subject: '【me-ish】作品応募を受け付けました',
    html,
    text: textLines.join('\n'),
  };
}

// ────────────────────────────── utils

function galleryLabelFrom(t: string) {
  const v = String(t ?? '').toUpperCase();
  if (v === 'WHITE') return 'White ギャラリー（常設）';
  if (v === 'FLOAT') return 'Float ギャラリー（日替わり）';
  if (v === 'SPECIAL') return '特別テーマギャラリー';
  return t || '';
}

function salesLabelFrom(t: string) {
  const v = String(t ?? '').toLowerCase();
  if (v === 'nft') return 'NFT販売';
  return '通常販売';
}

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
function sanitizeUrl(url?: string) {
  if (!url) return '#';
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return url;
  } catch {
    /* noop */
  }
  return '#';
}
