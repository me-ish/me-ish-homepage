export const coaUi = {
ja: {
heroNote:
"このページは購入証明書（CoA）です。作品データの受け取りは下の『作品データの受け取り』から行えます。",
pdfBtn: "証明書（PDF）をダウンロード",
assetsSectionTitle: "作品データの受け取り",
normalNote: "作品データは安全なリンクからダウンロードできます（期限あり）。",
normalDownloadBtn: "作品をダウンロード",
expiredNote:
"このページには有効な閲覧リンクが必要です。期限切れやリンク紛失の場合は運営にお問い合わせください。本人確認後に再発行します。",
reissueContactBtn: "再発行について問い合わせる",
unavailableNote: "現在、証明書を表示できません。時間をおいて再度お試しください。",
backToGallery: "ギャラリーに戻る",
},
en: {
heroNote:
"This page is your Certificate of Authenticity. To receive your artwork files, use the section below.",
pdfBtn: "Download Certificate (PDF)",
assetsSectionTitle: "Receive your artwork files",
normalNote:
"You can download the artwork via a secure link (expires).",
normalDownloadBtn: "Download artwork",
expiredNote:
"A valid viewing link is required. If your link has expired or is lost, contact support. Reissue requires identity verification.",
reissueContactBtn: "Contact support for reissue",
unavailableNote: "The certificate is temporarily unavailable. Please try again later.",
backToGallery: "Back to Gallery",
},
} as const;
export type CoALang = keyof typeof coaUi;