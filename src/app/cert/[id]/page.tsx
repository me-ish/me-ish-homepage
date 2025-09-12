// app/cert/[id]/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { createThirdwebClient } from 'thirdweb';
import { ThirdwebProvider, ConnectButton, useActiveAccount } from 'thirdweb/react';
import { inAppWallet, createWallet /*, walletConnect */ } from 'thirdweb/wallets';
import { polygon } from 'thirdweb/chains';

type CoAType = 'nft' | 'normal';

type PageProps = {
  params: { id: string };
  searchParams?: {
    type?: CoAType; title?: string; artist?: string; t?: string;
    tokenId?: string; qty?: string; entry?: string;
  };
};

const CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || '';
const TW_CLIENT = CLIENT_ID ? createThirdwebClient({ clientId: CLIENT_ID }) : null;

function CoAInner({ params, searchParams }: PageProps) {
  const account = useActiveAccount();

  const type: CoAType = (searchParams?.type === 'normal' ? 'normal' : 'nft');
  const title = searchParams?.title ?? 'Untitled';
  const artist = searchParams?.artist ?? 'Unknown Artist';
  const tokenId = useMemo(() => Number(searchParams?.tokenId ?? '0'), [searchParams?.tokenId]);
  const quantity = useMemo(() => Number(searchParams?.qty ?? '1'), [searchParams?.qty]);
  const entryId = searchParams?.entry ?? '';
  const token = searchParams?.t ?? '';

  const [loading, setLoading] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const canClaim = type === 'nft' && !!account?.address && !loading;
  const polygonscanTx = (h: string) => `https://polygonscan.com/tx/${h}`;

  async function handleClaim() {
    if (!account?.address) return;
    setLoading(true);
    setErr(null);
    setHash(null);
    try {
      const res = await fetch('/api/nft/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: account.address, tokenId, quantity }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Claim failed');
      setHash(json.hash);
    } catch (e: any) {
      setErr(e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    setLoading(true);
    setErr(null);
    try {
      if (!entryId) throw new Error('missing entry id');
      const url = `/api/cert/download?entry=${encodeURIComponent(entryId)}${token ? `&t=${encodeURIComponent(token)}` : ''}`;
      window.location.href = url;
      setDownloaded(true);
    } catch (e: any) {
      setErr(e?.message ?? 'Download failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Certificate of Authenticity</h1>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="font-mono">Order #{params.id}</span>
            <span className="mx-1">•</span>
            {type === 'nft'
              ? <span className="inline-flex items-center rounded-full bg-emerald-900/40 px-2 py-0.5 text-emerald-300 border border-emerald-700/40">NFT</span>
              : <span className="inline-flex items-center rounded-full bg-sky-900/40 px-2 py-0.5 text-sky-300 border border-sky-700/40">Normal</span>}
          </div>
        </header>

        <section className="rounded-2xl border border-zinc-800 p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <InfoRow label="Title" value={title} />
            <InfoRow label="Artist" value={artist} />
            {type === 'nft' ? (
              <>
                <InfoRow label="Token ID" value={String(tokenId)} mono />
                <InfoRow label="Quantity" value={String(quantity)} mono />
              </>
            ) : (
              <>
                <InfoRow label="Deliverable" value="Digital file (secure link)" />
                <InfoRow label="License" value="For personal use (see Terms)" />
              </>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-zinc-400">
              {type === 'nft' ? 'Sign in (email or wallet) to receive your NFT.' : 'Sign in is optional for normal purchases.'}
            </div>

            {TW_CLIENT ? (
              <ConnectButton
                client={TW_CLIENT}
                chain={polygon}
                wallets={[
                  inAppWallet({ auth: { options: ['email', 'google', 'apple'] } }),
                  createWallet('io.metamask'),
                  // walletConnect({ projectId: 'YOUR_WALLETCONNECT_PROJECT_ID' }),
                ]}
                theme="dark"
                connectModal={{ size: 'compact', title: type === 'nft' ? 'Receive your NFT' : 'Sign in (optional)' }}
              />
            ) : (
              <div className="text-xs text-amber-300 border border-amber-500/40 rounded-md px-2 py-1">
                NEXT_PUBLIC_THIRDWEB_CLIENT_ID not set
              </div>
            )}
          </div>

          {type === 'nft' ? (
            <button
              onClick={handleClaim}
              disabled={!canClaim}
              className={`w-full rounded-xl px-4 py-3 font-medium transition
                ${canClaim ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'}`}
            >
              {loading ? 'Claiming…' : 'Claim to this wallet'}
            </button>
          ) : (
            <button
              onClick={handleDownload}
              disabled={loading}
              className={`w-full rounded-xl px-4 py-3 font-medium transition
                ${!loading ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'}`}
            >
              {loading ? 'Preparing…' : 'Download your file'}
            </button>
          )}

          {hash && type === 'nft' && (
            <div className="text-sm">
              ✅ Claimed! Tx{' '}
              <a className="underline" href={polygonscanTx(hash)} target="_blank" rel="noreferrer">
                {hash.slice(0, 10)}…{hash.slice(-6)}
              </a>
            </div>
          )}
          {downloaded && type === 'normal' && (
            <div className="text-sm text-zinc-300">✅ Download started. If it didn’t, please try again or contact support.</div>
          )}
          {err && <div className="text-sm text-rose-400">⚠️ {err}</div>}
        </section>

        <footer className="text-xs text-zinc-500 space-y-1">
          <p>This page may require a valid token. Request a new link if it has expired.</p>
          <p>Gas fees for NFT claims are covered by the gallery.</p>
        </footer>
      </div>
    </main>
  );
}

export default function CoAPage(props: PageProps) {
  if (!TW_CLIENT) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-sm text-amber-300 border border-amber-500/40 rounded-md px-3 py-2">
          NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set.
        </div>
      </main>
    );
  }
  return (
    <ThirdwebProvider>
      <CoAInner {...props} />
    </ThirdwebProvider>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="text-zinc-400">{label}</div>
      <div className={mono ? 'font-mono' : ''}>{value}</div>
    </div>
  );
}
