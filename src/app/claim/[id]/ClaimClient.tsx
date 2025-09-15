// src/app/claim/[id]/ClaimClient.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type PurchaseInfo = {
  entryId: number;
  title?: string | null;
  artistName?: string | null;
  imageUrl?: string | null;
  salesType?: 'nft' | 'normal' | string;
  editionNo?: number | null;
  editionTotal?: number | null;
  // ほか必要なら拡張
};

type Props = {
  entryId: string;
  token?: string;
};

type FetchState =
  | { status: 'idle' | 'loading' }
  | { status: 'loaded'; data: PurchaseInfo }
  | { status: 'error'; message: string };

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

const isEthAddress = (x: string) =>
  /^0x[a-fA-F0-9]{40}$/.test(x.trim());

export default function ClaimClient({ entryId, token }: Props) {
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle' });
  const [mode, setMode] = useState<'address' | 'email'>('address');

  // フォーム値
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');

  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  const canSubmit = useMemo(() => {
    if (mode === 'address') return isEthAddress(address);
    if (mode === 'email') return /\S+@\S+\.\S+/.test(email.trim());
    return false;
  }, [mode, address, email]);

  // 注文/作品情報の取得
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setFetchState({ status: 'loading' });
        const qs = new URLSearchParams();
        if (token) qs.set('t', token);
        const res = await fetch(`/api/claim/${entryId}?${qs.toString()}`, {
          method: 'GET',
          headers: { 'accept': 'application/json' },
          cache: 'no-store',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || '受け取り情報の取得に失敗しました。');
        }
        const data = (await res.json()) as PurchaseInfo;
        if (!alive) return;
        setFetchState({ status: 'loaded', data });
        // デフォルトはNFTならaddressモード、normalならUIで注意喚起
      } catch (e: any) {
        if (!alive) return;
        setFetchState({ status: 'error', message: e?.message || '読み込みに失敗しました。' });
      }
    })();
    return () => { alive = false; };
  }, [entryId, token]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit || submitState.status === 'submitting') return;
    setSubmitState({ status: 'submitting' });

    try {
      const payload: any = { mode };
      if (mode === 'address') payload.address = address.trim();
      if (mode === 'email') payload.email = email.trim();
      if (token) payload.token = token;

      const res = await fetch(`/api/claim/${entryId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = body?.error || '受け取りに失敗しました。しばらくしてから再度お試しください。';
        throw new Error(msg);
      }

      // 成功メッセージ（メール受け取りはメール送信案内、アドレス受け取りはトランザクション案内）
      const successMessage =
        mode === 'email'
          ? '受け取りリンクをメールで送信しました。メールの案内に沿って完了してください。'
          : '受け取り処理を開始しました。数分後にウォレットをご確認ください。';

      setSubmitState({ status: 'success', message: body?.message || successMessage });
    } catch (e: any) {
      setSubmitState({ status: 'error', message: e?.message || '不明なエラーが発生しました。' });
    }
  }, [canSubmit, submitState.status, mode, address, email, entryId, token]);

  return (
    <div className="space-y-8">
      {/* 概要パネル */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">受け取り概要</h2>

        {fetchState.status === 'loading' && (
          <p className="mt-3 text-sm text-gray-600">情報を取得しています…</p>
        )}

        {fetchState.status === 'error' && (
          <p className="mt-3 text-sm text-red-600">{fetchState.message}</p>
        )}

        {fetchState.status === 'loaded' && (
          <div className="mt-4 flex items-start gap-4">
            {fetchState.data.imageUrl ? (
              <img
                src={fetchState.data.imageUrl}
                alt={fetchState.data.title ?? 'artwork'}
                className="h-24 w-24 rounded-lg object-cover ring-1 ring-gray-200"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-500">
                No Image
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm text-gray-500">Entry #{entryId}</div>
              <div className="truncate text-base font-medium text-gray-900">
                {fetchState.data.title ?? '作品名未設定'}
              </div>
              <div className="text-sm text-gray-700">
                {fetchState.data.artistName ? `by ${fetchState.data.artistName}` : 'アーティスト名未設定'}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {fetchState.data.salesType === 'nft' ? '販売形式: NFT' : '販売形式: 通常'}
                {typeof fetchState.data.editionNo === 'number' &&
                  typeof fetchState.data.editionTotal === 'number' && (
                    <span className="ml-2">
                      Edition {fetchState.data.editionNo} / {fetchState.data.editionTotal}
                    </span>
                  )}
              </div>
              {fetchState.data.salesType !== 'nft' && (
                <div className="mt-2 text-xs text-amber-600">
                  ※この作品は通常販売として登録されています。NFT受け取りの案内が届いている場合のみ続行してください。
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 受け取り方法 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">受け取り方法の選択</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode('address')}
            className={[
              'rounded-xl border p-4 text-left transition',
              mode === 'address'
                ? 'border-sky-500 ring-2 ring-sky-200'
                : 'border-gray-200 hover:border-gray-300',
            ].join(' ')}
          >
            <div className="font-medium text-gray-900">ウォレットアドレスで受け取り</div>
            <div className="mt-1 text-sm text-gray-600">
              既にお持ちのEVMウォレット（MetaMask 等）のアドレスに送付します。
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode('email')}
            className={[
              'rounded-xl border p-4 text-left transition',
              mode === 'email'
                ? 'border-sky-500 ring-2 ring-sky-200'
                : 'border-gray-200 hover:border-gray-300',
            ].join(' ')}
          >
            <div className="font-medium text-gray-900">メールで受け取り</div>
            <div className="mt-1 text-sm text-gray-600">
              ウォレット未所持でもOK。メール宛に受け取りリンクをお送りします。
            </div>
          </button>
        </div>

        <div className="mt-6">
          {mode === 'address' ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-800">
                受け取りアドレス（0xで始まるEVMアドレス）
              </label>
              <input
                type="text"
                inputMode="text"
                placeholder="0x1234...abcd"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none ring-sky-200 focus:border-sky-500 focus:ring"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              {!address ? (
                <p className="text-xs text-gray-500">例: 0xA1b2C3D4E5F6...（コピー＆ペースト推奨）</p>
              ) : !isEthAddress(address) ? (
                <p className="text-xs text-red-600">アドレス形式が正しくありません。</p>
              ) : (
                <p className="text-xs text-green-700">形式OKです。</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-800">受け取り用メールアドレス</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none ring-sky-200 focus:border-sky-500 focus:ring"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                ご入力のメール宛に受け取り用のリンクをお送りします。
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 実行パネル */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">受け取りの実行</h2>
        <ol className="mt-2 list-inside list-decimal text-sm text-gray-700">
          <li>上のフォームで受け取り方法を選択し、必要項目を入力してください。</li>
          <li>「受け取る」を押すと、サーバーが受け取り処理（claim）を実行します。</li>
          <li>完了後、ウォレットまたはメールをご確認ください。</li>
        </ol>

        <div className="mt-4 flex items-center gap-3">
          <button
            disabled={!canSubmit || submitState.status === 'submitting'}
            onClick={onSubmit}
            className={[
              'inline-flex items-center justify-center rounded-lg px-5 py-2 text-white shadow-sm transition',
              canSubmit && submitState.status !== 'submitting'
                ? 'bg-sky-600 hover:bg-sky-700'
                : 'bg-sky-300 cursor-not-allowed',
            ].join(' ')}
          >
            {submitState.status === 'submitting' ? '処理中…' : '受け取る'}
          </button>

          {token ? (
            <span className="text-xs text-gray-500">トークン認証済み</span>
          ) : (
            <span className="text-xs text-amber-600">URLの認証トークン（?t=...）が見つかりません。</span>
          )}
        </div>

        {/* ステータス表示 */}
        {submitState.status === 'success' && (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {submitState.message}
          </div>
        )}
        {submitState.status === 'error' && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {submitState.message}
          </div>
        )}
      </section>

      {/* よくある質問 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">よくある質問</h3>
        <div className="mt-3 space-y-3 text-sm text-gray-700">
          <details className="group rounded-lg border border-gray-200 p-3">
            <summary className="cursor-pointer font-medium text-gray-900">
              ウォレットを持っていません。どうすればいいですか？
            </summary>
            <p className="mt-2">
              「メールで受け取り」を選ぶと、ウォレットがなくても受け取れます。メールに届く案内に従ってください。
            </p>
          </details>

          <details className="group rounded-lg border border-gray-200 p-3">
            <summary className="cursor-pointer font-medium text-gray-900">
              受け取りにかかる時間は？
            </summary>
            <p className="mt-2">
              数分程度で完了するのが一般的です。混雑状況やネットワークによって前後します。
            </p>
          </details>

          <details className="group rounded-lg border border-gray-200 p-3">
            <summary className="cursor-pointer font-medium text-gray-900">
              認証トークンが無効/期限切れと言われます
            </summary>
            <p className="mt-2">
              メールの最新リンクを使用しているかご確認ください。解決しない場合は
              <a href="/#contact" className="underline decoration-sky-400 underline-offset-2">
                お問い合わせ
              </a>
              よりご連絡ください。
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
