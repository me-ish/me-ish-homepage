// src/app/claim/[id]/ClaimClient.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type PurchaseInfo = { /* 省略：あなたの型でOK */ salesType?: 'nft' | 'normal' | string; };
type Props = { entryId: string; token?: string; };
type FetchState =
  | { status: 'idle' | 'loading' }
  | { status: 'loaded'; data: PurchaseInfo }
  | { status: 'error'; message: string };

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

const isEthAddress = (x: string) => /^0x[a-fA-F0-9]{40}$/.test(x.trim());

export default function ClaimClient({ entryId, token }: Props) {
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle' });
  const [mode, setMode] = useState<'address' | 'email'>('address');

  const [preflight, setPreflight] =
    useState<{ status: 'idle'|'checking'|'ok'|'ng'; msg?: string }>({ status: 'idle' });

  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  const canSubmit = useMemo(() => {
    if (mode === 'address') return isEthAddress(address);
    if (mode === 'email') return /\S+@\S+\.\S+/.test(email.trim());
    return false;
  }, [mode, address, email]);

  // 作品情報
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setFetchState({ status: 'loading' });
        const qs = new URLSearchParams();
        if (token) qs.set('t', token);
        const r = await fetch(`/api/claim/${entryId}?${qs}`, { cache: 'no-store' });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || '読み込み失敗');
        if (!alive) return;
        setFetchState({ status: 'loaded', data: j as PurchaseInfo });

        // サーバープリフライト（サーバーが MINTER を持つか、token が存在するか）
        setPreflight({ status: 'checking' });
        const pf = await fetch(`/api/claim/${entryId}`, { method: 'GET', cache: 'no-store' });
        const pj = await pf.json();
        if (!pf.ok || !pj?.ok) throw new Error(pj?.error || 'preflight failed');

        if (pj.hasMinter !== true) {
          setPreflight({ status: 'ng', msg: 'サーバーに MINTER 権限がありません（Rolesで付与してください）。' });
        } else if (pj.tokenExists !== true) {
          setPreflight({ status: 'ng', msg: `Token #${pj.tokenId} が存在しません（Lazy Mintしてください）。` });
        } else {
          setPreflight({ status: 'ok' });
        }
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

      const r = await fetch(`/api/claim/${entryId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || '受け取りに失敗しました。');
      }

      const msg =
        mode === 'email'
          ? '受け取りリンクをメールで送信しました。'
          : `配布トランザクション送信: ${j.txHash ?? ''}`.trim();

      setSubmitState({ status: 'success', message: msg });
    } catch (e: any) {
      setSubmitState({ status: 'error', message: e?.message || '不明なエラーが発生しました。' });
    }
  }, [canSubmit, submitState.status, mode, address, email, entryId, token]);

  return (
    <div className="space-y-8">
      {/* …(UIはあなたの元コードのままでOK) */}
      {/* Preflight結果の表示だけ、サーバーの判定結果を出す */}
      {preflight.status === 'checking' && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
          サーバー権限とトークン状態を確認中…
        </div>
      )}
      {preflight.status === 'ng' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {preflight.msg || 'プリフライトNG'}
        </div>
      )}
      {preflight.status === 'ok' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          配布可能です。
        </div>
      )}

      {/* 実行ボタン */}
      <button
        disabled={!canSubmit || submitState.status === 'submitting' || preflight.status !== 'ok'}
        onClick={onSubmit}
        className="rounded-lg bg-sky-600 px-5 py-2 text-white disabled:cursor-not-allowed disabled:bg-sky-300"
      >
        {submitState.status === 'submitting' ? '処理中…' : '受け取る'}
      </button>

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
    </div>
  );
}
