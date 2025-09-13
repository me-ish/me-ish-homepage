"use client";
import React from "react";
import ArtworkDownloadButton from "./ArtworkDownloadButton";
import NftClaimButton from "./NftClaimButton";


interface Props {
salesType: "normal" | "nft";
labels: {
sectionTitle: string;
normalNote: string;
normalDownloadBtn: string;
nftNote: string;
nftConnectBtn: string;
nftGasNote: string;
};
artworkHref: string; // /api/files/download?certToken=...
onNftClaim?: () => void;
showOffchainDownloadInNft?: boolean;
}


export default function AssetsReceiveSection({ salesType, labels, artworkHref, onNftClaim, showOffchainDownloadInNft }: Props) {
return (
<section className="rounded-2xl border border-gray-200 p-6 bg-white">
<h3 className="text-lg font-semibold mb-3">{labels.sectionTitle}</h3>
{salesType === "normal" ? (
<div className="space-y-3">
<p className="text-sm text-gray-700">{labels.normalNote}</p>
<ArtworkDownloadButton href={artworkHref} label={labels.normalDownloadBtn} />
</div>
) : (
<div className="space-y-3">
<p className="text-sm text-gray-700">{labels.nftNote}</p>
<NftClaimButton onClick={onNftClaim || (() => {})} label={labels.nftConnectBtn} />
{showOffchainDownloadInNft && (
<ArtworkDownloadButton href={artworkHref} label={labels.normalDownloadBtn} />
)}
<p className="text-xs text-gray-500">{labels.nftGasNote}</p>
</div>
)}
</section>
);
}