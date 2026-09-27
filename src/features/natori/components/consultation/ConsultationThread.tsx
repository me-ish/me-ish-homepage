"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { Paperclip } from "lucide-react";
import { consultationUploadEndpoint } from "@/features/natori/lib/consultationUploadEndpoint";
import type { ConsultationMessage } from "@/features/natori/types/consultation";

type Props =
  | { mode: "staff"; projectId: string; clientEmail?: string; standalone?: boolean; initialMessages?: never; token?: never; closed?: boolean; onChanged?: () => void }
  | { mode: "client"; token: string; initialMessages: ConsultationMessage[]; closed: boolean; projectId?: never; clientEmail?: never };

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function renderText(value: string) {
  return value.split(/(https:\/\/[^\s]+)/g).map((part, index) => {
    if (part.startsWith("https://")) {
      try {
        const parsed = new URL(part);
        if (parsed.protocol === "https:") return <a key={index} href={parsed.href} target="_blank" rel="noopener noreferrer" className="break-all text-pink-700 underline">{part}</a>;
      } catch { /* Leave malformed URLs as plain text. */ }
    }
    return <span key={index}>{part}</span>;
  });
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
  const [closed, setClosed] = useState(props.closed ?? false);
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const lastMessageRef = useRef<HTMLLIElement>(null);
  const knownMessages = useRef(new Set(messages.map(message => message.id)));
  const historyLoaded = useRef(props.mode === "client");
  const requestVersion = useRef({ value: 0 });
  const lastRefresh = useRef(0);
  const changed = props.mode === "staff" ? props.onChanged : undefined;
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const reload = useCallback(async () => {
    const version = ++requestVersion.current.value;
    lastRefresh.current = Date.now();
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (version !== requestVersion.current.value) return false;
      if (!response.ok) throw new Error("相談履歴を読み込めませんでした。リンクが有効か確認して、もう一度更新してください。");
      const data = await response.json() as { messages: ConsultationMessage[]; closed?: boolean };
      if (!Array.isArray(data.messages)) throw new Error("相談履歴を読み込めませんでした");
      if (version !== requestVersion.current.value) return false;
      if (historyLoaded.current && data.messages.some(message => !knownMessages.current.has(message.id))) setNewMessages(true);
      historyLoaded.current = true;
      knownMessages.current = new Set(data.messages.map(message => message.id));
      setMessages(data.messages);
      if (typeof data.closed === "boolean") setClosed(data.closed);
      setHistoryUnavailable(false);
      return true;
    } catch (error) {
      if (version !== requestVersion.current.value) return false;
      throw error;
    }
  }, [endpoint]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const version = requestVersion.current.value + 1;
    try { if (await reload()) setError(""); }
    catch (err) { setHistoryUnavailable(true); setError(err instanceof Error ? err.message : "相談履歴を読み込めませんでした"); }
    finally { if (version === requestVersion.current.value) setLoading(false); }
  }, [reload]);

  useEffect(() => {
    const requests = requestVersion.current;
    void refresh();
    const resume = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh.current > 1000) void refresh();
    };
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      requests.value++;
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refresh]);

  const showLatest = () => {
    lastMessageRef.current?.scrollIntoView({ block: "nearest" });
    lastMessageRef.current?.focus({ preventScroll: true });
    setNewMessages(false);
  };

  const refreshAfterSend = async () => {
    changed?.();
    try { await reload(); }
    catch { setHistoryUnavailable(true); setError("送信は保存済みですが、履歴を更新できませんでした。「履歴を更新」で確認してください。本文を送り直す必要はありません。"); }
  };

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
      await refreshAfterSend();
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
      await refreshAfterSend();
    } catch (err) {
      setError(err instanceof Error ? err.message : "メールを再送できませんでした");
    } finally { setBusy(false); }
  };

  const uploadFile = async (file: File) => {
    const audio = /\.(mp3|m4a|wav)$/i.test(file.name);
    const limit = audio ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size === 0 || file.size > limit) {
      setError(`${audio ? "音声は50MB" : "画像・PDFは10MB"}まで送れます。大きなファイルは共有URLをメッセージ欄に貼ってください。`);
      return;
    }
    setBusy(true);
    setProgress(0);
    setError("");
    setNotice("");
    const actor = props.mode === "staff" ? { projectId: props.projectId } : { token: props.token };
    const fileMeta = { ...actor, fileName: file.name, mimeType: file.type, sizeBytes: file.size };
    try {
      const signedResponse = await fetch("/api/natori/consultation-file", {
        method: "POST", headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sign", ...fileMeta }),
      });
      const signed = await signedResponse.json() as { path?: string; uploadToken?: string; error?: string };
      if (!signedResponse.ok || !signed.path || !signed.uploadToken) throw new Error(signed.error ?? "アップロードを準備できませんでした");
      const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!storageUrl) throw new Error("アップロード先を確認できませんでした");
      const uploadEndpoint = consultationUploadEndpoint(storageUrl);
      const { Upload } = await import("tus-js-client");
      await new Promise<void>((resolve, reject) => {
        const upload = new Upload(file, {
          endpoint: uploadEndpoint,
          retryDelays: [0, 3000, 5000, 10000],
          headers: { "x-signature": signed.uploadToken! },
          metadata: { bucketName: "natori-consultations", objectName: signed.path!, contentType: file.type },
          chunkSize: 6 * 1024 * 1024,
          removeFingerprintOnSuccess: true,
          uploadDataDuringCreation: true,
          onProgress: (uploaded, total) => setProgress(Math.round(uploaded / total * 100)),
          onError: reject,
          onSuccess: () => resolve(),
        });
        upload.start();
      });
      const finishedResponse = await fetch("/api/natori/consultation-file", {
        method: "POST", headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finish", ...fileMeta, path: signed.path }),
      });
      const finished = await finishedResponse.json() as { error?: string; notificationFailed?: boolean };
      if (!finishedResponse.ok) throw new Error(finished.error ?? "ファイルを会話に保存できませんでした");
      setNotice(finished.notificationFailed ? "ファイルは保存されましたが、メール通知に失敗しました。" : "ファイルを共有しました。");
      await refreshAfterSend();
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードできませんでした");
    } finally {
      setBusy(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const cannotSend = closed || (props.mode === "staff" && !props.clientEmail);
  return (
    <section className="space-y-3 rounded-xl border border-pink-200 bg-white p-3" aria-label="相談のやり取り">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-pink-800">相談のやり取り</h3>
          <button type="button" disabled={loading || busy} onClick={() => void refresh()} className="rounded-full border px-3 py-2 text-xs font-bold disabled:opacity-50">履歴を更新</button>
        </div>
        <p className="mt-1 text-xs text-gray-600">{props.mode === "client" ? "ナトリからの返事はメールでもお知らせします。ご返信はこの相談ページからお願いします。" : "相談内容とメール通知の状態は別に記録されます。"} メールへの直接返信は、この履歴には自動で入りません。</p>
        {newMessages && !loading ? <button type="button" onClick={showLatest} className="mt-2 text-xs font-bold text-pink-700 underline">新しいやり取りを見る</button> : null}
        {props.mode === "staff" && !props.clientEmail ? <p className="text-xs text-amber-700">依頼者のメールアドレスがないため返信できません。</p> : null}
      </div>
      {loading ? <p role="status" className="text-xs text-gray-500">履歴を確認中…</p> : null}
      {!loading && !historyUnavailable && messages.length === 0 ? <p className="text-xs text-gray-500">{closed ? "相談履歴はありません。" : "返信はまだありません。最初のメッセージを送れます。"}</p> : null}
      {messages.length > 0 ? (
        <ol className="space-y-2">
          {messages.map((message, index) => (
            <li key={message.id} ref={index === messages.length - 1 ? lastMessageRef : undefined} tabIndex={-1} className={`rounded-xl px-3 py-2 text-sm ${message.sender === "staff" ? "bg-pink-50" : "bg-gray-100"}`}>
              <p className="mb-1 text-xs font-semibold text-gray-600">{message.sender === "staff" ? "ナトリ" : "依頼者"} · {dateTime(message.createdAt)}</p>
              <p className="whitespace-pre-wrap break-words text-gray-900">{renderText(message.body)}</p>
              {message.files?.map((file) => (
                <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 break-all rounded-lg border border-pink-200 bg-white px-3 py-2 text-xs font-bold text-pink-800 underline">
                  <Paperclip className="h-4 w-4 shrink-0" aria-hidden /> {file.name} ({(file.sizeBytes / 1024 / 1024).toFixed(1)}MB)
                </a>
              ))}
              {props.mode === "staff" && message.notificationStatus === "failed" && (message.sender !== "staff" || closed) ? <p className="mt-1 text-xs font-bold text-amber-700">メール通知に失敗 · 相談内容は保存済み</p> : null}
              {props.mode === "staff" && message.notificationStatus === "pending" ? <p className="mt-1 text-xs text-amber-700">通知未送信・処理中 · 相談内容は保存済み</p> : null}
              {props.mode === "staff" && !closed && message.sender === "staff" && message.notificationStatus === "failed" ? (
                <button type="button" disabled={busy} onClick={() => void retry(message.id)} className="mt-1 text-xs font-bold text-amber-700 underline disabled:opacity-50">メール通知に失敗 · 再送する</button>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      {messages.some((message) => message.files?.length) ? <p className="text-[11px] text-gray-500">添付が開けない場合は、ページを再読み込みしてください。</p> : null}
      {!cannotSend ? (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-700" htmlFor="consultation-reply">メッセージ</label>
          <textarea id="consultation-reply" autoFocus={props.mode === "staff" && props.standalone} value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} rows={4}
            placeholder="相談への返信や共有URLを入力してください" className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 focus:border-pink-400 focus:outline-none" />
          <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.mp3,.m4a,.wav" className="hidden" aria-label="相談ファイルを選ぶ" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file); }} />
          <p className="text-xs text-gray-500">ファイルを選ぶとそのまま送信します。画像・PDFは10MB、音声は50MBまで。大きな楽曲は共有URLを貼ってください。</p>
          {progress !== null ? <p role="status" className="text-xs text-pink-700">アップロード中 {progress}%</p> : null}
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || loading || historyUnavailable} className="mr-2 rounded-full border border-pink-300 px-4 py-2 text-sm font-bold text-pink-800 disabled:opacity-50">ファイルを選んで送信</button>
          <button type="button" onClick={() => void send()} disabled={!body.trim() || busy || loading || historyUnavailable}
            className="rounded-full bg-pink-500 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "送信中…" : "メッセージを送信"}</button>
        </div>
      ) : closed ? <p className="text-xs text-gray-600">この相談は終了しています。履歴のみ確認できます。</p> : null}
      {notice ? <p role="status" className="text-xs text-green-700">{notice}</p> : null}
      {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
    </section>
  );
}
