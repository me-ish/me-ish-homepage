// /src/app/claim/[id]/page.tsx
'use client';

import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createThirdwebClient } from 'thirdweb';
import {
  ThirdwebProvider,
  ConnectButton,
  useActiveAccount,
  useConnect,
} from 'thirdweb/react';
import { inAppWallet, createWallet /* walletConnect */ } from 'thirdweb/wallets';

type PageProps = { params: { id: string } };

const CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || '';
const twClient = CLIENT_ID ? createThirdwebClient({ clientId: CLIENT_ID }) : null;

/** 送信用の互換関数（SDK のバージョンでメソッド名が違うのを吸収） */
async function sendOtpEmailCompat(
  wal: ReturnType<typeof inAppWallet>,
  email: string,
  client: NonNullable<typeof twClient>,
) {
  // いずれかが存在する
  const anyWal = wal as any;
  if (typeof anyWal.sendEmailOtp === 'function') {
    return anyWal.sendEmailOtp({ email, client });
  }
  if (typeof anyWal.sendAuthEmailOtp === 'function') {
    return anyWal.sendAuthEmailOtp({ email, client });
  }
  if (typeof anyWal.sendVerificationEmail === 'function') {
    return anyWal.sendVerificationEmail({ email, client });
  }
  throw new Error(
    'This SDK version does not expose a programmatic email OTP sender. Use the ConnectButton modal.',
  );
}

export default function ClaimPage(props: PageProps) {
  return (
    <ThirdwebProvider>
      <ClaimInner {...props} />
    </ThirdwebProvider>
  );
}

function ClaimInner({ params }: PageProps) {
  const sp = useSearchParams();
  const account = useActiveAccount();
  const { connect, isConnecting } = useConnect();

  const tokenId = useMemo(() => Number(sp.get('tokenId') ?? '0'), [sp]);
  const quantity = useMemo(() => Number(sp.get('qty') ?? '1'), [sp]);

  const [loading, setLoading] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // メール受け取り用
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [mailBusy, setMailBusy] = useState(false);

  // inAppWallet() が返す実体（＝Wallet）をそのまま保持する
  type WalletInstance = ReturnType<typeof inAppWallet>;
  const walletRef = useRef<WalletInstance | null>(null);

  const canClaim = !!account?.address && !!twClient && !loading;
  const polygonscanTx = (h: string) => `https://polygonscan.com/tx/${h}`;

  // 1) OTP送信
  async function sendOtp() {
    if (!twClient || !email) return;
    setMailBusy(true);
    setErr(null);
    try {
      const wal = inAppWallet({ auth: { options: ['email'] } });
      walletRef.current = wal;
      await sendOtpEmailCompat(wal, email, twClient);
      setOtpSent(true);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to send code');
    } finally {
      setMailBusy(false);
    }
  }

  // 2) コード入力で接続（connect の戻りは Wallet 必須）
  async function connectWithEmailOtp() {
    if (!twClient || !email || !otp) return;
    setMailBusy(true);
    setErr(null);
    try {
      await connect(async () => {
        const wal = walletRef.current ?? inAppWallet({ auth: { options: ['email'] } });
        // 一部 SDK は connect を wal.connect({...}) で受け付ける
        await (wal as any).connect?.({
          client: twClient,
          strategy: 'email',
          email,
          verificationCode: otp,
        });
        return wal; // ← ここが Promise<Wallet> を返す
      });
    } catch (e: any) {
      setErr(e?.message ?? 'Sign-in failed');
    } finally {
      setMailBusy(false);
    }
  }

  // 3) クレーム実行
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
          certToken: sp.get('t') || '',
          tokenId,
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
            <>
              {/* 既存：自由にログイン */}
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

              {/* 強い導線：メールで受け取る（ウォレット不要） */}
              <div className="space-y-2">
                <div className="text-sm font-medium">メールで受け取る（ウォレット不要）</div>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={sendOtp}
                    disabled={!email || mailBusy || isConnecting}
                    className={`rounded-md px-3 py-2 text-sm font-medium ${
                      !email || mailBusy || isConnecting
                        ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-zinc-200'
                    }`}
                  >
                    {mailBusy ? 'Sending…' : 'コード送信'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="6桁コード"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="flex-1 rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={connectWithEmailOtp}
                    disabled={!otpSent || !otp || mailBusy || isConnecting}
                    className={`rounded-md px-3 py-2 text-sm font-medium ${
                      !otpSent || !otp || mailBusy || isConnecting
                        ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-zinc-200'
                    }`}
                  >
                    {mailBusy || isConnecting ? 'Connecting…' : 'メールで接続'}
                  </button>
                </div>

                <div className="text-[11px] text-zinc-500">
                  メール認証だけで受け取れます。コードが届かない場合は迷惑メールをご確認ください。
                </div>
              </div>
            </>
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
