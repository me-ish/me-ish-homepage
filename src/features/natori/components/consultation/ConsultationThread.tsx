"use client";

import { useCallback, useEffect, useState } from "react";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import type { ConsultationMessage } from "@/features/natori/server/consultationService";

type Props =
  | { mode: "staff"; projectId: string; clientEmail?: string; initialMessages?: never; token?: never; closed?: never }
  | { mode: "client"; token: string; initialMessages: ConsultationMessage[]; closed: boolean; projectId?: never; clientEmail?: never };

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function ConsultationThread(props: Props) {
  const endpoint = props.mode === "staff"
    ? `/api/natori/admin/consultation?projectId=${encodeURIComponent(props.projectId)}`
    : `/api/natori/consult/${encodeURIComponent(props.token)}`;
  const postEndpoint = props.mode === "staff" ? "/api/natori/admin/consultation" : endpoint;
  const [messages, setMessages] = useState<ConsultationMessage[]>(props.mode === "client" ? props.initialMessages : []);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(props.mode === "staff");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error("相談履歴を読み込めませんでした");
    const data = await response.json() as { messages: ConsultationMessage[] };
    setMessages(data.messages);
  }, [endpoint]);

  useEffect(() => {
    if (props.mode === "client") return;
    let active = true;
    setLoading(true);
    void reload().catch(() => {
      if (active) setError("相談履歴を読み込めませんでした。画面を開き直してください。");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [props.mode, reload]);

  const send = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(postEndpoint, {
        method: "POST",
        headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify(props.mode === "staff" ? { projectId: props.projectId, body } : { body }),
      });
      const result = await response.json() as { error?: string; notificationFailed?: boolean };
      if (!response.ok) throw new Error(result.error ?? "送信できませんでした");
      setBody("");
      setNotice(result.notificationFailed
        ? "相談内容は保存されましたが、メール通知に失敗しました。別の方法でもご連絡ください。"
        : "送信しました。");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信できませんでした");
    } finally {
      setBusy(false);
    }
  };

  const retry = async (messageId: string) => {
    if (props.mode !== "staff" || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(postEndpoint, {
        method: "POST", headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: props.projectId, retryMessageId: messageId }),
      });
      const result = await response.json() as { error?: string; notificationFailed?: boolean };
      if (!response.ok || result.notificationFailed) throw new Error(result.error ?? "メールを再送できませんでした");
      setNotice("メール通知を再送しました。");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "メールを再送できませんでした");
    } finally { setBusy(false); }
  };

  const cannotSend = props.mode === "client" ? props.closed : !props.clientEmail;
  return (
    <section className="space-y-3 rounded-xl border border-pink-200 bg-white p-3" aria-label="相談のやり取り">
      <div>
        <h3 className="text-sm font-bold text-pink-800">相談のやり取り</h3>
        {props.mode === "staff" && !props.clientEmail ? <p className="text-xs text-amber-700">依頼者のメールアドレスがないため返信できません。</p> : null}
      </div>
      {loading ? <p className="text-xs text-gray-500">読み込み中…</p> : messages.length === 0 ? <p className="text-xs text-gray-500">返信はまだありません。最初のメッセージを送れます。</p> : (
        <ol className="max-h-72 space-y-2 overflow-y-auto">
          {messages.map((message) => (
            <li key={message.id} className={`rounded-xl px-3 py-2 text-sm ${message.sender === "staff" ? "bg-pink-50" : "bg-gray-100"}`}>
              <p className="mb-1 text-xs font-semibold text-gray-600">{message.sender === "staff" ? "ナトリ" : "依頼者"} · {dateTime(message.createdAt)}</p>
              <p className="whitespace-pre-wrap break-words text-gray-900">{message.body}</p>
              {props.mode === "staff" && message.sender === "staff" && message.notificationStatus === "failed" ? (
                <button type="button" disabled={busy} onClick={() => void retry(message.id)} className="mt-1 text-xs font-bold text-amber-700 underline disabled:opacity-50">メール通知に失敗 · 再送する</button>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {!cannotSend ? (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-700" htmlFor="consultation-reply">メッセージ</label>
          <textarea id="consultation-reply" value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} rows={4}
            placeholder="相談への返信を入力してください" className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 focus:border-pink-400 focus:outline-none" />
          <button type="button" onClick={() => void send()} disabled={!body.trim() || busy || loading}
            className="rounded-full bg-pink-500 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "送信中…" : "メッセージを送信"}</button>
        </div>
      ) : props.mode === "client" ? <p className="text-xs text-gray-600">この相談は終了しています。</p> : null}
      {notice ? <p role="status" className="text-xs text-green-700">{notice}</p> : null}
      {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
    </section>
  );
}
