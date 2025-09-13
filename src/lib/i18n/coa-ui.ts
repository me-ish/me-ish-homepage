export const coaUi = {
ja: {
heroNote:
"このページは購入証明書（CoA）です。作品データの受け取りは下の『作品データの受け取り』から行えます。",
pdfBtn: "証明書（PDF）をダウンロード",
assetsSectionTitle: "作品データの受け取り",
normalNote: "通常購入の場合、作品データは安全なリンクからダウンロードできます（期限あり）。",
normalDownloadBtn: "作品をダウンロード",
nftNote: "NFT購入の場合は、ウォレットを接続して受け取り（Claim）を行ってください。",
nftConnectBtn: "NFTを受け取る（ウォレット接続）",
nftGasNote: "NFT受け取り時のガス代はギャラリーが負担します。",
expiredNote:
"このページは有効なリンクが必要です。期限切れの場合は『リンク再発行』から新しいリンクを取得してください。",
reissueBtn: "リンク再発行",
backToGallery: "ギャラリーに戻る",
},
en: {
heroNote:
"This page is your Certificate of Authenticity. To receive your artwork files, use the section below.",
pdfBtn: "Download Certificate (PDF)",
assetsSectionTitle: "Receive your artwork files",
normalNote:
"For normal purchases, you can download the artwork via a secure link (expires).",
normalDownloadBtn: "Download artwork",
nftNote: "For NFT purchases, connect your wallet to claim.",
nftConnectBtn: "Claim NFT (connect wallet)",
nftGasNote: "Gas fees for NFT claims are covered by the gallery.",
expiredNote:
"This page may require a valid token. If it has expired, use 'Reissue link' to obtain a new one.",
reissueBtn: "Reissue link",
backToGallery: "Back to Gallery",
},
} as const;
export type CoALang = keyof typeof coaUi;