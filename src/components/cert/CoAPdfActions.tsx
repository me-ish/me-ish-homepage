"use client";
import React from "react";


export default function CoAPdfActions({ downloadHref, note }: { downloadHref: string; note: string }) {
return (
<section className="rounded-2xl border border-gray-200 p-6 bg-white">
<button
className="w-full rounded-xl py-3 font-medium bg-black text-white hover:bg-black/90"
onClick={() => (location.href = downloadHref)}
>
証明書（PDF）をダウンロード
</button>
<p className="mt-2 text-xs text-gray-500">{note}</p>
</section>
);
}