'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Props = { entryId: string; token?: string };

type Preflight =
  | { status: 'idle' | 'checking' }
  | { status: 'ok'; tokenId: number }
  | { status: 'ng'; message: string };

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

const isEthAddress = (x: string) => /^0x[a-fA-F0-9]{40}$/.test(x.trim());

export default function ClaimClient({ entryId, token }: Props) {
  const [mode, setMode] = useState<'address' | 'email'>('address');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [preflight, setPreflight] = useState<Preflight>({ status: 'idle' });
  const [submit, setSubmit] = useState<SubmitState>({ status: 'idle' });

  // --- プリフライト（サーバーがMINTERを持つ & tokenが存在） ---
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setPreflight({ status: 'checking' });
        const r = await fetch(`/api/claim/${entryId}`, { method: 'GET', cache: 'no-store' });
        const j = await r.json();
        if (!r.ok || !j?.ok) throw new Error(j?.error || 'preflight failed');

        if (j.hasMinter !== true) {
          if (alive) setPreflight({ status: 'ng', message: 'サーバーに MINTER 権限がありません（Roles で付与してください）。' });
          return;
        }
        if (j.tokenExists !== true) {
          if (alive) setPreflight({ status: 'ng', message: `Token #${j.tokenId} が存在しません（Lazy Mintしてください）。` });
          return;
        }
        if (alive) setPreflight({ status: 'ok', tokenId: j.tokenId });
      } catch (e: any) {
        if (alive) setPreflight({ status: 'ng', message: e?.message || 'プリフライトに失敗しました。' });
      }
    })();
    return () => { alive = false; };
  }, [entryId]);

  const canSubmit = useMemo(() => {
    if (preflight.status !== 'ok') return false;
    if (submit.status === 'submitting') return false;
    if (mode === 'address') return isEthAddress(address);
    if (mode === 'email') return /\S+@\S+\.\S+/.test(email.trim());
    return false;
  }, [preflight, submit.status, mode, address, email]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmit({ status: 'submitting' });
    try {
      const payload: any = { mode };
      if (mode === 'address') payload.address = address.trim();
      if (mode === 'email') payload.email = email.trim();
      if (token) payload.token = token;

      const r = await fetch(`/api/claim/${entryId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || '受け取りに失敗しました。');

      const msg =
        mode === 'email'
          ? '受け取りリンクをメールで送信しました。'
          : `配布トランザクション送信: ${j.txHash ?? ''}`.trim();

      setSubmit({ status: 'success', message: msg });
    } catch (e: any) {
      setSubmit({ status: 'error', message: e?.message || '不明なエラーが発生しました。' });
    }
  }, [canSubmit, mode, address, email, entryId, token]);

  // ---- UI ----
  return (
    <div className="space-y-8">
      {/* プリフライトの状態 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">配布の事前チェック</h2>
        {preflight.status === 'checking' && (
          <p className="mt-2 text-sm text-gray-600">サーバー権限とトークン状態を確認中…</p>
        )}
        {preflight.status === 'ng' && (
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {preflight.message}
          </div>
        )}
        {preflight.status === 'ok' && (
          <div className="mt-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            配布可能です（Token #{preflight.tokenId}）。
          </div>
        )}
      </section>

      {/* 受け取り方法 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">受け取り方法の選択</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode('address')}
            className={[
              'rounded-xl border p-4 text-left transition',
              mode === 'address' ? 'border-sky-500 ring-2 ring-sky-200' : 'border-gray-200 hover:border-gray-300',
            ].join(' ')}
          >
            <div className="font-medium text-gray-900">ウォレットアドレスで受け取り</div>
            <div className="mt-1 text-sm text-gray-600">EVMウォレット（MetaMask等）のアドレスに送付します。</div>
          </button>

          <button
            type="button"
            onClick={() => setMode('email')}
            className={[
              'rounded-xl border p-4 text-left transition',
              mode === 'email' ? 'border-sky-500 ring-2 ring-sky-200' : 'border-gray-200 hover:border-gray-300',
            ].join(' ')}
          >
            <div className="font-medium text-gray-900">メールで受け取り</div>
            <div className="mt-1 text-sm text-gray-600">ウォレット未所持でもOK。メール宛に受け取りリンクを送付します。</div>
          </button>
        </div>

        {/* 入力欄 */}
        <div className="mt-6">
          {mode === 'address' ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-800">受け取りアドレス（0x…）</label>
              <input
                type="text"
                placeholder="0x1234...abcd"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none ring-sky-200 focus:border-sky-500 focus:ring"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              {!address ? (
                <p className="text-xs text-gray-500">例: 0xA1b2C3D4E5F6…（コピー＆ペースト推奨）</p>
              ) : !isEthAddress(address) ? (
                <p className="text-xs text-red-600">アドレス形式が正しくありません。</p>
              ) : (
                <p className="text-xs text-green-700">形式OKです。</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-800">受け取りメールアドレス</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none ring-sky-200 focus:border-sky-500 focus:ring"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}
        </div>
      </section>

      {/* 実行 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">受け取りの実行</h2>
        <button
          disabled={!canSubmit}
          onClick={onSubmit}
          className={[
            'rounded-lg px-5 py-2 text-white shadow-sm transition',
            canSubmit ? 'bg-sky-600 hover:bg-sky-700' : 'bg-sky-300 cursor-not-allowed',
          ].join(' ')}
        >
          {submit.status === 'submitting' ? '処理中…' : '受け取る'}
        </button>

        {submit.status === 'success' && (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {submit.message}
          </div>
        )}
        {submit.status === 'error' && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {submit.message}
          </div>
        )}
      </section>
    </div>
  );
}
