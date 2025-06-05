// --- /lib/emailTemplates/submit.ts 　---
export function generateSubmitEmail(name: string) {
  return {
    subject: '【me-ish】作品応募を受け付けました',
    html: `
      <div style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; color: #333;">
        <p>${name} 様</p>
        <p>この度は <strong>me-ish</strong> に作品をご応募いただき、誠にありがとうございます。</p>
        <p>内容を確認のうえ、数日以内に審査結果をご連絡いたします。</p>
        <p style="margin-top: 2em;">---<br/>me-ish運営事務局</p>
      </div>
    `,
    text: `${name} 様\n\nこの度はme-ishに作品をご応募いただき、誠にありがとうございます。\n内容を確認のうえ、数日以内に審査結果をご連絡いたします。\n\n---\nme-ish運営事務局`,
  };
}