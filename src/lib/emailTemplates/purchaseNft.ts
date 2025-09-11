// --- /lib/emailTemplates/purchaseNft.ts ---
export type PurchaseNftEmailArgs = {
  name: string;                 // 宛名（必須）
  title: string;                // 作品名（必須）
  tokenId: string | number;     // Token ID（必須）
  claimUrl: string;             // 受け取りURL（必須）

  // 追加情報（任意）
  network?: string;             // 例: 'Polygon', 'Ethereum', 'Astar' など
  contractAddress?: string;     // コントラクトアドレス（任意・表示のみ）
  explorerTokenUrl?: string;    // トークンをExplorerで開くURL（任意）
  explorerTxUrl?: string;       // TXをExplorerで開くURL（任意）

  // CoA（購入証明）
  certificateUrl?: string;      // ★ 購入証明（CoA）URL（任意）
  coaUrl?: string;              // ★ 互換キー（上とどちらかあればOK）

  // 共通リンク（任意）
  manageUrl?: string;           // 注文/購入内容の確認
  receiptUrl?: string;          // 領収書/明細URL

  // 定型リンク・連絡先（任意）
  faqUrl?: string;              // 既定: /faq
  termsUrl?: string;            // 既定: /footer/terms
  supportEmail?: string;        // 既定: support@me-ish.art

  // メタ
  expiresAtISO?: string;        // 受け取りリンクの有効期限（任意）
  note?: string;                // 追記メモ（任意）
};

const BRAND_HEX = '#00a1e9';

