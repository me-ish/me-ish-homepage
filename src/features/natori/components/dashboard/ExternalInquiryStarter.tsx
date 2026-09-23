"use client";

import { useState } from "react";
import { CSRF_HEADERS } from "@/lib/auth/csrf";

const inputClass = "w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100";

export default function ExternalInquiryStarter() {
  const [clientName, setClientName] = useState("");
  const [title, setTitle] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [source, setSource] = useState("DM");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!clientName.trim() || !title.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/natori/admin/external-inquiry", {
        method: "POST", headers: { "Content-Type": "application/json", ...CSRF_HEADERS },
        body: JSON.stringify({ clientName, title, clientEmail, source, note }),
      });
      const result = await response.json() as { projectId?: string };
      if (!response.ok || !result.projectId) throw new Error("案件を登録できませんでした。入力を確認してください。");
      window.location.assign(`/natori/estimate?inquiry=${encodeURIComponent(result.projectId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登録できませんでした");
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-pink-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-black">DM・メールなどからのご相談を登録</h2>
      <p className="mt-1 text-sm text-gray-600">最初は依頼者と案件名だけで大丈夫です。相談で決まった条件・金額は次の画面で入力します。</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">依頼者名 <span className="text-pink-700">必須</span><input className={`${inputClass} mt-1`} value={clientName} onChange={(event) => setClientName(event.target.value)} maxLength={100} /></label>
        <label className="text-sm font-bold">案件名 <span className="text-pink-700">必須</span><input className={`${inputClass} mt-1`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="例：動画サムネイル用イラスト" /></label>
        <label className="text-sm font-bold">相談が来た場所<select className={`${inputClass} mt-1`} value={source} onChange={(event) => setSource(event.target.value)}><option>DM</option><option>Gmail・メール</option><option>他プラットフォーム</option><option>その他</option></select></label>
        <label className="text-sm font-bold">依頼者のメール（分かれば）<input type="email" className={`${inputClass} mt-1`} value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} /></label>
      </div>
      <label className="mt-3 block text-sm font-bold">最初の相談メモ（任意）<textarea className={`${inputClass} mt-1 min-h-20`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} placeholder="DMなどの内容を貼り付けられます" /></label>
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
      <button type="button" disabled={!clientName.trim() || !title.trim() || busy} onClick={submit} className="mt-4 min-h-11 w-full rounded-full bg-pink-500 px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? "登録しています…" : "案件を作って条件整理へ →"}</button>
    </section>
  );
}
