// --- /lib/emailTemplates/purchaseBuyer.ts テスト ---
export function generatePurchaseBuyerEmail(name: string) {
  return {
    subject: '【me-ish】ご購入ありがとうございます',
    html: `<div style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; color: #333;">
      <p>${name} 様</p>
      <p>この度はme-ishでの作品ご購入、誠にありがとうございました。</p>
      <p>お支払いが完了し、作品の納品準備を進めております。</p>
      <p>NFTや画像データの送付に関するご案内も別途お送りいたします。</p>
      <p style="margin-top: 2em;">---<br/>me-ish運営事務局</p>
    </div>`,
    text: `${name} 様\n\nこの度はme-ishでの作品ご購入、誠にありがとうございました。\nお支払いが完了し、作品の納品準備を進めております。\nNFTや画像データの送付に関するご案内も別途お送りいたします。\n\n---\nme-ish運営事務局`,
  };
}
