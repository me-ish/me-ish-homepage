// --- /lib/emailTemplates/exhibitStart.ts ---
export function generateExhibitStartEmail(name: string) {
  return {
    subject: '【me-ish】展示が開始されました',
    html: `<div style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; color: #333;">
      <p>${name} 様</p>
      <p>ご出展いただいた作品の展示が本日より開始されました。</p>
      <p>me-ishギャラリーにて多くの方にご覧いただけます。</p>
      <p>ご参加、誠にありがとうございます。</p>
      <p style="margin-top: 2em;">---<br/>me-ish運営事務局</p>
    </div>`,
    text: `${name} 様\n\nご出展いただいた作品の展示が本日より開始されました。\nme-ishギャラリーにて多くの方にご覧いただけます。\nご参加、誠にありがとうございます。\n\n---\nme-ish運営事務局`,
  };
}
