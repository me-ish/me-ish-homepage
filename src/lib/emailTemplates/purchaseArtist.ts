// --- /lib/emailTemplates/purchaseArtist.ts  ---
export function generatePurchaseArtistEmail(name: string) {
  return {
    subject: '【me-ish】あなたの作品が購入されました',
    html: `<div style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; color: #333;">
      <p>${name} 様</p>
      <p>me-ishでご出展中の作品が購入されました。</p>
      <p>販売報酬については、近日中に詳細をご連絡いたします。</p>
      <p>この度はご出展いただき誠にありがとうございました。</p>
      <p style="margin-top: 2em;">---<br/>me-ish運営事務局</p>
    </div>`,
    text: `${name} 様\n\nme-ishでご出展中の作品が購入されました。\n販売報酬については、近日中に詳細をご連絡いたします。\nこの度はご出展いただき誠にありがとうございました。\n\n---\nme-ish運営事務局`,
  };
}
