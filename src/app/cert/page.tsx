import type { Metadata } from "next";
import Link from "next/link";
import CoAInfoPanel from "@/components/cert/CoAInfoPanel";
import CoAPdfActions from "@/components/cert/CoAPdfActions";
import AssetsReceiveSection from "@/components/cert/AssetsReceiveSection";
import { coaUi } from "@/lib/i18n/coa-ui";
import { getEntryForCoA, resolveLangFromRequest, verifyCertToken, issueReissueLink } from "@/lib/coa/server";


export const metadata: Metadata = {
title: "Certificate | me-ish",
description: "Certificate of Authenticity (CoA)",
};


export default async function CertPage({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | string[] | undefined> }) {
const idNum = Number(params.id);
const search = new URLSearchParams(Object.entries(searchParams).flatMap(([k, v]) => (Array.isArray(v) ? v.map((vv) => [k, vv]) : [[k, v ?? ""]])));
const lang = await resolveLangFromRequest(search);
const t = coaUi[lang];


const token = search.get("t") || "";
const ver = await verifyCertToken(token);
if (!ver.ok) {
return (
<main className="min-h-[60vh] flex items-center justify-center px-4">
<div className="w-full max-w-[720px] bg-white p-8 rounded-2xl shadow-lg space-y-5 text-center">
<h1 className="text-2xl font-bold">CoA Link Error</h1>
<p className="text-gray-700">{t.expiredNote}</p>
<div className="flex gap-3 justify-center mt-4">
<Link className="px-4 py-2 rounded-xl bg-black text-white" href="/">
{t.backToGallery}
</Link>
<a className="px-4 py-2 rounded-xl bg-gray-200" href={await issueReissueLink(idNum, undefined)}>
{t.reissueBtn}
</a>
</div>
</div>
</main>
);
}


const entry = await getEntryForCoA(ver.entryId);
if (!entry) {
return (
<main className="min-h-[60vh] flex items-center justify-center px-4">
<div className="w-full max-w-[720px] bg-white p-8 rounded-2xl shadow-lg space-y-5 text-center">
<h1 className="text-2xl font-bold">Not Found</h1>
<p className="text-gray-700">The certificate record was not found.</p>
<Link className="inline-block px-4 py-2 rounded-xl bg-black text-white" href="/">
{t.backToGallery}
</Link>
</div>
</main>
);
}


const purchaseType = entry.sales_type as "normal" | "nft";
const site = process.env.NEXT_PUBLIC_SITE_URL || "";
const pdfHref = `${site}/api/cert/download?t=${encodeURIComponent(token)}`;
const artworkHref = `${site}/api/files/download?certToken=${encodeURIComponent(token)}`;


return (
<main className="min-h-[80vh] px-4 py-10">
<div className="mx-auto w-full max-w-[920px] space-y-8">
{/* ① 案内（日本語/英語） */}
<section className="rounded-2xl border border-gray-200 p-6 bg-white">
<p className="text-gray-800 text-sm">{t.heroNote}</p>
</section>


{/* ② 証明書本体（英語ラベル） */}
<CoAInfoPanel entry={entry} showOnchain={purchaseType === "nft"} />


{/* ③ 証明書PDF */}
<CoAPdfActions downloadHref={pdfHref} note={t.expiredNote} />


{/* ④ 作品データ受け取り */}
<AssetsReceiveSection
salesType={purchaseType}
labels={{
sectionTitle: t.assetsSectionTitle,
normalNote: t.normalNote,
normalDownloadBtn: t.normalDownloadBtn,
nftNote: t.nftNote,
nftConnectBtn: t.nftConnectBtn,
nftGasNote: t.nftGasNote,
}}
artworkHref={artworkHref}
onNftClaim={() => {
// ここに thirdweb の claim フローを接続（必要に応じて）
// 例）open('/claim/[id]?t=token') に遷移させる等
location.href = `${site}/claim/${entry.id}?t=${encodeURIComponent(token)}`;
}}
showOffchainDownloadInNft={false}
/>
</div>
</main>
);
}