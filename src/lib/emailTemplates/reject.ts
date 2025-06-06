// --- /lib/emailTemplates/reject.ts テスト---
export function generateRejectEmail(name: string) {
  return {
    subject: '【me-ish】審査結果のお知らせ',
    html: `
      <div style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; color: #333;">
        <p>${name} 様</p>
        <p>この度は <strong>me-ish</strong> に作品をご応募いただき、誠にありがとうございました。</p>
        <p>慎重に審査を行いました結果、今回はご期待に添えない結果となりました。</p>
        <p>またの機会がございましたら、ぜひご応募いただけますと幸いです。</p>
        <p style="margin-top: 2em;">---<br/>me-ish運営事務局</p>
      </div>
    `,
    text: `${name} 様\n\nこの度はme-ishに作品をご応募いただき、誠にありがとうございました。\n慎重に審査を行いました結果、今回はご期待に添えない結果となりました。\nまたの機会がございましたら、ぜひご応募いただけますと幸いです。\n\n---\nme-ish運営事務局`,
  };
}