// 後方互換: 旧 (name, title, tokenId, claimUrl) でも呼べる
export function generatePurchaseNftEmail(
  a: PurchaseNftEmailArgs | string,
  titleLegacy?: string,
  tokenIdLegacy?: string,
  claimUrlLegacy?: string
) {
  const args: PurchaseNftEmailArgs =
    typeof a === 'string'
      ? { name: a, title: titleLegacy || '', tokenId: tokenIdLegacy || '', claimUrl: claimUrlLegacy || '' }
      : a;

  const {
    name,
    title,
    tokenId,
    claimUrl,
    network,
    contractAddress,
    explorerTokenUrl,
    explorerTxUrl,
    manageUrl,
    receiptUrl,
    faqUrl = 'https://me-ish.art/faq',
    termsUrl = 'https://me-ish.art/footer/terms',
    supportEmail = 'support@me-ish.art',
    expiresAtISO,
    note,
  } = args;

  // CoAリンク（certificateUrl優先、なければcoaUrl）
  const certificateUrl = args.certificateUrl ?? args.coaUrl ?? undefined;

  const tokenIdStr = String(tokenId);
  const preheader = 'NFTの受け取り手続き／購入証明（CoA）リンクをご案内します。';
  const expStr = expiresAtISO
    ? new Date(expiresAtISO).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    : '';

  const rows: string[] = [];
  rows.push(row('作品名', escapeHtml(title)));
  rows.push(row('Token ID', escapeHtml(tokenIdStr)));
  if (network) rows.push(row('ネットワーク', escapeHtml(network)));
  if (contractAddress) rows.push(row('Contract', `<code>${escapeHtml(contractAddress)}</code>`));

  const primaryCta = `
    <a href="${sanitizeUrl(claimUrl)}"
       style="display:inline-block;padding:12px 18px;border-radius:10px;background:${BRAND_HEX};color:#fff;text-decoration:none;font-weight:700;">
       受け取り手続きへ
    </a>`.trim();

  const secondaryCtas = [
    certificateUrl
      ? `<a href="${sanitizeUrl(certificateUrl)}"
            style="display:inline-block;padding:10px 14px;border-radius:10px;border:1px solid ${BRAND_HEX};color:${BRAND_HEX};text-decoration:none;font-weight:700;margin-right:8px;">
            購入証明（CoA）を表示
         </a>`
      : '',
    explorerTokenUrl
      ? `<a href="${sanitizeUrl(explorerTokenUrl)}"
            style="display:inline-block;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;color:#334155;text-decoration:none;font-weight:700;margin-right:8px;">
            Explorerでトークンを見る
         </a>`
      : '',
    explorerTxUrl
      ? `<a href="${sanitizeUrl(explorerTxUrl)}"
            style="display:inline-block;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;color:#334155;text-decoration:none;font-weight:700;margin-right:8px;">
            トランザクションを確認
         </a>`
      : '',
    manageUrl
      ? `<a href="${sanitizeUrl(manageUrl)}"
            style="display:inline-block;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;color:#334155;text-decoration:none;font-weight:700;margin-right:8px;">
            購入内容を確認
         </a>`
      : '',
    receiptUrl
      ? `<a href="${sanitizeUrl(receiptUrl)}"
            style="display:inline-block;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;color:#334155;text-decoration:none;font-weight:700;">
            領収書を見る
         </a>`
      : '',
  ]
    .filter(Boolean)
    .join('');

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
      <p style="margin:0 0 12px 0;">この度は <strong>me-ish</strong> にて NFT 作品をご購入いただき、誠にありがとうございます。以下のリンクより NFT をお受け取りください。</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0 8px 0;">
        <tbody>${rows.join('')}</tbody>
      </table>

      <div style="margin:16px 0 8px 0;">${primaryCta}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:6px;">
        クリックできない場合は次のURLをブラウザに貼り付けてください：<br/>
        <a href="${sanitizeUrl(claimUrl)}" style="color:${BRAND_HEX};">${escapeHtml(claimUrl)}</a>
      </div>

      <div style="margin:14px 0 0 0; padding:12px; background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px;">
        <div style="font-weight:700; margin-bottom:4px;">受け取りのヒント</div>
        <div style="font-size:14px; color:#334155; line-height:1.7;">
          初めての方は、受け取りページの案内に沿って<b>ウォレットの作成/接続</b>を行えます。${
            network ? `ネットワークは <b>${escapeHtml(network)}</b> をお使いください。` : ''
          }${expStr ? ` 受け取りリンクの有効期限：<b>${escapeHtml(expStr)}</b>` : ''}
          ${certificateUrl ? '<br/>※ 購入証明（CoA）は下記リンクからいつでも表示・ダウンロードできます。' : ''}
        </div>
      </div>

      ${secondaryCtas ? `<div style="margin:14px 0 0 0;">${secondaryCtas}</div>` : ''}

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

  const lines: string[] = [];
  lines.push(`${name} 様\n`);
  lines.push('この度は me-ish にて NFT 作品をご購入いただき、誠にありがとうございます。\n以下のリンクより NFT をお受け取りください。\n');
  lines.push(`作品名：${title}`);
  lines.push(`Token ID：${tokenIdStr}`);
  if (network) lines.push(`ネットワーク：${network}`);
  if (contractAddress) lines.push(`Contract：${contractAddress}`);
  lines.push('\n[NFT受け取りページ]');
  lines.push(claimUrl);
  if (expStr) lines.push(`\n受け取りリンクの有効期限：${expStr}`);
  if (certificateUrl) lines.push(`\n購入証明（CoA）：${certificateUrl}`);
  if (explorerTokenUrl) lines.push(`Explorer（トークン）：${explorerTokenUrl}`);
  if (explorerTxUrl) lines.push(`Explorer（トランザクション）：${explorerTxUrl}`);
  if (manageUrl) lines.push(`購入内容を確認：${manageUrl}`);
  if (receiptUrl) lines.push(`領収書を見る：${receiptUrl}`);
  lines.push(`\nFAQ：${faqUrl}\n利用規約：${termsUrl}\nお問い合わせ：${supportEmail}\n\n※本メールは送信専用です。`);

  return {
    subject: '【me-ish】NFTを発行しました（受け取りのご案内）',
    html,
    text: lines.join('\n'),
  };
}

/* ----- utils ----- */
function row(label: string, value: string) {
  const tdL = 'width:50%;padding:8px 0;color:#555;';
  const tdR = 'width:50%;padding:8px 0;text-align:right;';
  return `<tr><td style="${tdL}">${label}</td><td style="${tdR}">${value}</td></tr>`;
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
