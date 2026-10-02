"use client";

import { natoriPrimaryActionClassName } from "@/features/natori/constants/natoriPrimaryAction";
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

type ComposerJob = { actor: string; generation: number };

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
  const actorKey = props.mode + "/" + (props.mode === "staff" ? props.projectId : props.token);
  const currentActor = useRef(actorKey);
  currentActor.current = actorKey;
  const mounted = useRef(false);
  const operationGeneration = useRef(0);
  const currentPending = useRef<ConsultationOperation | null>(null);
  const busyOwner = useRef<ComposerJob | null>(null);
  const ownsActor = () => mounted.current && currentActor.current === actorKey;
  const ownsAttempt = (job: ComposerJob) => ownsActor() && job.actor === actorKey && operationGeneration.current === job.generation;
  const ownsPending = (operation: ConsultationOperation, job: ComposerJob) => ownsAttempt(job)
    && currentPending.current?.operationId === operation.operationId && currentPending.current.requestHash === operation.requestHash;
  const ownsBusy = (job: ComposerJob) => ownsActor() && job.actor === actorKey && busyOwner.current === job;
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

  const reload = useCallback(async (afterSaved = false) => {
    if (!mounted.current || currentActor.current !== actorKey) return false;
    const version = ++requestVersion.current.value;
    const ownsRead = () => mounted.current && currentActor.current === actorKey && version === requestVersion.current.value;
    lastRefresh.current = Date.now();
    setLoading(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!ownsRead()) return false;
      if (!response.ok) throw new Error("相談履歴を読み込めませんでした。リンクが有効か確認して、もう一度更新してください。");
      const data = await response.json() as { messages: ConsultationMessage[]; closed?: boolean };
      if (!ownsRead()) return false;
      if (!Array.isArray(data.messages)) throw new Error("相談履歴を読み込めませんでした");
      if (historyLoaded.current && data.messages.some(message => !knownMessages.current.has(message.id))) setNewMessages(true);
      historyLoaded.current = true;
      knownMessages.current = new Set(data.messages.map(message => message.id));
      setMessages(data.messages);
      if (typeof data.closed === "boolean") setClosed(data.closed);
      setHistoryUnavailable(false);
      setError("");
      return true;
    } catch (error) {
      if (!ownsRead()) return false;
      setHistoryUnavailable(true);
      setError(afterSaved ? "送信は保存済みですが、履歴を更新できませんでした。「履歴を更新」で確認してください。本文を送り直す必要はありません。" : error instanceof Error ? error.message : "相談履歴を読み込めませんでした");
      return false;
    } finally {
      if (ownsRead()) setLoading(false);
    }
  }, [endpoint, actorKey]);

  const refresh = useCallback(() => reload(), [reload]);

  useEffect(() => {
    const requests = requestVersion.current;
    const generations = operationGeneration;
    mounted.current = true;
    void refresh();
    const resume = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh.current > 1000) void refresh();
    };
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      mounted.current = false;
      generations.current++;
      currentPending.current = null;
      busyOwner.current = null;
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
    if (!ownsActor()) return;
    changed?.();
    await reload(true);
  };

  const cacheKey="natori-consultation-operation/"+(props.mode==="staff"?props.projectId:props.token);
  const actor=props.mode==="staff"?{projectId:props.projectId}:{token:props.token};
  const [draftFiles,setDraftFiles]=useState<{id:string;file:File}[]>([]);
  const [pending,setPending]=useState<ConsultationOperation|null>(null);
  const [cacheReady,setCacheReady]=useState(false);
  const [noticeExpired,setNoticeExpired]=useState(false);
  const cachedPendingMatches = (operation: ConsultationOperation) => {
    const raw = sessionStorage.getItem(cacheKey);
    const cached = raw ? consultationOperationSchema.parse(JSON.parse(raw)) : null;
    return cached?.operationId === operation.operationId && cached.requestHash === operation.requestHash;
  };
  const retirePending = (operation: ConsultationOperation, job: ComposerJob) => {
    if (!ownsPending(operation, job) || !cachedPendingMatches(operation)) return false;
    sessionStorage.removeItem(cacheKey);
    currentPending.current = null;
    operationGeneration.current++;
    setPending(null);setNoticeExpired(false);
    return true;
  };
  const releaseBusy = (job: ComposerJob) => {
    if (!ownsBusy(job)) return;
    busyOwner.current = null;
    setBusy(false);
    setProgress(null);
  };
  const callOperation=async(action:"commit"|"lookup"|"cancel",operation:ConsultationOperation)=>{
    const response=await fetch(postEndpoint,{method:"POST",headers:{...CSRF_HEADERS,"Content-Type":"application/json"},
      body:JSON.stringify({...(props.mode==="staff"?{projectId:props.projectId}:{}),action,operation})});
    const data:unknown=await response.json();
    if(!data||typeof data!=="object"||!("kind" in data))throw new Error("送信結果を確認できません。同じ送信で再試行してください。");
    return{response,data:data as {kind:string;messageId?:string;operationId?:string;requestHash?:string;files?:{id:string;path:string;uploaded:boolean;uploadToken?:string}[]}};
  };
  const recordSaved=async(operation:ConsultationOperation,data:{kind:string;messageId?:string;operationId?:string;requestHash?:string},job:ComposerJob)=>{
    if(data.kind!=="committed"||!data.messageId||data.operationId!==operation.operationId||data.requestHash!==operation.requestHash)return false;
    if (!retirePending(operation, job)) return false;
    setBody("");setDraftFiles([]);
    if(fileRef.current)fileRef.current.value="";
    setNotice("送信を保存しました。メール通知の状態は送信内容と別に確認できます。");await refreshAfterSend();return true;
  };
  useEffect(()=>{
    let active=true;
    operationGeneration.current++;
    currentPending.current = null;
    busyOwner.current = null;
    setPending(null);setBody("");setDraftFiles([]);setBusy(false);setProgress(null);
    setError("");setNotice("");setNoticeExpired(false);setCacheReady(false);setHistoryUnavailable(false);setNewMessages(false);
    const initial = props.mode === "client" ? props.initialMessages : [];
    knownMessages.current = new Set(initial.map(message => message.id));
    historyLoaded.current = props.mode === "client";
    setMessages(initial);setClosed(props.closed ?? false);
    if (fileRef.current) fileRef.current.value = "";
    try{
      const raw=sessionStorage.getItem(cacheKey),restored=raw?consultationOperationSchema.parse(JSON.parse(raw)):null;
      if(restored){
        currentPending.current=restored;setPending(restored);setBody(restored.body);
        const job={actor:actorKey,generation:operationGeneration.current};
        void callOperation("lookup",restored).then(async({data})=>{
          if(active&&ownsPending(restored,job)){
            if(data.kind==="notice_expired")setNoticeExpired(true);
            else await recordSaved(restored,data,job);
          }
        }).catch(()=>{if(active&&ownsPending(restored,job))setError("前回の送信結果を確認できません。同じ送信で再試行してください。");});
      }
      setCacheReady(true);
    }catch{setError("送信の記録を読み込めません。担当者にお問い合わせください。");}
    return()=>{active=false;};
    // Actor scopes one composer; restoration must run before editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cacheKey,actorKey]);
  const chooseFiles=async(files:File[])=>{
    const job={actor:actorKey,generation:operationGeneration.current};
    if (!ownsActor()) return;
    setError("");
    if(files.some(file=>!validConsultationFile(file.name,file.type,file.size))){setError("対応する画像・PDFは10MB、音声は50MBまでです。大きなファイルは共有URLをご利用ください。");return;}
    if(pending){
      if(files.length!==pending.files.length){setError("前回と同じ添付を選択してください。変更する場合は送信の取消を確認してください。");return;}
      const restored=await Promise.all(files.map(async(file,index)=>{
        const saved=pending.files[index];return saved&&file.name===saved.fileName&&file.type===saved.mimeType&&file.size===saved.sizeBytes&&await consultationDigest(await file.arrayBuffer())===saved.sha256?{id:saved.id,file}:null;
      }));
      if (!ownsPending(pending, job)) return;
      if(restored.some(file=>!file)){setError("前回と同じ添付を選択してください。");return;}
      setDraftFiles(restored.filter((file):file is {id:string;file:File}=>file!==null));return;
    }
    if(draftFiles.length+files.length>10){setError("一度の送信で選べる添付は10件までです。");return;}
    setDraftFiles(current=>[...current,...files.map(file=>({id:crypto.randomUUID(),file}))]);
  };
  const send=async()=>{
    if(busyOwner.current||busy||noticeExpired||!cacheReady||(!pending&&!body.trim()&&!draftFiles.length)||!ownsActor())return;
    const job={actor:actorKey,generation:++operationGeneration.current};
    busyOwner.current=job;setBusy(true);setError("");setNotice("");
    try{
      const operation=pending??await freezeConsultationOperation(body,draftFiles);
      if (!ownsAttempt(job)) return;
      if (pending ? !cachedPendingMatches(operation) : sessionStorage.getItem(cacheKey) !== null) throw new Error("\u4fdd\u5b58\u3055\u308c\u305f\u9001\u4fe1\u306e\u8a18\u9332\u304c\u5909\u308f\u3063\u3066\u3044\u307e\u3059\u3002\u5165\u529b\u3092\u4fdd\u6301\u3057\u3066\u3001\u30da\u30fc\u30b8\u3092\u518d\u8aad\u307f\u8fbc\u307f\u3057\u3066\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
      sessionStorage.setItem(cacheKey,JSON.stringify(operation));currentPending.current=operation;setPending(operation);
      const preparedResponse=await fetch("/api/natori/consultation-file",{method:"POST",headers:{...CSRF_HEADERS,"Content-Type":"application/json"},
        body:JSON.stringify({...actor,action:"prepare",operation})});
      const prepared=await preparedResponse.json() as {kind:string;messageId?:string;operationId?:string;requestHash?:string;files?:{id:string;path:string;uploaded:boolean;uploadToken?:string}[]};
      if (!ownsPending(operation, job)) return;
      if(await recordSaved(operation,prepared,job))return;
      if(prepared.kind==="notice_expired"){setNoticeExpired(true);return;}
      if(!preparedResponse.ok||prepared.kind!=="prepared"||!prepared.files||prepared.files.length!==operation.files.length)throw new Error("送信を確定できません。同じ送信で再試行するか、送信の取消を確認してください。");
      for(const reservation of prepared.files){
        const descriptor=operation.files.find(file=>file.id===reservation.id);if(!descriptor)throw new Error("添付の予約を確認できません。");
        if(reservation.uploaded)continue;
        const draft=draftFiles.find(file=>file.id===reservation.id);
        if(!draft||!reservation.uploadToken)throw new Error("前回と同じ添付をもう一度選び、同じ送信で再試行してください。");
        const storageUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;if(!storageUrl)throw new Error("アップロード先を確認できませんでした。");
        const {Upload}=await import("tus-js-client");
        if (!ownsPending(operation, job)) return;
        setProgress(0);
        await new Promise<void>((resolve,reject)=>{
          const upload=new Upload(draft.file,{endpoint:consultationUploadEndpoint(storageUrl),retryDelays:[0,3000,5000,10000],
            headers:{"x-signature":reservation.uploadToken!},metadata:{bucketName:"natori-consultations",objectName:reservation.path,contentType:descriptor.mimeType},
            chunkSize:6*1024*1024,removeFingerprintOnSuccess:true,uploadDataDuringCreation:true,
            onProgress:(uploaded,total)=>{if(ownsPending(operation,job))setProgress(Math.round(uploaded/total*100));},onError:reject,onSuccess:()=>resolve()});
          upload.start();
        });
      }
      if (!ownsPending(operation, job)) return;
      const committed=await callOperation("commit",operation);
      if (!ownsPending(operation, job)) return;
      if(committed.data.kind==="notice_expired"){setNoticeExpired(true);return;}
      if(!committed.response.ok||!await recordSaved(operation,committed.data,job))throw new Error("送信結果を確認できません。同じ送信で再試行してください。");
    }catch(err){if(ownsAttempt(job))setError(err instanceof Error?err.message:"送信結果を確認できません。同じ送信で再試行してください。");}
    finally{releaseBusy(job);}
  };
  const cancelPending=async()=>{
    if(!pending||busyOwner.current||busy||!ownsActor())return;
    const job={actor:actorKey,generation:++operationGeneration.current};
    busyOwner.current=job;setBusy(true);setError("");
    try{
      const operation=pending;
      if (!cachedPendingMatches(operation)) throw new Error("\u4fdd\u5b58\u3055\u308c\u305f\u9001\u4fe1\u306e\u8a18\u9332\u304c\u5909\u308f\u3063\u3066\u3044\u307e\u3059\u3002\u5165\u529b\u3092\u4fdd\u6301\u3057\u3066\u3001\u30da\u30fc\u30b8\u3092\u518d\u8aad\u307f\u8fbc\u307f\u3057\u3066\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
      const {response,data}=await callOperation("cancel",operation);
      if (!ownsPending(operation, job)) return;
      if(await recordSaved(operation,data,job))return;
      if(!response.ok||data.kind!=="cancelled")throw new Error("取消を確認できません。入力を変更せず、もう一度確認してください。");
      if (!retirePending(operation, job)) return;
      setNotice("送信を取り消しました。本文と選択済み添付は下書きに残しています。"+(noticeExpired&&operation.files.length>draftFiles.length?"未選択の添付は同じファイルを選び直してください。":""));
    }catch(err){if(ownsAttempt(job))setError(err instanceof Error?err.message:"取消を確認できません。");}
    finally{releaseBusy(job);}
  };


  const retry = async (messageId: string) => {
    if (props.mode !== "staff" || busyOwner.current || busy || !ownsActor()) return;
    const job={actor:actorKey,generation:operationGeneration.current};
    busyOwner.current=job;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(postEndpoint, {
        method: "POST", headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: props.projectId, retryMessageId: messageId }),
      });
      const result = await response.json() as { error?: string; notificationFailed?: boolean };
      if (!ownsBusy(job)) return;
      if (!response.ok || result.notificationFailed) throw new Error(result.error ?? "メールを再送できませんでした");
      setNotice("メール通知を再送しました。");
      await refreshAfterSend();
    } catch (err) {
      if(ownsBusy(job))setError(err instanceof Error ? err.message : "メールを再送できませんでした");
    } finally { releaseBusy(job); }
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
          {pending?<p role="status" className="text-xs text-amber-700">{noticeExpired?"この送信の通知期限が過ぎています。本文と添付の記録は保持しています。"+(pending.files.length>draftFiles.length?"添付は同じファイルを選び直してください。":"")+"送信の取消を確認してから、同じ内容を新しく送信してください。":"前回の送信結果を確認中です。同じ内容で確認・再試行します。変更する場合は先に取消を確認してください。"}</p>:null}
          {pending?<button type="button" disabled={busy} onClick={()=>void cancelPending()} className="text-xs underline">送信の取消を確認</button>:null}
          {progress !== null ? <p role="status" className="text-xs text-pink-700">アップロード中 {progress}%</p> : null}
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || loading || historyUnavailable} className="mr-2 rounded-full border border-pink-300 px-4 py-2 text-sm font-bold text-pink-800 disabled:opacity-50">添付を選ぶ</button>
          <button type="button" onClick={() => void send()} disabled={(!pending&&!body.trim()&&!draftFiles.length)||busy||loading||historyUnavailable||!cacheReady||noticeExpired}
            className={`${natoriPrimaryActionClassName} rounded-full px-5 py-2 text-sm font-bold`}>{busy?"送信中…":pending?"同じ送信を確認・再試行":"メッセージを送信"}</button>
        </div>
      ) : closed ? <p className="text-xs text-gray-600">この相談は終了しています。履歴のみ確認できます。</p> : null}
      {notice ? <p role="status" className="text-xs text-green-700">{notice}</p> : null}
      {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
    </section>
  );
}
