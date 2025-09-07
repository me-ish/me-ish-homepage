// --- /lib/emailTemplates/reject.ts ---
const BRAND_HEX = '#00a1e9';

export function generateRejectEmail(name: string, reason?: string) {
  const preheader = '審査結果のお知らせ（今回はご期待に添えませんでした）。';
  const reasonHtml = reason
    ? `<p style="margin:0 0 12px 0;">理由：${escapeHtml(reason)}</p>`
    : '';

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,Arial,sans-serif;font-size:16px;color:#333;">
      <!-- preheader -->
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:18px;font-weight:700;color:${BRAND_HEX};">me-ish</div>
        <div style="font-size:12px;color:#9ca3af;">アートを、もっと近くに</div>
      </div>

      <p>${escapeHtml(name)} 様</p>
      <p>この度は <strong>me-ish</strong> に作品をご応募いただき、誠にありがとうございました。</p>
      <p>慎重に審査を行いました結果、今回はご期待に添えない結果となりました。</p>
      ${reasonHtml}
      <p>またの機会がございましたら、ぜひご応募いただけますと幸いです。</p>

      <p style="margin-top: 2em; font-size:12px; color:#6b7280;">※本メールは送信専用です。ご返信いただいても対応できませんのでご了承ください。</p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">© me-ish運営事務局</p>
    </div>
  `;

  const text = `${name} 様

この度はme-ishに作品をご応募いただき、誠にありがとうございました。
慎重に審査を行いました結果、今回はご期待に添えない結果となりました。
${reason ? `理由：${reason}\n` : ''}またの機会がございましたら、ぜひご応募いただけますと幸いです。

※本メールは送信専用です。
© me-ish運営事務局`;

  return {
    subject: '【me-ish】審査結果のお知らせ',
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
