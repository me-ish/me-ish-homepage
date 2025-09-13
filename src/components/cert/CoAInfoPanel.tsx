"use client";
import React from "react";


interface Props {
entry: {
title: string;
artist_name?: string | null;
edition_total?: number | null;
edition_sold?: number | null;
purchaser_display_name?: string | null;
purchased_at?: string | null;
token_id?: number | null;
contract_address?: string | null;
};
showOnchain?: boolean; // NFT時のみ true
}


export default function CoAInfoPanel({ entry, showOnchain }: Props) {
return (
<section className="rounded-2xl border border-gray-200 p-6 bg-white">
<h2 className="text-xl font-bold mb-4">Certificate of Authenticity</h2>
<div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
<Row label="Title" value={entry.title} />
<Row label="Artist" value={entry.artist_name ?? ""} />
{entry.edition_total ? (
<Row label="Edition" value={`${entry.edition_sold ?? 0}/${entry.edition_total}`} />
) : null}
{entry.purchaser_display_name ? (
<Row label="Purchaser" value={entry.purchaser_display_name} />
) : null}
{entry.purchased_at ? (
<Row label="Purchase Date" value={new Date(entry.purchased_at).toISOString().slice(0, 10)} />
) : null}
{showOnchain && entry.token_id != null ? (
<>
<Row label="Token ID" value={`#${entry.token_id}`} />
{entry.contract_address ? (
<Row label="Contract" value={short(entry.contract_address)} link={`https://polygonscan.com/token/${entry.contract_address}`} />
) : null}
</>
) : null}
</div>
</section>
);
}


function Row({ label, value, link }: { label: string; value: string; link?: string }) {
return (
<div className="flex justify-between border-b py-2">
<span className="text-gray-500">{label}</span>
{link ? (
<a href={link} target="_blank" rel="noreferrer" className="font-medium text-right underline">
{value}
</a>
) : (
<span className="font-medium text-right">{value}</span>
)}
</div>
);
}


function short(addr: string) {
return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}