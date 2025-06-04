// --- /lib/emailTemplates/pass.ts ---
export function generatePassEmail(name: string) {
  return {
    subject: '【me-ish】作品が審査を通過しました',
    html: `
      <div style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; color: #333;">
        <p>${name} 様</p>
        <p>この度は <strong>me-ish</strong> に作品をご応募いただき、誠にありがとうございました。</p>
        <p>ご応募いただいた作品は審査を通過し、展示が決定いたしました。</p>
        <p>今後の流れについては、改めて展示スケジュールをご案内いたします。</p>
        <p style="margin-top: 2em;">---<br/>me-ish運営事務局</p>
      </div>
    `,
    text: `${name} 様\n\nこの度はme-ishに作品をご応募いただき、誠にありがとうございました。\nご応募いただいた作品は審査を通過し、展示が決定いたしました。\n今後の流れについては、改めて展示スケジュールをご案内いたします。\n\n---\nme-ish運営事務局`,
  };
}