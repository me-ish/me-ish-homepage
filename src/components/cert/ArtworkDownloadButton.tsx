"use client";
import React from "react";


export default function ArtworkDownloadButton({ href, label }: { href: string; label: string }) {
return (
<button
className="w-full rounded-xl py-3 font-medium bg-white text-black border border-gray-200 hover:bg-gray-50"
onClick={() => (location.href = href)}
>
{label}
</button>
);
}