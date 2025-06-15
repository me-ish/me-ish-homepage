// --- /lib/emailTemplates/pass.ts ---
export function generatePassEmail(name: string, externalUserId: string) {
  const linkUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/link?external_user_id=${externalUserId}`;

  return {
    subject: '【me-ish】作品が審査を通過しました',
    html: `
      <div style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; color: #333;">
        <p>${name} 様</p>
        <p>この度は <strong>me-ish</strong> に作品をご応募いただき、誠にありがとうございました。</p>
        <p>ご応募いただいた作品は審査を通過し、展示が決定いたしました。</p>
        <p>今後のご連絡や作品管理のため、以下のリンクからログインの紐づけをお願いいたします（初回のみ）。</p>
        <p><a href="${linkUrl}">${linkUrl}</a></p>
        <p style="margin-top: 2em;">---<br/>me-ish運営事務局</p>
      </div>
    `,
    text: `${name} 様\n\nこの度はme-ishに作品をご応募いただき、誠にありがとうございました。\n\nご応募いただいた作品は審査を通過し、展示が決定いたしました。\n今後のご連絡や作品管理のため、以下のリンクからログインの紐づけをお願いいたします（初回のみ）。\n\n${linkUrl}\n\n---\nme-ish運営事務局`,
  };
}
