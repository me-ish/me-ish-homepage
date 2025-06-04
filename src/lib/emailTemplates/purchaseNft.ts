export function generatePurchaseNftEmail(name: string, title: string, tokenId: string, claimUrl: string) {
  return {
    subject: '【me-ish】NFT作品の受け取りリンクをお送りします',
    html: `<div style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; color: #333;">
      <p>${name} 様</p>
      <p>この度はme-ishにてNFT作品をご購入いただき、誠にありがとうございました。</p>
      <p>以下のNFTは、専用リンクから受け取りが可能です。</p>
      <ul>
        <li>🎨 作品名: ${title}</li>
        <li>🆔 Token ID: ${tokenId}</li>
      </ul>
      <p>
        ▶️ NFT受け取りページ：<br/>
        <a href="${claimUrl}" target="_blank">${claimUrl}</a>
      </p>
      <p style="margin-top: 2em;">
        ※ 初めての方は、画面の案内に従ってウォレットを作成・接続いただけます。
      </p>
      <p style="margin-top: 2em;">---<br/>me-ish運営事務局</p>
    </div>`,
    text: `${name} 様\n\nこの度はme-ishにてNFT作品をご購入いただき、誠にありがとうございました。\n\n以下のNFTは、専用リンクから受け取りが可能です。\n\n作品名: ${title}\nToken ID: ${tokenId}\n\nNFT受け取りURL:\n${claimUrl}\n\n※ 初めての方は、画面の案内に従ってウォレットを作成・接続いただけます。\n\n---\nme-ish運営事務局`
  };
}
