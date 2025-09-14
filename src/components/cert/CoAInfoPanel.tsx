'use client';
import React from 'react';

type EntryForCoA = {
  // 最低限このコンポーネントで使う項目だけ定義（他が来ても無視できるようにしておく）
  title: string;
  artist_name?: string | null;
  edition_total?: number | null;
  edition_sold?: number | null;
  purchaser_display_name?: string | null;
  purchased_at?: string | null;
  token_id?: string | number | null;
  contract_address?: string | null;
};

interface Props {
  entry: EntryForCoA & Record<string, unknown>; // 追加フィールドが来ても受け取れるように
  showOnchain?: boolean; // NFT時のみ true
}

export default function CoAInfoPanel({ entry, showOnchain }: Props) {
  // edition 表示組み立て
  const edition =
    entry.edition_total
      ? `${entry.edition_sold ?? 0} / ${entry.edition_total}`
      : '';

  // on-chain リンク
  const tokenId =
    entry.token_id != null ? String(entry.token_id) : null;
  const address = entry.contract_address || null;

  // よく使うチェーンのエクスプローラ（必要に応じて調整）
  const explorer = (addrOrToken?: 'address' | 'token') => {
    if (!address) return null;
    // Polygon メインネット想定
    const base = 'https://polygonscan.com';
    if (addrOrToken === 'address') return `${base}/address/${address}`;
    if (addrOrToken === 'token' && tokenId) return `${base}/token/${address}?a=${tokenId}`;
    return null;
  };

  return (
    <section className="rounded-2xl border border-gray-200 p-6 bg-white">
      <h2 className="text-xl font-bold mb-4">Certificate of Authenticity</h2>

      <div id="coa-printable" className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <Row label="Title"   value={entry.title} />
        <Row label="Artist"  value={entry.artist_name ?? ''} />

        {!!edition && <Row label="Edition" value={edition} />}

        {entry.purchaser_display_name ? (
          <Row label="Purchaser" value={entry.purchaser_display_name} />
        ) : null}

        {entry.purchased_at ? (
          <Row label="Purchased At" value={toJP(entry.purchased_at)} />
        ) : null}

        {showOnchain && address ? (
          <>
            <Row
              label="Contract"
              value={short(address)}
              link={explorer('address') || undefined}
            />
            {tokenId ? (
              <Row
                label="Token ID"
                value={tokenId}
                link={explorer('token') || undefined}
              />
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

function toJP(d: string) {
  try {
    return new Date(d).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d;
  }
}

function short(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
}
