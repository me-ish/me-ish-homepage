"use client";
import React from "react";
// 必要なら thirdweb/react をimportしてEmbedded Walletの導線に差し替え可能


export default function NftClaimButton({ onClick, label }: { onClick: () => void; label: string }) {
return (
<button
className="w-full rounded-xl py-3 font-medium bg-[#00a1e9] text-white hover:bg-[#0092d2]"
onClick={onClick}
>
{label}
</button>
);
}