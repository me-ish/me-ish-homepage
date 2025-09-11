'use client';

import { useMemo, useState } from 'react';
import { createThirdwebClient } from 'thirdweb';
import { ConnectButton, useActiveAccount } from 'thirdweb/react';
import { inAppWallet, createWallet, walletConnect } from 'thirdweb/wallets';
import { polygon } from 'thirdweb/chains';

type CoAType = 'nft' | 'normal';

type PageProps = {
  params: { id: string };
  searchParams?: {
    // 共通（今回はクエリで簡易に受け取る。将来はサーバーで解決）
    type?: CoAType;           // 'nft' | 'normal'（既定は 'nft'）
    title?: string;
    artist?: string;
    t?: string;               // ワンタイムトークン（将来の検証用）
    // NFT向け
    tokenId?: string;         // 例: "0"
    qty?: string;             // 例: "1"
    // 通常向け
    entry?: string;           // Supabase entries.id（/api/cert/download に渡す）
  };
};

const CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || '';

export default function CoAPage({ params, searchParams }: PageProps) {
  const account = useActiveAccount();

  // ── 表示用データ（本番はAPIでサーバー確定に置き換え） ──────────────
  const type: CoAType = (searchParams?.type === 'normal' ? 'normal' : 'nft');
  const title = searchParams?.title ?? 'Untitled';
  const artist = searchParams?.artist ?? 'Unknown Artist';
  const tokenId = useMemo(() => Number(searchParams?.tokenId ?? '0'), [searchParams?.tokenId]);
  const quantity = useMemo(() => Number(searchParams?.qty ?? '1'), [searchParams?.qty]);
  const entryId = searchParams?.entry ?? '';
  const token = searchParams?.t ?? '';

  // ── thirdweb client（未設定なら接続UIを出さない） ───────────────────
  const hasClientId = CLIENT_ID.length > 0;
  const client = hasClientId ? createThirdwebClient({ clientId: CLIENT_ID }) : null;

  // ── UI 状態 ────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const canClaim = type === 'nft' && !!account?.address && !loading;
  const polygonscanTx = (h: string) => `https://polygonscan.com/tx/${h}`;

  // ── NFT 受け取り（claimTo API を叩く） ──────────────────────────
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
          tokenId,
          quantity,
        }),
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

  // ── 通常購入：ダウンロードAPIへリダイレクト ─────────────────────
  async function handleDownload() {
    setLoading(true);
    setErr(null);
    try {
      if (!entryId) throw new Error('missing entry id');
      const url =
        `/api/cert/download?entry=${encodeURIComponent(entryId)}` +
        (token ? `&t=${encodeURIComponent(token)}` : '');
      window.location.href = url; // 302 でサイン付きURLへ
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
        {/* ヘッダー */}
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Certificate of Authenticity</h1>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="font-mono">Order #{params.id}</span>
            <span className="mx-1">•</span>
            {type === 'nft' ? (
              <span className="inline-flex items-center rounded-full bg-emerald-900/40 px-2 py-0.5 text-emerald-300 border border-emerald-700/40">
                NFT
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-sky-900/40 px-2 py-0.5 text-sky-300 border border-sky-700/40">
                Normal
              </span>
            )}
          </div>
        </header>

        {/* 作品情報 */}
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

        {/* 接続 / アクション */}
        <section className="rounded-2xl border border-zinc-800 p-4 space-y-4">
          {/* 接続UI（NFTは必須、通常は任意） */}
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-zinc-400">
              {type === 'nft'
                ? 'Sign in (email or wallet) to receive your NFT.'
                : 'Sign in is optional for normal purchases.'}
            </div>

            {hasClientId ? (
              <ConnectButton
                client={client!}
                chains={[polygon]}
                wallets={[
                  inAppWallet({ auth: { options: ['email', 'google', 'apple'] } }),
                  createWallet('io.metamask'),
                  walletConnect(),
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

          {/* アクションボタン */}
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

          {/* 結果表示 */}
          {hash && type === 'nft' && (
            <div className="text-sm">
              ✅ Claimed! Tx:{' '}
              <a className="underline" href={polygonscanTx(hash)} target="_blank" rel="noreferrer">
                {hash.slice(0, 10)}…{hash.slice(-6)}
              </a>
            </div>
          )}
          {downloaded && type === 'normal' && (
            <div className="text-sm text-zinc-300">
              ✅ Download started. If it didn’t, please try again or contact support.
            </div>
          )}
          {err && <div className="text-sm text-rose-400">⚠️ {err}</div>}
        </section>

        {/* フッタ */}
        <footer className="text-xs text-zinc-500 space-y-1">
          <p>This page may require a valid token. Request a new link if it has expired.</p>
          <p>Gas fees for NFT claims are covered by the gallery.</p>
        </footer>
      </div>
    </main>
  );
}

// 小さな表示用コンポーネント
function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="text-zinc-400">{label}</div>
      <div className={mono ? 'font-mono' : ''}>{value}</div>
    </div>
  );
}
