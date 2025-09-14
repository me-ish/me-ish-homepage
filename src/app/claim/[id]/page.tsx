// /src/app/claim/[id]/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createThirdwebClient } from 'thirdweb';
import { ThirdwebProvider, ConnectButton, useActiveAccount } from 'thirdweb/react';
import { inAppWallet, createWallet /*, walletConnect*/ } from 'thirdweb/wallets';

type PageProps = { params: { id: string } };

const CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || '';
const twClient = CLIENT_ID ? createThirdwebClient({ clientId: CLIENT_ID }) : null;

export default function ClaimPage({ params }: PageProps) {
  const sp = useSearchParams();
  const account = useActiveAccount(); // ← Provider の内側で呼ばれるようにする

  const tokenId = useMemo(() => Number(sp.get('tokenId') ?? '0'), [sp]);
  const quantity = useMemo(() => Number(sp.get('qty') ?? '1'), [sp]);

  const [loading, setLoading] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canClaim = !!account?.address && !!twClient && !loading;
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
        body: JSON.stringify({
          to: account.address,
          certToken: sp.get('t') || '',   // ← CoA から渡されたトークンを送る
          tokenId,                        // （API側で無視/上書きする設計でも可）
          quantity,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Claim failed');
      setHash(json.txhash);
    } catch (e: any) {
      setErr(e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    // ✅ client は渡さない。Provider で囲むだけ
    <ThirdwebProvider>
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
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Sign in to receive your NFT</span>
                <ConnectButton
                  client={twClient}
                  wallets={[
                    inAppWallet({ auth: { options: ['email', 'google', 'apple'] } }),
                    createWallet('io.metamask'),
                    // walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID! }),
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
    </ThirdwebProvider>
  );
}
