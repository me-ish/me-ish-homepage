"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { Paperclip } from "lucide-react";
import { consultationOperationSchema, freezeConsultationOperation, consultationDigest, type ConsultationOperation } from "@/features/natori/lib/consultationOperation";
import { validConsultationFile } from "@/features/natori/lib/consultationFileRules";
import { consultationUploadEndpoint } from "@/features/natori/lib/consultationUploadEndpoint";
import type { ConsultationMessage } from "@/features/natori/types/consultation";

type Props =
  | { mode: "staff"; projectId: string; clientEmail?: string; standalone?: boolean; initialMessages?: never; token?: never; closed?: boolean; onChanged?: () => void }
  | { mode: "client"; token: string; initialMessages: ConsultationMessage[]; closed: boolean; projectId?: never; clientEmail?: never };

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(value));
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

  const cacheKey="natori-consultation-operation/"+(props.mode==="staff"?props.projectId:props.token);
  const actor=props.mode==="staff"?{projectId:props.projectId}:{token:props.token};
  const [draftFiles,setDraftFiles]=useState<{id:string;file:File}[]>([]);
  const [pending,setPending]=useState<ConsultationOperation|null>(null);
  const [cacheReady,setCacheReady]=useState(false);
  const callOperation=async(action:"commit"|"lookup"|"cancel",operation:ConsultationOperation)=>{
    const response=await fetch(postEndpoint,{method:"POST",headers:{...CSRF_HEADERS,"Content-Type":"application/json"},
      body:JSON.stringify({...(props.mode==="staff"?{projectId:props.projectId}:{}),action,operation})});
    const data:unknown=await response.json();
    if(!data||typeof data!=="object"||!("kind" in data))throw new Error("送信結果を確認できません。同じ送信で再試行してください。");
    return{response,data:data as {kind:string;messageId?:string;operationId?:string;requestHash?:string;files?:{id:string;path:string;uploaded:boolean;uploadToken?:string}[]}};
  };
  const recordSaved=async(operation:ConsultationOperation,data:{kind:string;messageId?:string;operationId?:string;requestHash?:string})=>{
    if(data.kind!=="committed"||!data.messageId||data.operationId!==operation.operationId||data.requestHash!==operation.requestHash)return false;
    sessionStorage.removeItem(cacheKey);setPending(null);setBody("");setDraftFiles([]);
    if(fileRef.current)fileRef.current.value="";
    setNotice("送信を保存しました。メール通知の状態は送信内容と別に確認できます。");await refreshAfterSend();return true;
  };
  useEffect(()=>{
    let active=true;
    try{
      const raw=sessionStorage.getItem(cacheKey),restored=raw?consultationOperationSchema.parse(JSON.parse(raw)):null;
      if(restored){setPending(restored);setBody(restored.body);
        void callOperation("lookup",restored).then(async({data})=>{if(active)await recordSaved(restored,data);}).catch(()=>{if(active)setError("前回の送信結果を確認できません。同じ送信で再試行してください。");});
      }
      setCacheReady(true);
    }catch{setError("送信の記録を読み込めません。担当者にお問い合わせください。");}
    return()=>{active=false;};
    // Actor scopes one composer; restoration must run before editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cacheKey]);
  const chooseFiles=async(files:File[])=>{
    setError("");
    if(files.some(file=>!validConsultationFile(file.name,file.type,file.size))){setError("対応する画像・PDFは10MB、音声は50MBまでです。大きなファイルは共有URLをご利用ください。");return;}
    if(pending){
      if(files.length!==pending.files.length){setError("前回と同じ添付を選択してください。変更する場合は送信の取消を確認してください。");return;}
      const restored=await Promise.all(files.map(async(file,index)=>{
        const saved=pending.files[index];return saved&&file.name===saved.fileName&&file.type===saved.mimeType&&file.size===saved.sizeBytes&&await consultationDigest(await file.arrayBuffer())===saved.sha256?{id:saved.id,file}:null;
      }));
      if(restored.some(file=>!file)){setError("前回と同じ添付を選択してください。");return;}
      setDraftFiles(restored.filter((file):file is {id:string;file:File}=>file!==null));return;
    }
    if(draftFiles.length+files.length>10){setError("一度の送信で選べる添付は10件までです。");return;}
    setDraftFiles(current=>[...current,...files.map(file=>({id:crypto.randomUUID(),file}))]);
  };
  const send=async()=>{
    if(busy||!cacheReady||(!pending&&!body.trim()&&!draftFiles.length))return;
    setBusy(true);setError("");setNotice("");
    try{
      const operation=pending??await freezeConsultationOperation(body,draftFiles);
      sessionStorage.setItem(cacheKey,JSON.stringify(operation));setPending(operation);
      const preparedResponse=await fetch("/api/natori/consultation-file",{method:"POST",headers:{...CSRF_HEADERS,"Content-Type":"application/json"},
        body:JSON.stringify({...actor,action:"prepare",operation})});
      const prepared=await preparedResponse.json() as {kind:string;messageId?:string;operationId?:string;requestHash?:string;files?:{id:string;path:string;uploaded:boolean;uploadToken?:string}[]};
      if(await recordSaved(operation,prepared))return;
      if(!preparedResponse.ok||prepared.kind!=="prepared"||!prepared.files||prepared.files.length!==operation.files.length)throw new Error("送信を確定できません。同じ送信で再試行するか、送信の取消を確認してください。");
      for(const reservation of prepared.files){
        const descriptor=operation.files.find(file=>file.id===reservation.id);if(!descriptor)throw new Error("添付の予約を確認できません。");
        if(reservation.uploaded)continue;
        const draft=draftFiles.find(file=>file.id===reservation.id);
        if(!draft||!reservation.uploadToken)throw new Error("前回と同じ添付をもう一度選び、同じ送信で再試行してください。");
        const storageUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;if(!storageUrl)throw new Error("アップロード先を確認できませんでした。");
        const {Upload}=await import("tus-js-client");setProgress(0);
        await new Promise<void>((resolve,reject)=>{
          const upload=new Upload(draft.file,{endpoint:consultationUploadEndpoint(storageUrl),retryDelays:[0,3000,5000,10000],
            headers:{"x-signature":reservation.uploadToken!},metadata:{bucketName:"natori-consultations",objectName:reservation.path,contentType:descriptor.mimeType},
            chunkSize:6*1024*1024,removeFingerprintOnSuccess:true,uploadDataDuringCreation:true,
            onProgress:(uploaded,total)=>setProgress(Math.round(uploaded/total*100)),onError:reject,onSuccess:()=>resolve()});
          upload.start();
        });
      }
      const committed=await callOperation("commit",operation);
      if(!committed.response.ok||!await recordSaved(operation,committed.data))throw new Error("送信結果を確認できません。同じ送信で再試行してください。");
    }catch(err){setError(err instanceof Error?err.message:"送信結果を確認できません。同じ送信で再試行してください。");}
    finally{setBusy(false);setProgress(null);}
  };
  const cancelPending=async()=>{
    if(!pending||busy)return;setBusy(true);setError("");
    try{
      const operation=pending,{response,data}=await callOperation("cancel",operation);
      if(await recordSaved(operation,data))return;
      if(!response.ok||data.kind!=="cancelled")throw new Error("取消を確認できません。入力を変更せず、もう一度確認してください。");
      sessionStorage.removeItem(cacheKey);setPending(null);setNotice("送信を取り消しました。本文と選択済み添付は下書きに残しています。");
    }catch(err){setError(err instanceof Error?err.message:"取消を確認できません。");}
    finally{setBusy(false);}
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
              {message.filesState==="unavailable"?<p role="status" className="mt-2 text-xs text-amber-700">添付一覧を取得できません。資料の提出状況は、履歴を更新して確認してください。</p>:null}
              {message.files?.map(file=>file.url?(
                <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 break-all rounded-lg border border-pink-200 bg-white px-3 py-2 text-xs font-bold text-pink-800 underline">
                  <Paperclip className="h-4 w-4 shrink-0" aria-hidden/>{file.name} ({(file.sizeBytes/1024/1024).toFixed(1)}MB)
                </a>
              ):<p key={file.id} role="status" className="mt-2 break-all rounded-lg border p-3 text-xs">{file.name} — 提出済みの添付です。リンクの取得に失敗しました。履歴を更新してください。</p>)}
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
          <textarea id="consultation-reply" autoFocus={props.mode === "staff" && props.standalone} value={body} disabled={busy||Boolean(pending)||!cacheReady} onChange={(event) => setBody(event.target.value)} maxLength={4000} rows={4}
            placeholder="相談への返信や共有URLを入力してください" className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 focus:border-pink-400 focus:outline-none" />
          <input ref={fileRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.mp3,.m4a,.wav" className="hidden" aria-label="相談ファイルを選ぶ" onChange={(event)=>{const files=Array.from(event.target.files??[]);void chooseFiles(files);if(fileRef.current)fileRef.current.value="";}} />
          <p className="text-xs text-gray-500">選んだファイルは送信前の下書きです。取り消しや本文の編集後、送信ボタンでまとめて送れます。画像・PDFは10MB、音声は50MBまで。大きな楽曲は共有URLを貼ってください。</p>
          {(pending?pending.files.map(file=>({id:file.id,name:file.fileName,size:file.sizeBytes})):draftFiles.map(({id,file})=>({id,name:file.name,size:file.size}))).map(file=>(
            <div key={file.id} className="flex items-center justify-between gap-2 rounded border p-2 text-xs">
              <span className="break-all">{file.name} ({(file.size/1024/1024).toFixed(1)}MB)</span>
              {!pending?<button type="button" disabled={busy} onClick={()=>setDraftFiles(current=>current.filter(draft=>draft.id!==file.id))} aria-label={file.name+"の添付を取り消す"} className="shrink-0 underline">取消</button>:null}
            </div>
          ))}
          {pending?<p role="status" className="text-xs text-amber-700">前回の送信結果を確認中です。同じ内容で確認・再試行します。変更する場合は先に取消を確認してください。</p>:null}
          {pending?<button type="button" disabled={busy} onClick={()=>void cancelPending()} className="text-xs underline">送信の取消を確認</button>:null}
          {progress !== null ? <p role="status" className="text-xs text-pink-700">アップロード中 {progress}%</p> : null}
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || loading || historyUnavailable} className="mr-2 rounded-full border border-pink-300 px-4 py-2 text-sm font-bold text-pink-800 disabled:opacity-50">添付を選ぶ</button>
          <button type="button" onClick={() => void send()} disabled={(!pending&&!body.trim()&&!draftFiles.length)||busy||loading||historyUnavailable||!cacheReady}
            className="rounded-full bg-pink-500 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{busy?"送信中…":pending?"同じ送信を確認・再試行":"メッセージを送信"}</button>
        </div>
      ) : closed ? <p className="text-xs text-gray-600">この相談は終了しています。履歴のみ確認できます。</p> : null}
      {notice ? <p role="status" className="text-xs text-green-700">{notice}</p> : null}
      {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
    </section>
  );
}
