// app/claim/[id]/page.tsx
'use client';

import { useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createThirdwebClient } from 'thirdweb';
import { ConnectButton, useActiveAccount } from 'thirdweb/react';
import { inAppWallet, createWallet, walletConnect } from 'thirdweb/wallets';

type PageProps = { params: { id: string } };

// ------- env / utils -------
const CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || '';
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || '';
const CHAIN_NAME = (process.env.NEXT_PUBLIC_CHAIN_NAME || 'polygon').toLowerCase();

const twClient = CLIENT_ID ? createThirdwebClient({ clientId: CLIENT_ID }) : null;

function scanBase(chain: string) {
  switch (chain) {
    case 'amoy':
    case 'polygon-amoy':
      return 'https://amoy.polygonscan.com';
    case 'mumbai':
    case 'polygon-mumbai':
      return 'https://mumbai.polygonscan.com';
    default:
      return 'https://polygonscan.com';
  }
}

// ------- page -------
export default function ClaimPage({ params }: PageProps) {
  const sp = useSearchParams();
  const account = useActiveAccount();

  // CoAページから渡ってくる任意のパラメータ
  const tokenParam = sp.get('t') || '';                      // 署名用トークン等があるなら一緒に渡す
  const tokenId = useMemo(() => Number(sp.get('tokenId') ?? '0'), [sp]);
  const quantity = useMemo(() => Math.max(1, Number(sp.get('qty') ?? '1')), [sp]);

  const [loading, setLoading] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canClaim = !!account?.address && !!twClient && !loading;
  const polygonscanTx = useCallback(
    (h: string) => `${scanBase(CHAIN_NAME)}/tx/${h}`,
    []
  );

  const handleClaim = useCallback(async () => {
    if (!account?.address || !twClient) return;
    setLoading(true);
    setErr(null);
    setHash(null);
    try {
      // 必要に応じてサーバ側で検証するための追加情報も送る
      const res = await fetch('/api/nft/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to: account.address,
          entryId: Number(params.id),
          token: tokenParam,        // ← サーバで検証に使うなら
          tokenId,
          quantity,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !json?.hash) {
        throw new Error(json?.error || 'Claim failed');
      }
      setHash(json.hash as string);
    } catch (e: any) {
      setErr(e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [account?.address, params.id, quantity, tokenId, tokenParam]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Claim your NFT</h1>
          <div className="text-sm text-zinc-400">
            Order <span className="font-mono">#{params.id}</span>
          </div>
        </header>

        <section className="rounded-2xl border border-zinc-800 p-4 space-y-4">
          {twClient ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-zinc-400">
                Sign in to receive your NFT
              </span>
              <ConnectButton
                client={twClient}
                wallets={[
                  inAppWallet({ auth: { options: ['email', 'google', 'apple'] } }),
                  createWallet('io.metamask'),
                  ...(WC_PROJECT_ID ? [walletConnect()] : []),
                ]}
                theme="dark"
                connectModal={{ size: 'compact', title: 'Receive your NFT' }}
              />
            </div>
          ) : (
            <div className="text-xs text-amber-300 border border-amber-500/40 rounded-md px-2 py-1">
              NEXT_PUBLIC_THIRDWEB_CLIENT_ID not set
            </div>
          )}

          <button
            onClick={handleClaim}
            disabled={!canClaim}
            className={`w-full rounded-xl px-4 py-3 font-medium transition
              ${canClaim ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'}`}
          >
            {loading ? 'Claiming…' : 'Claim to this wallet'}
          </button>

          {hash && (
            <div className="text-sm">
              ✅ Claimed! Tx{' '}
              <a className="underline" href={polygonscanTx(hash)} target="_blank" rel="noreferrer">
                {hash.slice(0, 10)}…{hash.slice(-6)}
              </a>
            </div>
          )}
          {err && <div className="text-sm text-rose-400">⚠️ {err}</div>}
        </section>

        <footer className="text-xs text-zinc-500 space-y-1">
          <p>Gas fees may be covered by the gallery if enabled.</p>
          <p>If something goes wrong, please retry or contact support.</p>
        </footer>
      </div>
    </main>
  );
}
